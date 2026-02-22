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
import { Link2, Search, X, Globe, Database, BookText, ChevronDown, Pin, Paperclip } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle as CardTitleComponent, CardDescription as CardDescriptionComponent } from './ui/card';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { searchElsevier, type ElsevierArticle } from '@/services/elsevier';
import { searchSNRD, type SNRDArticle } from '@/services/snrd';
import { searchScielo, type ScieloArticle } from '@/services/scielo';
import { addAttachmentToTrelloCard, removeAttachmentFromTrelloCard, type TrelloCard } from '@/services/trello';
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


export default function ResourceLibrary({ isOpen, onOpenChange, selectedCard }: ResourceLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedResources, setPinnedResources] = useState<PinnedResource[]>([]);
  const [elsevierResults, setElsevierResults] = useState<ElsevierArticle[]>([]);
  const [snrdResults, setSnrdResults] = useState<SNRDArticle[]>([]);
  const [scieloResults, setScieloResults] = useState<ScieloArticle[]>([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const { toast } = useToast();
  const prevIsOpen = useRef(isOpen);
  
  const attachedCardResources = useMemo((): PinnedResource[] => {
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

  useEffect(() => {
    const wasClosed = !isOpen && prevIsOpen.current;
    if (wasClosed) {
        setSearchQuery('');
        setElsevierResults([]);
        setSnrdResults([]);
        setScieloResults([]);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen]);


  const displayedPinnedResources = useMemo((): PinnedResource[] => {
    const allResources = [...pinnedResources, ...attachedCardResources];
    const uniqueResources = Array.from(new Map(allResources.map(item => [item.url, item])).values());
    return uniqueResources;
  }, [pinnedResources, attachedCardResources]);


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
  
  useEffect(() => {
    const handler = setTimeout(async () => {
        if (searchQuery.length < 3) {
            setElsevierResults([]);
            setSnrdResults([]);
            setScieloResults([]);
            return;
        }
        
        setIsSearchingExternal(true);
        try {
          const [elsevier, snrd, scielo] = await Promise.all([
            searchElsevier(searchQuery),
            searchSNRD(searchQuery),
            searchScielo(searchQuery),
          ]);
          setElsevierResults(elsevier);
          setSnrdResults(snrd);
          setScieloResults(scielo);
        } catch (e) {
          console.error("Failed to search external sources", e);
          setElsevierResults([]);
          setSnrdResults([]);
          setScieloResults([]);
        } finally {
          setIsSearchingExternal(false);
        }
    }, 500); // 500ms debounce

    return () => {
        clearTimeout(handler);
        setIsSearchingExternal(false);
    };
  }, [searchQuery]);

  const handlePinToggle = (resource: PinnedResource) => {
    setPinnedResources(prev => {
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

    setAttachingId(resource.url);
    try {
      const newAttachment = await addAttachmentToTrelloCard({
        cardId: selectedCard.id,
        url: resource.url,
        name: resource.title,
      });
      toast({
        title: '¡Éxito!',
        description: `El recurso "${resource.title}" se adjuntó a la tarjeta.`,
      });
      setPinnedResources(prev => 
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
      toast({
        title: '¡Éxito!',
        description: `El recurso "${resource.title}" se quitó de la tarjeta.`,
      });
      setPinnedResources(prev =>
        prev.map(r => {
            if (r.url === resource.url) {
                const { attachmentId, ...rest } = r;
                return rest;
            }
            return r;
        })
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
                      placeholder="Buscar en la biblioteca, SNRD, SciELO y Elsevier..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-8"
                    />
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
              </CardHeader>
              <CardContent className="flex-grow min-h-0">
                  <ScrollArea className="h-full pr-4">
                      {displayedPinnedResources.length > 0 && (
                        <>
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-2 px-2">
                                <div className="flex items-center gap-2 text-sm font-semibold text-fuchsia-600">
                                    <Pin className="h-4 w-4" />
                                    <span>Recursos Fijados</span>
                                </div>
                                {pinnedResources.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setPinnedResources([])}
                                        className="h-7 text-muted-foreground hover:text-foreground px-2"
                                    >
                                        <X className="h-4 w-4 mr-1" />
                                        Limpiar
                                    </Button>
                                )}
                            </div>
                            <div className="flex flex-col">
                                {displayedPinnedResources.map((resource, index) => {
                                  const isAttached = !!resource.attachmentId;
                                  const pinned = isManuallyPinned(resource.url);
                                  return (
                                    <div
                                        key={`pinned-${resource.url}`}
                                        className={cn("group/item flex items-center justify-between py-1.5 px-2 rounded-md", index % 2 === 0 ? 'bg-fuchsia-500/10' : 'bg-fuchsia-500/5')}
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
                                                onClick={() => isAttached ? handleRemoveAttachment(resource) : handleAttachResource(resource)}
                                                disabled={!!attachingId}
                                              >
                                                <Paperclip className={cn(
                                                  "h-4 w-4",
                                                  attachingId === resource.url && 'animate-pulse',
                                                  isAttached ? 'text-foreground' : 'text-muted-foreground group-hover/item:text-foreground'
                                                )} />
                                              </Button>
                                          )}
                                          <Button variant="ghost" size="icon" className="h-7 w-7 text-fuchsia-500 hover:text-fuchsia-600" onClick={() => handlePinToggle(resource)}>
                                              <Pin className={cn("h-4 w-4", pinned || attachedCardResources.some(att => att.url === resource.url) ? "fill-current" : "")} />
                                          </Button>
                                        </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                          <Separator className="my-4" />
                        </>
                      )}

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
                        searchQuery && <p className="text-center text-sm text-muted-foreground py-10">
                          No se encontraron recursos locales que coincidan con tu búsqueda.
                        </p>
                      )}

                      {searchQuery.length >= 3 && (
                        <>
                          <Separator className="my-4" />
                          <div className="space-y-4">
                            
                            <Collapsible defaultOpen>
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
                                                        <Pin className={cn("h-4 w-4", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-muted-foreground group-hover:text-foreground")} />
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
                            
                            <Collapsible defaultOpen>
                                <CollapsibleTrigger className="group flex w-full items-center justify-between text-sm font-semibold text-foreground">
                                    <div className="flex items-center gap-2">
                                        <BookText className="h-4 w-4" />
                                        Resultados de SciELO Argentina
                                        {!isSearchingExternal && <Badge variant="secondary">{scieloResults.length}</Badge>}
                                    </div>
                                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                                    {isSearchingExternal ? <SkeletonLoader /> : scieloResults.length > 0 ? (
                                        <div className="flex flex-col">
                                            {scieloResults.map((article, index) => {
                                                const pinned = isManuallyPinned(article.url);
                                                return (
                                                  <div key={article.id || index} className={cn( "group flex items-start justify-between py-1.5 px-2 rounded-md hover:bg-white", index % 2 !== 0 ? 'bg-muted/40' : 'bg-muted/20' )}>
                                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-grow flex-col gap-0.5 overflow-hidden">
                                                          <span className="text-sm font-medium text-foreground">{highlightText(article.title, searchQuery)}</span>
                                                          <span className="text-xs text-muted-foreground">{highlightText(article.authors.join(', '), searchQuery)}</span>
                                                          <span className="text-xs text-muted-foreground italic">{highlightText(article.journal, searchQuery)}</span>
                                                      </a>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 ml-2" onClick={() => handlePinToggle({ title: article.title, url: article.url, authors: article.authors, publication: article.journal, isScientific: true })}>
                                                        <Pin className={cn("h-4 w-4", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-muted-foreground group-hover:text-foreground")} />
                                                      </Button>
                                                  </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="px-2 pt-2 text-sm text-muted-foreground">No se encontraron artículos en SciELO Argentina.</p>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>

                            <Collapsible defaultOpen>
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
                                                        <Pin className={cn("h-4 w-4", pinned ? "fill-fuchsia-500 text-fuchsia-500" : "text-muted-foreground group-hover:text-foreground")} />
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
