
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { RECURSOS, type Recurso } from '@/lib/recursos';
import { Link2, Search, X, Globe, Database, BookText, ChevronDown, Pin, Paperclip, Trash2, Folder as FolderIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle as CardTitleComponent, CardDescription as CardDescriptionComponent } from './ui/card';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { searchElsevier, type ElsevierArticle } from '@/services/elsevier';
import { searchSNRD, type SNRDArticle } from '@/services/snrd';
import { addAttachmentToTrelloCard, removeAttachmentFromTrelloCard, type TrelloCard, type TrelloAttachment } from '@/services/trello';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Badge } from './ui/badge';
import React from 'react';
import { useToast } from '@/hooks/use-toast';

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
  ];
  try {
    const { hostname } = new URL(url);
    return scientificDomains.some(domain => hostname.includes(domain));
  } catch (e) {
    return false; // Invalid URL
  }
};


export default function ResourceLibrary({ isOpen, onOpenChange, selectedCard, onCardUpdate }: ResourceLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedResources, setPinnedResources] = useState<PinnedResource[]>([]);
  const [elsevierResults, setElsevierResults] = useState<ElsevierArticle[]>([]);
  const [snrdResults, setSnrdResults] = useState<SNRDArticle[]>([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const { toast } = useToast();

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
  
  const handleExternalSearch = async () => {
    if (searchQuery.length < 3) {
      toast({
        variant: 'destructive',
        title: 'Búsqueda demasiado corta',
        description: 'Por favor, ingresá al menos 3 caracteres para buscar en plataformas externas.',
      });
      return;
    }
    
    setIsSearchingExternal(true);
    try {
      const [elsevier, snrd] = await Promise.all([
        searchElsevier(searchQuery),
        searchSNRD(searchQuery),
      ]);
      setElsevierResults(elsevier);
      setSnrdResults(snrd);
    } catch (e) {
      console.error("Failed to search external sources", e);
      setElsevierResults([]);
      setSnrdResults([]);
      toast({
        variant: 'destructive',
        title: 'Error de búsqueda',
        description: 'No se pudo contactar a las plataformas de búsqueda externas.',
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
        description: error instanceof Error ? error.message : 'No se pudo adjuntar el recurso a la tarjeta.',
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

      toast({
        title: '¡Éxito!',
        description: `El recurso "${resource.title}" se quitó de la tarjeta.`,
      });
      // Also remove from manual pins if it exists there
      updateAndStorePinnedResources(prev =>
        prev.filter(r => r.url !== resource.url)
      );
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al quitar adjunto',
        description: error instanceof Error ? error.message : 'No se pudo quitar el recurso de la tarjeta.',
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
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0">
          <DialogTitle className="sr-only">Biblioteca de Recursos</DialogTitle>
          <DialogDescription className="sr-only">
            Buscá en nuestros recursos o en publicaciones científicas externas.
          </DialogDescription>
          <Card className="w-full h-full flex flex-col border-0 rounded-lg">
              <CardHeader>
                  <CardTitleComponent>Biblioteca de Recursos</CardTitleComponent>
                  <CardDescriptionComponent>
                      Buscá en nuestros recursos o en publicaciones científicas externas.
                  </CardDescriptionComponent>
                  <div className="pt-2 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar en la biblioteca, SNRD y Elsevier..."
                      value={searchQuery}
                      onChange={(e) => handleQueryChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="pl-9 pr-8"
                    />
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleQueryChange('')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
              </CardHeader>
              <CardContent className="flex-grow min-h-0">
                  <ScrollArea className="h-full pr-4">
                      {manuallyPinnedResources.length > 0 && (
                        <Collapsible className="mb-4">
                          <div className="flex items-center justify-between mb-2 rounded-md hover:bg-muted/50">
                            <CollapsibleTrigger asChild>
                              <div className="group flex flex-grow items-center gap-2 p-2 text-sm font-semibold text-fuchsia-600 text-left cursor-pointer">
                                  <Pin className="h-4 w-4" />
                                  <span>Recursos Fijados</span>
                              </div>
                            </CollapsibleTrigger>
                            <div className="flex items-center pr-1">
                              {pinnedResources.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => updateAndStorePinnedResources([])}
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    aria-label="Limpiar pines manuales"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                              <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                  </Button>
                              </CollapsibleTrigger>
                            </div>
                          </div>
                          <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                              <div className="flex flex-col">
                                  {manuallyPinnedResources.map((resource, index) => {
                                    const isAttached = attachedResources.some(att => att.url === resource.url);
                                    const attachmentId = isAttached ? attachedResources.find(att => att.url === resource.url)?.attachmentId : undefined;
                                    const resourceWithId = { ...resource, attachmentId };
                                    const pinned = isManuallyPinned(resource.url);

                                    return (
                                      <div
                                          key={`pinned-${resource.url}`}
                                          className={cn("group/item flex items-center justify-between py-1.5 px-2 rounded-md", index % 2 === 0 ? 'bg-muted/40' : 'bg-muted/20')}
                                      >
                                          <a href={resource.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow items-start gap-2 overflow-hidden">
                                            {resource.isScientific ? (
                                                <BookText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                                            ) : (
                                                <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                                            )}
                                            <div className="flex-grow flex flex-col gap-0.5 overflow-hidden">
                                                <span className="text-sm font-medium text-foreground group-hover/item:underline">{highlightText(resource.title, searchQuery)}</span>
                                                {resource.authors && (
                                                    <span className="text-xs text-muted-foreground">{highlightText(Array.isArray(resource.authors) ? resource.authors.join(', ') : resource.authors, searchQuery)}</span>
                                                )}
                                                {resource.publication && (
                                                    <span className="text-xs text-muted-foreground italic">{highlightText(resource.publication, searchQuery)}</span>
                                                )}
                                            </div>
                                          </a>
                                          <div className="flex flex-shrink-0 ml-2">
                                            {selectedCard && (
                                                <Button 
                                                  variant="ghost" 
                                                  size="icon" 
                                                  className="h-7 w-7"
                                                  onClick={() => isAttached ? handleRemoveAttachment(resourceWithId) : handleAttachResource(resource)}
                                                  disabled={!!attachingId}
                                                >
                                                  <Paperclip className={cn(
                                                    "h-4 w-4 transition-colors",
                                                    attachingId === resource.url && 'animate-pulse',
                                                    isAttached ? 'text-foreground' : 'text-gray-400 group-hover/item:text-foreground'
                                                  )} />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-fuchsia-500 hover:text-fuchsia-600" onClick={() => handlePinToggle(resource)}>
                                                <Pin className={cn("h-4 w-4", pinned ? "fill-current" : "")} />
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
                          <Collapsible>
                            <CollapsibleTrigger className="group flex w-full items-center justify-between p-2 rounded-md hover:bg-muted/50 text-sm font-semibold text-left">
                                <div className="flex items-center gap-2">
                                    <Paperclip className="h-4 w-4 text-fuchsia-600" />
                                    <span>Artículos Adjuntos al Proyecto</span>
                                </div>
                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                               <div className="flex flex-col mt-2">
                                  {scientificAttachmentsFromCard.map((attachment, index) => {
                                    const pinnedVersion = pinnedResources.find(p => p.url === attachment.url);
                                    const itemToRender = pinnedVersion || attachment;
                                    const itemToPin = pinnedVersion || attachment;
                                    const isPinned = isManuallyPinned(attachment.url);

                                    return (
                                       <div
                                          key={`attached-${attachment.attachmentId}`}
                                          className={cn("group/item flex items-center justify-between py-1.5 px-2 rounded-md", index % 2 === 0 ? 'bg-fuchsia-500/10' : 'bg-fuchsia-500/5')}
                                      >
                                          <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow items-start gap-2 overflow-hidden">
                                            <BookText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                                            <div className="flex-grow flex flex-col gap-0.5 overflow-hidden">
                                                <span className="text-sm font-medium text-foreground group-hover/item:underline">{highlightText(itemToRender.title, searchQuery)}</span>
                                                {itemToRender.authors && (
                                                    <span className="text-xs text-muted-foreground">{highlightText(Array.isArray(itemToRender.authors) ? itemToRender.authors.join(', ') : itemToRender.authors, searchQuery)}</span>
                                                )}
                                                {itemToRender.publication && (
                                                    <span className="text-xs text-muted-foreground italic">{highlightText(itemToRender.publication, searchQuery)}</span>
                                                )}
                                            </div>
                                          </a>
                                          <div className="flex flex-shrink-0 ml-2">
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-7 w-7"
                                              onClick={() => handleRemoveAttachment(attachment)}
                                              disabled={!!attachingId}
                                            >
                                              <Paperclip className={cn( "h-4 w-4 transition-colors text-foreground", attachingId === attachment.url && 'animate-pulse' )}/>
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-fuchsia-500 hover:text-fuchsia-600" onClick={() => handlePinToggle(itemToPin)}>
                                                <Pin className={cn("h-4 w-4", isPinned ? "fill-current" : "")} />
                                            </Button>
                                          </div>
                                      </div>
                                    )
                                  })}
                                </div>
                            </CollapsibleContent>
                          </Collapsible>
                      )}

                      {(manuallyPinnedResources.length > 0 || (selectedCard && scientificAttachmentsFromCard.length > 0)) && <Separator className="my-4" />}

                      <Collapsible className="mb-4">
                        <CollapsibleTrigger className="group flex w-full items-center justify-between p-2 rounded-md hover:bg-muted/50 text-sm font-semibold text-left">
                           <div className="flex items-center gap-2">
                              <FolderIcon className="h-4 w-4 text-fuchsia-600" />
                              <span>Recursos Locales ({filteredLocalResources.length})</span>
                          </div>
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                          {filteredLocalResources.length > 0 ? (
                            <div className="flex flex-col">
                                {filteredLocalResources.map((resource, index) => (
                                    <a
                                      key={resource.url}
                                      href={resource.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={cn(
                                        "flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-white",
                                        index % 2 === 0 ? 'bg-[#cceeff]/40' : 'bg-muted/20'
                                      )}
                                    >
                                      <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                      <span className="text-sm text-foreground">{highlightText(resource.title, searchQuery)}</span>
                                    </a>
                                ))}
                            </div>
                          ) : (
                            searchQuery && <p className="p-4 text-center text-sm text-muted-foreground">
                              No se encontraron recursos locales que coincidan con tu búsqueda.
                            </p>
                          )}
                        </CollapsibleContent>
                      </Collapsible>

                      {(elsevierResults.length > 0 || snrdResults.length > 0 || isSearchingExternal) && (
                        <>
                          <Separator className="my-4" />
                          <div className="space-y-4">
                            
                            <Collapsible>
                                <CollapsibleTrigger className="group flex w-full items-center justify-between text-sm font-semibold text-foreground">
                                    <div className="flex items-center gap-2">
                                        <Database className="h-4 w-4" />
                                        Resultados de Repositorios Nacionales (SNRD)
                                        {!isSearchingExternal && <Badge variant="secondary">{snrdResults.length}</Badge>}
                                    </div>
                                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                                    {isSearchingExternal ? <SkeletonLoader /> : snrdResults.length > 0 ? (
                                        <div className="flex flex-col">
                                            {snrdResults.map((article, index) => {
                                                const pinned = isManuallyPinned(article.url);
                                                return (
                                                  <div key={article.handle || index} className={cn( "group flex items-start justify-between py-1.5 px-2 rounded-md hover:bg-white", index % 2 !== 0 ? 'bg-muted/40' : 'bg-muted/20' )}>
                                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow flex-col gap-0.5 overflow-hidden">
                                                          <span className="text-sm font-medium text-foreground">{highlightText(article.title, searchQuery)}</span>
                                                          <span className="text-xs text-muted-foreground">{highlightText(article.authors.join(', '), searchQuery)}</span>
                                                          <span className="text-xs text-muted-foreground italic">{highlightText(article.publication, searchQuery)}</span>
                                                      </a>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 ml-2" onClick={() => handlePinToggle({ title: article.title, url: article.url, authors: article.authors, publication: article.publication, isScientific: true })}>
                                                        <Pin className={cn("h-4 w-4", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-muted-foreground group-hover/item:text-foreground")} />
                                                      </Button>
                                                  </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="px-2 pt-2 text-sm text-muted-foreground">No se encontraron artículos en repositorios nacionales.</p>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>
                            

                            <Collapsible>
                                <CollapsibleTrigger className="group flex w-full items-center justify-between text-sm font-semibold text-foreground">
                                    <div className="flex items-center gap-2">
                                        <Globe className="h-4 w-4" />
                                        Resultados de Búsqueda en Elsevier
                                        {!isSearchingExternal && <Badge variant="secondary">{elsevierResults.length}</Badge>}
                                    </div>
                                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                                    {isSearchingExternal ? <SkeletonLoader /> : elsevierResults.length > 0 ? (
                                        <div className="flex flex-col">
                                            {elsevierResults.map((article, index) => {
                                                const pinned = isManuallyPinned(article.url);
                                                return (
                                                  <div key={article.doi || index} className={cn( "group flex items-start justify-between py-1.5 px-2 rounded-md hover:bg-white", index % 2 !== 0 ? 'bg-muted/40' : 'bg-muted/20' )}>
                                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow flex-col gap-0.5 overflow-hidden">
                                                          <span className="text-sm font-medium text-foreground">{highlightText(article.title, searchQuery)}</span>
                                                          <span className="text-xs text-muted-foreground">{highlightText(article.authors, searchQuery)}</span>
                                                          <span className="text-xs text-muted-foreground italic">{highlightText(article.publicationName, searchQuery)}</span>
                                                      </a>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 ml-2" onClick={() => handlePinToggle({ title: article.title, url: article.url, authors: article.authors, publication: article.publicationName, isScientific: true })}>
                                                        <Pin className={cn("h-4 w-4", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-muted-foreground group-hover/item:text-foreground")} />
                                                      </Button>
                                                  </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="px-2 pt-2 text-sm text-muted-foreground">No se encontraron artículos en Elsevier.</p>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>
                          </div>
                        </>
                      )}
                  </ScrollArea>
              </CardContent>
          </Card>
      </DialogContent>
    </Dialog>
  );
}
