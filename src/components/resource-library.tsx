'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { RECURSOS } from '@/lib/recursos';
import { Link2, Search, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle as CardTitleComponent, CardDescription as CardDescriptionComponent } from './ui/card';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';
import { Button } from './ui/button';

interface ResourceLibraryProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const removeAccents = (str: string): string => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function ResourceLibrary({ isOpen, onOpenChange }: ResourceLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const sortedResources = useMemo(() => {
    const allResources = [...RECURSOS].sort((a, b) => a.title.localeCompare(b.title));

    if (!searchQuery) {
      return allResources;
    }

    const normalizedQuery = removeAccents(searchQuery.toLowerCase());
    
    return allResources.filter(resource => 
      removeAccents(resource.title.toLowerCase()).includes(normalizedQuery)
    );
  }, [searchQuery]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0">
          <DialogTitle className="sr-only">Biblioteca de Recursos</DialogTitle>
          <DialogDescription className="sr-only">
            Una colección de enlaces útiles y recursos externos, ordenados alfabéticamente.
          </DialogDescription>
          <Card className="w-full h-full flex flex-col border-0 rounded-lg">
              <CardHeader>
                  <CardTitleComponent>Biblioteca de Recursos</CardTitleComponent>
                  <CardDescriptionComponent>
                      Una colección de enlaces útiles y recursos externos, ordenados alfabéticamente.
                  </CardDescriptionComponent>
                  <div className="pt-2 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar en la biblioteca..."
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
                      {sortedResources.length > 0 ? (
                        <div className="flex flex-col">
                            {sortedResources.map((resource, index) => (
                                <a
                                  key={resource.url}
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    "flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-white",
                                    index % 2 === 0 ? 'bg-muted/20' : 'bg-[#cceeff]/40'
                                  )}
                                >
                                  <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm text-foreground">{resource.title}</span>
                                </a>
                            ))}
                        </div>
                      ) : (
                        <p className="text-center text-sm text-muted-foreground py-10">
                          No se encontraron recursos que coincidan con tu búsqueda.
                        </p>
                      )}
                  </ScrollArea>
              </CardContent>
          </Card>
      </DialogContent>
    </Dialog>
  );
}
