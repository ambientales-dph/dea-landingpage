'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { RECURSOS } from '@/lib/recursos';
import { Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle as CardTitleComponent, CardDescription as CardDescriptionComponent } from './ui/card';
import { cn } from '@/lib/utils';

interface ResourceLibraryProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function ResourceLibrary({ isOpen, onOpenChange }: ResourceLibraryProps) {
  const sortedResources = [...RECURSOS].sort((a, b) =>
    a.title.localeCompare(b.title)
  );

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
              </CardHeader>
              <CardContent className="flex-grow min-h-0">
                  <ScrollArea className="h-full pr-4">
                      <div className="flex flex-col">
                          {sortedResources.map((resource, index) => (
                              <a
                                key={resource.url}
                                href={resource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50",
                                  index % 2 === 0 ? 'bg-muted/20' : 'bg-[#cceeff]/40'
                                )}
                              >
                                <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm text-foreground">{resource.title}</span>
                              </a>
                          ))}
                      </div>
                  </ScrollArea>
              </CardContent>
          </Card>
      </DialogContent>
    </Dialog>
  );
}
