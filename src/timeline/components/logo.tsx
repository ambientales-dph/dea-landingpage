import { FolderClock } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2 px-4">
      <FolderClock className="h-7 w-7 text-[#4790b8]" />
      <h1 className="text-xl font-medium font-headline text-[#4790b8]">
        DEA TL
      </h1>
    </div>
  );
}
