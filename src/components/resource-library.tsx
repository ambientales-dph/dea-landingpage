
'use client';

import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { RECURSOS } from '@/lib/recursos';
import { Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';

interface ResourceLibraryProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function ResourceLibrary({ isOpen, onOpenChange }: ResourceLibraryProps) {
  const groupedResources = RECURSOS.reduce((acc, resource) => {
    const { category } = resource;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(resource);
    return acc;
  }, {} as Record<string, typeof RECURSOS>);

  const sortedCategories = Object.keys(groupedResources).sort();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0">
          <Card className="w-full h-full flex flex-col border-0 rounded-lg">
              <CardHeader>
                  <CardTitle>Biblioteca de Recursos</CardTitle>
                  <CardDescription>
                      Una colección de enlaces útiles y recursos externos, ordenados alfabéticamente.
                  </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow min-h-0">
                  <ScrollArea className="h-full pr-4">
                      <div className="space-y-6">
                          {sortedCategories.map(category => (
                              <div key={category}>
                                  <h3 className="text-lg font-semibold text-primary mb-3 sticky top-0 bg-card/95 backdrop-blur-sm py-1">{category}</h3>
                                  <div className="flex flex-col gap-1">
                                      {groupedResources[category].map((resource) => (
                                          <a
                                            key={resource.url}
                                            href={resource.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-start gap-3 p-2 rounded-md hover:bg-muted"
                                          >
                                            <Link2 className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                                            <span className="text-sm text-foreground">{resource.title}</span>
                                          </a>
                                      ))}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </ScrollArea>
              </CardContent>
          </Card>
      </DialogContent>
    </Dialog>
  );
}
