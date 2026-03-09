import { FileText, ImageIcon, Video, Music, FileQuestion } from 'lucide-react';
import type { AssociatedFile } from '@/types';

export function FileIcon({ type }: { type: AssociatedFile['type'] }) {
  const className = "h-4 w-4 text-zinc-600";
  switch (type) {
    case 'document':
      return <FileText className={className} />;
    case 'image':
      return <ImageIcon className={className} />;
    case 'video':
      return <Video className={className} />;
    case 'audio':
      return <Music className={className} />;
    default:
      return <FileQuestion className={className} />;
  }
}
