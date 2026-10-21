import { FileText, ImageIcon, Video, Music, FileQuestion } from 'lucide-react';
import type { AssociatedFile } from '@/timeline/types';

export function FileIcon({ type, className }: { type: AssociatedFile['type']; className?: string }) {
  const finalClass = className || "h-4 w-4 text-zinc-600";
  switch (type) {
    case 'document':
      return <FileText className={finalClass} />;
    case 'image':
      return <ImageIcon className={finalClass} />;
    case 'video':
      return <Video className={finalClass} />;
    case 'audio':
      return <Music className={finalClass} />;
    default:
      return <FileQuestion className={finalClass} />;
  }
}
