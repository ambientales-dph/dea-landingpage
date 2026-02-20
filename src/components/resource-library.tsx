'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { RECURSOS } from '@/lib/recursos';
import { Link2, Search, X, Globe, Database, BookText, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle as CardTitleComponent, CardDescription as CardDescriptionComponent } from './ui/card';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { searchElsevier, type ElsevierArticle } from '@/services/elsevier';
import { searchSNRD, type SNRDArticle } from '@/services/snrd';
import { searchScielo, type ScieloArticle } from '@/services/scielo';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Badge } from './ui/badge';

interface ResourceLibraryProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
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


export default function ResourceLibrary({ isOpen, onOpenChange }: ResourceLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [elsevierResults, setElsevierResults] = useState<ElsevierArticle[]>([]);
  const [snrdResults, setSnrdResults] = useState<SNRDArticle[]>([]);
  const [scieloResults, setScieloResults] = useState<ScieloArticle[]>([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);

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
                                  <span className="text-sm text-foreground">{resource.title}</span>
                                </a>
                            ))}
                        </div>
                      ) : (
                        <p className="text-center text-sm text-muted-foreground py-10">
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
                                            {snrdResults.map((article, index) => (
                                                <a
                                                    key={article.handle || index}
                                                    href={article.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={cn( "flex flex-col gap-0.5 py-1.5 px-2 rounded-md hover:bg-white", index % 2 !== 0 ? 'bg-muted/40' : 'bg-muted/20' )}
                                                >
                                                    <span className="text-sm font-medium text-foreground">{article.title}</span>
                                                    <span className="text-xs text-muted-foreground">{article.authors.join(', ')}</span>
                                                    <span className="text-xs text-muted-foreground italic">{article.publication}</span>
                                                </a>
                                            ))}
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
                                            {scieloResults.map((article, index) => (
                                                <a
                                                    key={article.id || index}
                                                    href={article.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={cn( "flex flex-col gap-0.5 py-1.5 px-2 rounded-md hover:bg-white", index % 2 !== 0 ? 'bg-muted/40' : 'bg-muted/20' )}
                                                >
                                                    <span className="text-sm font-medium text-foreground">{article.title}</span>
                                                    <span className="text-xs text-muted-foreground">{article.authors.join(', ')}</span>
                                                    <span className="text-xs text-muted-foreground italic">{article.journal}</span>
                                                </a>
                                            ))}
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
                                            {elsevierResults.map((article, index) => (
                                                <a
                                                    key={article.doi || index}
                                                    href={article.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={cn( "flex flex-col gap-0.5 py-1.5 px-2 rounded-md hover:bg-white", index % 2 !== 0 ? 'bg-muted/40' : 'bg-muted/20' )}
                                                >
                                                    <span className="text-sm font-medium text-foreground">{article.title}</span>
                                                    <span className="text-xs text-muted-foreground">{article.authors}</span>
                                                    <span className="text-xs text-muted-foreground italic">{article.publicationName}</span>
                                                </a>
                                            ))}
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
