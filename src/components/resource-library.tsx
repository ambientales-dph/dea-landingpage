'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { RECURSOS, RECURSOS_PROPIOS, type Recurso } from '@/lib/recursos';
import { Link2, Search, X, Globe, Database, BookText, ChevronDown, Pin, Paperclip, Trash2, Folder as FolderIcon, FileText, Library, Plus, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle as CardTitleComponent, CardDescription as CardDescriptionComponent } from './ui/card';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { searchElsevier, type ElsevierArticle } from '@/services/elsevier';
import { searchSNRD, type SNRDArticle } from '@/services/snrd';
import { searchCrossref, type CrossrefArticle } from '@/services/crossref';
import { searchPlos, type PlosArticle } from '@/services/plos';
import { searchDoaj, type DoajArticle } from '@/services/doaj';
import { addAttachmentToTrelloCard, removeAttachmentFromTrelloCard, type TrelloCard } from '@/services/trello';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Badge } from './ui/badge';
import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { WHITELIST } from '@/lib/auth-data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface ResourceLibraryProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedCard: TrelloCard | null;
  onCardUpdate: (card: TrelloCard) => void;
}

interface PinnedResource {
  title: string;
  url: string;
  authors?: string | string[];
  publication?: string;
  attachmentId?: string;
  isScientific?: boolean;
}

const removeAccents = (str: string): string => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const SkeletonLoader = () => (
    <div className="flex flex-col gap-2 px-2 mt-2">
        {[...Array(2)].map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 p-2 rounded-md bg-muted/20">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
            </div>
        ))}
    </div>
);

const isScientificUrl = (url: string): boolean => {
  if (!url) return false;
  const scientificDomains = [
    'doi.org',
    'sciencedirect.com',
    'scielo.org',
    'repositoriosdigitales.mincyt.gob.ar',
    'elsevier.com',
    'journals.plos.org',
    'doaj.org',
  ];
  try {
    const { hostname } = new URL(url);
    return scientificDomains.some(domain => hostname.includes(domain));
  } catch (e) {
    return false;
  }
};


