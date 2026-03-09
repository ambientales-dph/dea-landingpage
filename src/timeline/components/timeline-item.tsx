import type { Milestone } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { FileIcon } from './file-icon';
import { Badge } from './ui/badge';
import { Clock, Tag, Loader2, FolderKanban } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface TimelineItemProps {
  milestone: Milestone;
}

export function TimelineItem({ milestone }: TimelineItemProps) {
  const timeAgo = formatDistanceToNow(parseISO(milestone.occurredAt), { addSuffix: true, locale: es });
  const firstFile = milestone.associatedFiles[0];

  return (
    <Card 
      className="transition-shadow duration-300 hover:shadow-lg"
      style={{ borderLeft: `4px solid ${milestone.category.color}` }}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {firstFile ? <FileIcon type={firstFile.type} /> : <FolderKanban className="h-8 w-8 text-muted-foreground" />}
            <div>
              <CardTitle className="text-base font-medium font-headline">{milestone.name}</CardTitle>
              <CardDescription className="text-xs">
                {milestone.associatedFiles.length} {milestone.associatedFiles.length === 1 ? 'archivo adjunto' : 'archivos adjuntos'}
              </CardDescription>
            </div>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo}
          </div>
        </div>
      </CardHeader>
      <CardContent>
         <p className="text-sm text-muted-foreground mb-4">{milestone.description}</p>
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-wrap gap-2 items-center">
            {milestone.tags === null ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generando etiquetas...</span>
              </div>
            ) : milestone.tags.length > 0 ? (
              milestone.tags.map(tag => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No hay etiquetas disponibles.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