export default function ResourceLibrary({ isOpen, onOpenChange, selectedCard, onCardUpdate }: ResourceLibraryProps) {
  const { user } = useUser();
  const db = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedResources, setPinnedResources] = useState<PinnedResource[]>([]);
  const [elsevierResults, setElsevierResults] = useState<ElsevierArticle[]>([]);
  const [snrdResults, setSnrdResults] = useState<SNRDArticle[]>([]);
  const [crossrefResults, setCrossrefResults] = useState<CrossrefArticle[]>([]);
  const [plosResults, setPlosResults] = useState<PlosArticle[]>([]);
  const [doajResults, setDoajResults] = useState<DoajArticle[]>([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const { toast } = useToast();

  const [manualUrl, setManualUrl] = useState('');
  const [manualTitle, setManualTitle] = useState('');

  const prevSelectedCardId = useRef<string | null>(null);

  useEffect(() => {
    try {
        const storedPins = localStorage.getItem('pinnedResources');
        if (storedPins) {
            setPinnedResources(JSON.parse(storedPins));
        }
    } catch (error) {
        console.error("Failed to load pins from localStorage", error);
    }
  }, []);

  const updateAndStorePinnedResources = (updater: React.SetStateAction<PinnedResource[]>) => {
      setPinnedResources(prev => {
          const newState = typeof updater === 'function' ? updater(prev) : updater;
          try {
              localStorage.setItem('pinnedResources', JSON.stringify(newState));
          } catch (error) {
              console.error("Failed to save pins to localStorage", error);
          }
          return newState;
      });
  };
  
  const manuallyPinnedResources = pinnedResources;

  const attachedResources = useMemo((): PinnedResource[] => {
    if (!selectedCard?.attachments) {
      return [];
    }
    return selectedCard.attachments
      .filter(att => att.url.startsWith('http'))
      .map((att): PinnedResource => ({
        title: att.name,
        url: att.url,
        attachmentId: att.id,
        isScientific: isScientificUrl(att.url),
      }));
  }, [selectedCard]);

  const scientificAttachmentsFromCard = useMemo((): PinnedResource[] => {
    return attachedResources.filter(r => r.isScientific);
  }, [attachedResources]);


  useEffect(() => {
    if (!isOpen) {
        setElsevierResults([]);
        setSnrdResults([]);
        setCrossrefResults([]);
        setPlosResults([]);
        setDoajResults([]);
        setManualUrl('');
        setManualTitle('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && selectedCard?.id !== prevSelectedCardId.current) {
        prevSelectedCardId.current = selectedCard?.id || null;
    }
  }, [selectedCard, isOpen]);

  const filteredLocalResources = useMemo(() => {
    const allResources = [...RECURSOS].sort((a, b) => a.title.localeCompare(b.title));

    if (!searchQuery) {
      return allResources;
    }

    const normalizedQuery = removeAccents(searchQuery.toLowerCase());
    
    return allResources.filter(resource => 
      removeAccents(resource.title.toLowerCase()).includes(normalizedQuery)
    );
  }, [searchQuery]);

  const logActivity = useCallback(async (actionType: string, detail: string) => {
    if (user && db && selectedCard) {
      const authorizedUser = WHITELIST.find(u => u.email.toLowerCase() === user.email?.toLowerCase());
      const realName = authorizedUser?.name || user.displayName || 'Usuario';

      const activityData = {
        userId: user.uid,
        userName: realName,
        userEmail: user.email,
        userPhoto: user.photoURL || '',
        actionType: actionType,
        projectName: detail,
        cardId: selectedCard.id,
        timestamp: serverTimestamp(),
      };

      try {
        await addDoc(collection(db, 'app_activities'), activityData);
      } catch (error) {
         const permissionError = new FirestorePermissionError({
            path: 'app_activities',
            operation: 'create',
            requestResourceData: activityData,
          });
          errorEmitter.emit('permission-error', permissionError);
      }
    }
  }, [user, db, selectedCard]);
  
  const handleExternalSearch = async () => {
    if (searchQuery.length < 3) {
      toast({
        variant: 'destructive',
        title: 'Búsqueda demasiado corta',
        description: 'Ingresá al menos 3 caracteres para buscar en plataformas externas.',
      });
      return;
    }
    
    setIsSearchingExternal(true);
    try {
      const [elsevier, snrd, crossref, plos, doaj] = await Promise.all([
        searchElsevier(searchQuery),
        searchSNRD(searchQuery),
        searchCrossref(searchQuery),
        searchPlos(searchQuery),
        searchDoaj(searchQuery),
      ]);
      setElsevierResults(elsevier);
      setSnrdResults(snrd);
      setCrossrefResults(crossref);
      setPlosResults(plos);
      setDoajResults(doaj);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error de búsqueda',
        description: 'No se pudo contactar a las plataformas externas.',
      });
    } finally {
      setIsSearchingExternal(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleExternalSearch();
    }
  };
  
  const handleQueryChange = (query: string) => {
    setSearchQuery(query);
    if (query === '') {
        setElsevierResults([]);
        setSnrdResults([]);
        setCrossrefResults([]);
        setPlosResults([]);
        setDoajResults([]);
    }
  };

  const handleManualUrlChange = (url: string) => {
    setManualUrl(url);
    if (url.trim()) {
        try {
            const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
            const pathname = urlObj.pathname;
            const lastPart = pathname.split('/').filter(Boolean).pop();
            if (lastPart && !manualTitle) {
                const decoded = decodeURIComponent(lastPart).split('.')[0];
                setManualTitle(decoded.replace(/-/g, ' ').replace(/_/g, ' '));
            }
        } catch (e) {}
    }
  };

  const handlePinToggle = (resource: PinnedResource) => {
    updateAndStorePinnedResources(prev => {
      const isAlreadyPinned = prev.some(p => p.url === resource.url);
      if (isAlreadyPinned) {
        return prev.filter(p => p.url !== resource.url);
      } else {
        const { attachmentId, ...rest } = resource;
        return [{ ...rest, isScientific: resource.isScientific ?? isScientificUrl(resource.url) }, ...prev];
      }
    });
  };

  const handleAddManualResource = () => {
    if (!manualUrl.trim()) return;
    
    const finalUrl = manualUrl.startsWith('http') ? manualUrl : `https://${manualUrl}`;
    const finalTitle = manualTitle.trim() || manualUrl;

    const resource: PinnedResource = {
        title: finalTitle,
        url: finalUrl,
        isScientific: isScientificUrl(finalUrl)
    };

    handlePinToggle(resource);
    setManualUrl('');
    setManualTitle('');
    toast({ title: 'Recurso fijado', description: `Se agregó "${finalTitle}" a tus pines.` });
  };

  const handleAttachResource = async (resource: PinnedResource) => {
    if (!selectedCard) return;

    if (selectedCard.attachments.some(att => att.url === resource.url)) {
        toast({
            variant: 'destructive',
            title: 'Recurso duplicado',
            description: 'Este enlace ya está adjunto al proyecto.',
        });
        return;
    }

    setAttachingId(resource.url);
    try {
      const newAttachment = await addAttachmentToTrelloCard({
        cardId: selectedCard.id,
        url: resource.url,
        name: resource.title,
      });

      const updatedCard = {
          ...selectedCard,
          attachments: [...selectedCard.attachments, newAttachment],
      };
      onCardUpdate(updatedCard);
      
      await logActivity('attach_resource', `Adjuntó el recurso "${resource.title}" en "${selectedCard.name}"`);

      toast({
        title: '¡Éxito!',
        description: `El recurso "${resource.title}" se adjuntó a la tarjeta.`,
      });
       updateAndStorePinnedResources(prev => 
        prev.map(r => r.url === resource.url ? { ...r, attachmentId: newAttachment.id } : r)
      );

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al adjuntar',
        description: 'No se pudo adjuntar el recurso a la tarjeta.',
      });
    } finally {
      setAttachingId(null);
    }
  };
  
  const handleRemoveAttachment = async (resource: PinnedResource) => {
    if (!selectedCard || !resource.attachmentId) return;
  
    setAttachingId(resource.url);
    try {
      await removeAttachmentFromTrelloCard({
        cardId: selectedCard.id,
        attachmentId: resource.attachmentId,
      });
      
      const updatedCard = {
          ...selectedCard,
          attachments: selectedCard.attachments.filter(att => att.id !== resource.attachmentId),
      };
      onCardUpdate(updatedCard);

      await logActivity('remove_attachment', `Quitó el recurso "${resource.title}" de "${selectedCard.name}"`);

      toast({
        title: '¡Éxito!',
        description: `El recurso "${resource.title}" se quitó de la tarjeta.`,
      });
      updateAndStorePinnedResources(prev =>
        prev.filter(r => r.url !== resource.url)
      );
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al quitar adjunto',
        description: 'No se pudo quitar el recurso de la tarjeta.',
      });
    } finally {
      setAttachingId(null);
    }
  };

  const isManuallyPinned = (url: string) => pinnedResources.some(p => p.url === url);

  const highlightText = (text: string | undefined, query: string): React.ReactNode => {
    if (!text || !query) {
      return text;
    }

    const normalizedText = removeAccents(text).toLowerCase();
    const normalizedQuery = removeAccents(query).toLowerCase();

    if (normalizedQuery.length === 0) {
      return text;
    }

    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    let matchIndex;

    while ((matchIndex = normalizedText.indexOf(normalizedQuery, lastIndex)) > -1) {
      if (matchIndex > lastIndex) {
        result.push(text.substring(lastIndex, matchIndex));
      }
      
      const matchedText = text.substring(matchIndex, matchIndex + normalizedQuery.length);
      result.push(
        <span key={lastIndex} className="bg-fuchsia-500/40 rounded-sm">
          {matchedText}
        </span>
      );

      lastIndex = matchIndex + normalizedQuery.length;
    }

    if (lastIndex < text.length) {
      result.push(text.substring(lastIndex));
    }

    return result.length > 0 ? <>{result}</> : text;
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 border-0 shadow-2xl overflow-hidden bg-white">
          <DialogTitle className="sr-only">Biblioteca de Recursos</DialogTitle>
          <DialogDescription className="sr-only">
            Buscá en recursos o publicaciones científicas.
          </DialogDescription>
          <div className="w-full h-full flex flex-col">
              <CardHeader className="bg-muted/30 border-b shrink-0 space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                        <CardTitleComponent className="text-base font-bold">Biblioteca de Recursos</CardTitleComponent>
                        <CardDescriptionComponent className="text-[11px]">
                            Buscá en nuestros recursos o en publicaciones científicas externas.
                        </CardDescriptionComponent>
                    </div>
                    <Library className="h-6 w-6 text-primary/40" />
                  </div>
                  
                  <div className="grid gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar en la biblioteca, SNRD, Elsevier, Crossref, PLOS y DOAJ..."
                        value={searchQuery}
                        onChange={(e) => handleQueryChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="pl-9 pr-8 h-9 text-xs bg-white shadow-sm"
                      />
                      {searchQuery && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleQueryChange('')}
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="p-2 bg-primary/5 rounded-lg border border-primary/10 flex flex-col gap-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-primary">Agregar Enlace Externo</p>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
                                <Input 
                                    placeholder="Pegá el link (URL)..." 
                                    className="h-7 pl-7 text-[11px] bg-white border-zinc-200"
                                    value={manualUrl}
                                    onChange={(e) => handleManualUrlChange(e.target.value)}
                                />
                            </div>
                            <Input 
                                placeholder="Título del documento..." 
                                className="h-7 text-[11px] bg-white border-zinc-200 flex-[0.8]"
                                value={manualTitle}
                                onChange={(e) => setManualTitle(e.target.value)}
                            />
                            <Button 
                                size="sm" 
                                className="h-7 gap-1.5 px-3 font-bold text-[9px] uppercase tracking-tighter"
                                disabled={!manualUrl.trim()}
                                onClick={handleAddManualResource}
                            >
                                <Pin className="h-3 w-3" />
                                Fijar
                            </Button>
                        </div>
                    </div>
                  </div>
              </CardHeader>
              <CardContent className="flex-grow min-h-0 p-0 overflow-hidden">
                  <ScrollArea className="h-full px-4 py-2">
                      {manuallyPinnedResources.length > 0 && (
                        <Collapsible className="mb-2" defaultOpen={true}>
                          <div className="flex items-center justify-between mb-1 rounded-md hover:bg-muted/50">
                            <CollapsibleTrigger asChild>
                              <div className="group flex flex-grow items-center gap-2 p-1.5 text-sm font-semibold text-fuchsia-600 text-left cursor-pointer">
                                  <Pin className="h-3.5 w-3.5" />
                                  <span className="uppercase tracking-widest text-[9px] font-black">Recursos Fijados</span>
                              </div>
                            </CollapsibleTrigger>
                            <div className="flex items-center pr-1">
                              {pinnedResources.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => updateAndStorePinnedResources([])}
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                  </Button>
                              </CollapsibleTrigger>
                            </div>
                          </div>
                          <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                              <div className="flex flex-col gap-1">
                                  {manuallyPinnedResources.map((resource, index) => {
                                    const isAttached = attachedResources.some(att => att.url === resource.url);
                                    const attachmentId = isAttached ? attachedResources.find(att => att.url === resource.url)?.attachmentId : undefined;
                                    const resourceWithId = { ...resource, attachmentId };
                                    const pinned = isManuallyPinned(resource.url);

                                    return (
                                      <div
                                          key={`pinned-${resource.url}`}
                                          className={cn("group/item flex items-center justify-between py-1.5 px-2 rounded-md border transition-all", index % 2 === 0 ? 'bg-white border-zinc-100 shadow-sm' : 'bg-muted/20 border-transparent')}
                                      >
                                          <a href={resource.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow items-start gap-2 overflow-hidden">
                                            {resource.isScientific ? (
                                                <BookText className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0 mt-0.5" />
                                            ) : (
                                                <Link2 className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0 mt-0.5" />
                                            )}
                                            <div className="flex-grow flex flex-col gap-0.5 overflow-hidden">
                                                <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight">{highlightText(resource.title, searchQuery)}</span>
                                                {resource.authors && (
                                                    <span className="text-[9px] text-muted-foreground truncate">{highlightText(Array.isArray(resource.authors) ? resource.authors.join(', ') : resource.authors, searchQuery)}</span>
                                                )}
                                                {resource.publication && (
                                                    <span className="text-[9px] text-muted-foreground italic truncate">{highlightText(resource.publication, searchQuery)}</span>
                                                )}
                                            </div>
                                          </a>
                                          <div className="flex flex-shrink-0 ml-3 items-center gap-1">
                                            {selectedCard && (
                                                <Button 
                                                  variant="ghost" 
                                                  size="icon" 
                                                  className={cn(
                                                    "h-7 w-7 rounded-full transition-all",
                                                    isAttached ? "text-primary bg-primary/10 hover:bg-primary/20" : "text-zinc-300 hover:text-zinc-600 hover:bg-muted"
                                                  )}
                                                  onClick={() => isAttached ? handleRemoveAttachment(resourceWithId) : handleAttachResource(resource)}
                                                  disabled={!!attachingId}
                                                >
                                                  <Paperclip className={cn(
                                                    "h-3.5 w-3.5",
                                                    attachingId === resource.url && 'animate-pulse'
                                                  )} />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-fuchsia-500 hover:text-fuchsia-600 hover:bg-fuchsia-50" onClick={() => handlePinToggle(resource)}>
                                                <Pin className={cn("h-3.5 w-3.5 fill-current")} />
                                            </Button>
                                          </div>
                                      </div>
                                    );
                                  })}
                              </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {selectedCard && scientificAttachmentsFromCard.length > 0 && (
                          <Collapsible className="mb-2">
                            <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50 text-sm font-semibold text-left">
                                <div className="flex items-center gap-2">
                                    <Paperclip className="h-3.5 w-3.5 text-primary" />
                                    <span className="uppercase tracking-widest text-[9px] font-black">Enlaces del Proyecto</span>
                                </div>
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                               <div className="flex flex-col mt-1 gap-1">
                                  {scientificAttachmentsFromCard.map((attachment, index) => {
                                    const pinnedVersion = pinnedResources.find(p => p.url === attachment.url);
                                    const itemToRender = pinnedVersion || attachment;
                                    const itemToPin = pinnedVersion || attachment;
                                    const isPinned = isManuallyPinned(attachment.url);

                                    return (
                                       <div
                                          key={`attached-${attachment.attachmentId}`}
                                          className={cn("group/item flex items-center justify-between py-1.5 px-2 rounded-md border transition-all", index % 2 === 0 ? 'bg-primary/5 border-primary/10' : 'bg-white border-zinc-100')}
                                      >
                                          <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow items-start gap-2 overflow-hidden">
                                            <BookText className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0 mt-0.5" />
                                            <div className="flex-grow flex flex-col gap-0.5 overflow-hidden">
                                                <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight">{highlightText(itemToRender.title, searchQuery)}</span>
                                                {itemToRender.authors && (
                                                    <span className="text-[9px] text-muted-foreground truncate">{highlightText(Array.isArray(itemToRender.authors) ? itemToRender.authors.join(', ') : itemToRender.authors, searchQuery)}</span>
                                                )}
                                                {itemToRender.publication && (
                                                    <span className="text-[9px] text-muted-foreground italic truncate">{highlightText(itemToRender.publication, searchQuery)}</span>
                                                )}
                                            </div>
                                          </a>
                                          <div className="flex flex-shrink-0 ml-3 items-center gap-1">
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-7 w-7 rounded-full text-primary bg-primary/10 hover:bg-primary/20"
                                              onClick={() => handleRemoveAttachment(attachment)}
                                              disabled={!!attachingId}
                                            >
                                              <Paperclip className={cn( "h-3.5 w-3.5", attachingId === attachment.url && 'animate-pulse' )}/>
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-fuchsia-500 hover:text-fuchsia-600 hover:bg-fuchsia-50" onClick={() => handlePinToggle(itemToPin)}>
                                                <Pin className={cn("h-3.5 w-3.5", isPinned ? "fill-current" : "")} />
                                            </Button>
                                          </div>
                                      </div>
                                    )
                                  })}
                                </div>
                            </CollapsibleContent>
                          </Collapsible>
                      )}

                      {(manuallyPinnedResources.length > 0 || (selectedCard && scientificAttachmentsFromCard.length > 0)) && <Separator className="my-3" />}

                      <Collapsible className="mb-2" defaultOpen={false}>
                        <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50 text-sm font-semibold text-left">
                           <div className="flex items-center gap-2">
                              <FolderIcon className="h-3.5 w-3.5 text-primary" />
                              <span className="uppercase tracking-widest text-[9px] font-black">Recursos externos ({filteredLocalResources.length})</span>
                          </div>
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-1 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                          {filteredLocalResources.length > 0 ? (
                            <div className="flex flex-col gap-1">
                                {filteredLocalResources.map((resource, index) => (
                                    <div key={resource.url} className={cn("group/item flex items-center justify-between py-1 px-2 rounded-md transition-colors", index % 2 === 0 ? 'bg-[#cceeff]/40' : 'bg-muted/20')}>
                                        <a
                                          href={resource.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 flex-1 overflow-hidden"
                                        >
                                          <Link2 className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
                                          <span className="text-xs text-foreground font-medium group-hover/item:text-primary transition-colors truncate">{highlightText(resource.title, searchQuery)}</span>
                                        </a>
                                        <div className="flex items-center ml-2">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-fuchsia-500/40 hover:text-fuchsia-600 hover:bg-fuchsia-50" onClick={() => handlePinToggle({ title: resource.title, url: resource.url })}>
                                                <Pin className={cn("h-3 w-3", isManuallyPinned(resource.url) ? "fill-current opacity-100" : "")} />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                          ) : (
                            searchQuery && <p className="p-3 text-center text-[11px] text-muted-foreground italic">
                              No hay recursos para tu búsqueda.
                            </p>
                          )}
                        </CollapsibleContent>
                      </Collapsible>

                      {(elsevierResults.length > 0 || snrdResults.length > 0 || crossrefResults.length > 0 || plosResults.length > 0 || doajResults.length > 0 || isSearchingExternal) && (
                        <>
                          <Separator className="my-3" />
                          <div className="space-y-2">
                            
                            <Collapsible defaultOpen={true}>
                                <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50">
                                    <div className="flex items-center gap-2">
                                        <Database className="h-3.5 w-3.5 text-primary" />
                                        <span className="uppercase tracking-widest text-[9px] font-black">Repositorios Nacionales (SNRD)</span>
                                        {!isSearchingExternal && <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-bold">{snrdResults.length}</Badge>}
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                                    {isSearchingExternal ? <SkeletonLoader /> : snrdResults.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {snrdResults.map((article, index) => {
                                                const pinned = isManuallyPinned(article.url);
                                                return (
                                                  <div key={article.handle || index} className={cn( "group/item flex items-start justify-between py-1.5 px-2 rounded-md border transition-all", index % 2 !== 0 ? 'bg-muted/20 border-transparent' : 'bg-white border-zinc-100 shadow-sm' )}>
                                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow flex-col gap-0.5 overflow-hidden">
                                                          <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight">{highlightText(article.title, searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground">{highlightText(Array.isArray(article.authors) ? article.authors.join(', ') : article.authors, searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground italic truncate">{highlightText(article.publication, searchQuery)}</span>
                                                      </a>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full flex-shrink-0 ml-3 hover:bg-fuchsia-50" onClick={() => handlePinToggle({ title: article.title, url: article.url, authors: article.authors, publication: article.publication, isScientific: true })}>
                                                        <Pin className={cn("h-3.5 w-3.5", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-zinc-300 group-hover/item:text-fuchsia-500")} />
                                                      </Button>
                                                  </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="px-2 py-3 text-[11px] text-muted-foreground italic">No se encontraron artículos en SNRD.</p>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>
                            

                            <Collapsible defaultOpen={false}>
                                <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50">
                                    <div className="flex items-center gap-2">
                                        <Globe className="h-3.5 w-3.5 text-primary" />
                                        <span className="uppercase tracking-widest text-[9px] font-black">Elsevier / Scopus</span>
                                        {!isSearchingExternal && <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-bold">{elsevierResults.length}</Badge>}
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                                    {isSearchingExternal ? <SkeletonLoader /> : elsevierResults.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {elsevierResults.map((article, index) => {
                                                const pinned = isManuallyPinned(article.url);
                                                return (
                                                  <div key={article.doi || index} className={cn( "group/item flex items-start justify-between py-1.5 px-2 rounded-md border transition-all", index % 2 !== 0 ? 'bg-muted/20 border-transparent' : 'bg-white border-zinc-100 shadow-sm' )}>
                                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow flex-col gap-0.5 overflow-hidden">
                                                          <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight">{highlightText(article.title, searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground">{highlightText(article.authors, searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground italic truncate">{highlightText(article.publicationName, searchQuery)}</span>
                                                      </a>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full flex-shrink-0 ml-3 hover:bg-fuchsia-50" onClick={() => handlePinToggle({ title: article.title, url: article.url, authors: article.authors, publication: article.publicationName, isScientific: true })}>
                                                        <Pin className={cn("h-3.5 w-3.5", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-zinc-300 group-hover/item:text-fuchsia-500")} />
                                                      </Button>
                                                  </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="px-2 py-3 text-[11px] text-muted-foreground italic">No se encontraron artículos en Elsevier.</p>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>

                            <Collapsible defaultOpen={false}>
                                <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50">
                                    <div className="flex items-center gap-2">
                                        <BookText className="h-3.5 w-3.5 text-primary" />
                                        <span className="uppercase tracking-widest text-[9px] font-black">Crossref / DOI</span>
                                        {!isSearchingExternal && <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-bold">{crossrefResults.length}</Badge>}
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                                    {isSearchingExternal ? <SkeletonLoader /> : crossrefResults.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {crossrefResults.map((article, index) => {
                                                const pinned = isManuallyPinned(article.url);
                                                return (
                                                  <div key={article.doi || index} className={cn( "group/item flex items-start justify-between py-1.5 px-2 rounded-md border transition-all", index % 2 !== 0 ? 'bg-muted/20 border-transparent' : 'bg-white border-zinc-100 shadow-sm' )}>
                                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow flex-col gap-0.5 overflow-hidden">
                                                          <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight">{highlightText(article.title, searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground">{highlightText(article.authors.join(', '), searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground italic truncate">{highlightText(article.publication, searchQuery)}</span>
                                                      </a>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full flex-shrink-0 ml-3 hover:bg-fuchsia-50" onClick={() => handlePinToggle({ title: article.title, url: article.url, authors: article.authors, publication: article.publication, isScientific: true })}>
                                                        <Pin className={cn("h-3.5 w-3.5", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-zinc-300 group-hover/item:text-fuchsia-500")} />
                                                      </Button>
                                                  </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="px-2 py-3 text-[11px] text-muted-foreground italic">No se encontraron artículos en Crossref.</p>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>
                            
                            <Collapsible defaultOpen={false}>
                                <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50">
                                    <div className="flex items-center gap-2">
                                        <BookText className="h-3.5 w-3.5 text-primary" />
                                        <span className="uppercase tracking-widest text-[9px] font-black">PLOS / Public Science</span>
                                        {!isSearchingExternal && <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-bold">{plosResults.length}</Badge>}
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                                    {isSearchingExternal ? <SkeletonLoader /> : plosResults.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {plosResults.map((article, index) => {
                                                const pinned = isManuallyPinned(article.url);
                                                return (
                                                  <div key={article.id || index} className={cn( "group/item flex items-start justify-between py-1.5 px-2 rounded-md border transition-all", index % 2 !== 0 ? 'bg-muted/20 border-transparent' : 'bg-white border-zinc-100 shadow-sm' )}>
                                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow flex-col gap-0.5 overflow-hidden">
                                                          <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight">{highlightText(article.title, searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground">{highlightText(article.authors.join(', '), searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground italic truncate">{highlightText(article.publication, searchQuery)}</span>
                                                      </a>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full flex-shrink-0 ml-3 hover:bg-fuchsia-50" onClick={() => handlePinToggle({ title: article.title, url: article.url, authors: article.authors, publication: article.publication, isScientific: true })}>
                                                        <Pin className={cn("h-3.5 w-3.5", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-zinc-300 group-hover/item:text-fuchsia-500")} />
                                                      </Button>
                                                  </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="px-2 py-3 text-[11px] text-muted-foreground italic">No se encontraron artículos en PLOS.</p>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>

                             <Collapsible defaultOpen={false}>
                                <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50 text-left">
                                    <div className="flex items-center gap-2">
                                        <Library className="h-3.5 w-3.5 text-primary" />
                                        <span className="uppercase tracking-widest text-[9px] font-black">DOAJ (Acceso Abierto)</span>
                                        {!isSearchingExternal && <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-bold">{doajResults.length}</Badge>}
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                                    {isSearchingExternal ? <SkeletonLoader /> : doajResults.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {doajResults.map((article, index) => {
                                                const pinned = isManuallyPinned(article.url);
                                                return (
                                                  <div key={article.id || index} className={cn( "group/item flex items-start justify-between py-1.5 px-2 rounded-md border transition-all", index % 2 !== 0 ? 'bg-muted/20 border-transparent' : 'bg-white border-zinc-100 shadow-sm' )}>
                                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow flex-col gap-0.5 overflow-hidden">
                                                          <span className="text-xs font-bold text-foreground group-hover/item:text-primary transition-colors leading-tight">{highlightText(article.title, searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground">{highlightText(article.authors.join(', '), searchQuery)}</span>
                                                          <span className="text-[9px] text-muted-foreground italic truncate">{highlightText(article.publication, searchQuery)}</span>
                                                      </a>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full flex-shrink-0 ml-3 hover:bg-fuchsia-50" onClick={() => handlePinToggle({ title: article.title, url: article.url, authors: article.authors, publication: article.publication, isScientific: true })}>
                                                        <Pin className={cn("h-3.5 w-3.5", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-zinc-300 group-hover/item:text-fuchsia-500")} />
                                                      </Button>
                                                  </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="px-2 py-3 text-[11px] text-muted-foreground italic">No se encontraron artículos en DOAJ.</p>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>

                          </div>
                        </>
                      )}
                      
                    <Separator className="my-3" />

                    <Collapsible defaultOpen={false}>
                        <CollapsibleTrigger className="group flex w-full items-center justify-between p-1.5 rounded-md hover:bg-muted/50 text-sm font-semibold text-left">
                           <div className="flex items-center gap-2">
                              <FolderIcon className="h-3.5 w-3.5 text-primary" />
                              <span className="uppercase tracking-widest text-[9px] font-black">Recursos Internos</span>
                          </div>
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-4">
                            {RECURSOS_PROPIOS.map((resource, index) => {
                                const colors = [
                                    'bg-sky-50 border-sky-100 hover:bg-sky-100',
                                    'bg-teal-50 border-teal-100 hover:bg-teal-100',
                                    'bg-violet-50 border-violet-100 hover:bg-violet-100',
                                    'bg-amber-50 border-amber-100 hover:bg-amber-100',
                                ];
                                return (
                                  <a
                                    key={resource.title}
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                        "group flex flex-col items-center justify-center rounded-xl border text-card-foreground shadow-sm transition-all p-3 aspect-square hover:shadow-md hover:-translate-y-1",
                                        colors[index % colors.length]
                                    )}
                                  >
                                    <FileText className="h-8 w-8 text-zinc-400 mb-1.5 transition-transform group-hover:scale-110" />
                                    <span className="text-center text-[9px] font-bold uppercase leading-tight">{resource.title}</span>
                                  </a>
                                );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                  </ScrollArea>
              </CardContent>
          </div>
      </DialogContent>
    </Dialog>
  );
}
