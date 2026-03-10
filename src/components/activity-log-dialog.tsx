'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirestore } from '@/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
  userName: string;
  userEmail: string;
  userPhoto: string;
  actionType: string;
  projectName: string;
  detail?: string;
  cardId?: string;
  timestamp: any;
}

interface ActivityLogDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onActivityClick?: (cardId: string) => void;
}

export default function ActivityLogDialog({ isOpen, onOpenChange, onActivityClick }: ActivityLogDialogProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const db = useFirestore();

  useEffect(() => {
    if (!isOpen) {
      const cleanup = () => {
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
      };
      cleanup();
      const timer = setTimeout(cleanup, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    const q = query(
      collection(db, 'app_activities'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Activity[];
      setActivities(docs);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, isOpen]);

  const filteredActivities = useMemo(() => {
    if (!searchTerm.trim()) return activities;
    const term = searchTerm.toLowerCase();
    return activities.filter(activity => 
      activity.userName.toLowerCase().includes(term) || 
      activity.projectName.toLowerCase().includes(term) ||
      (activity.detail && activity.detail.toLowerCase().includes(term))
    );
  }, [activities, searchTerm]);

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'create_project': return 'CREACIÓN';
      case 'attach_resource': return 'RECURSO';
      case 'update_project': return 'EDICIÓN';
      case 'update_cover': return 'PORTADA';
      case 'update_labels': return 'ETIQUETAS';
      case 'add_comment': return 'COMENTARIO';
      case 'remove_attachment': return 'ADJUNTO';
      case 'status_change': return 'HITO/ESTADO';
      case 'export_card': return 'DESCARGA';
      case 'timeline_milestone_created': return 'LT: HITO';
      case 'milestone_files_added': return 'LT: ARCHIVOS';
      case 'timeline_milestone_deleted': return 'LT: ELIMINÓ';
      case 'milestone_file_deleted': return 'LT: QUITÓ';
      default: return type.toUpperCase();
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'create_project': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'attach_resource': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'update_project': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'update_cover': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'update_labels': return 'bg-pink-500/10 text-pink-600 border-pink-500/20';
      case 'add_comment': return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
      case 'remove_attachment': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'status_change': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'export_card': return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20';
      case 'timeline_milestone_created': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'milestone_files_added': return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
      case 'timeline_milestone_deleted': return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      case 'milestone_file_deleted': return 'bg-stone-500/10 text-stone-600 border-stone-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl h-[70vh] flex flex-col p-0 overflow-hidden border-0"
        showCloseButton={false}
        onPointerDownOutside={() => onOpenChange(false)}
      >
        <DialogHeader className="p-4 bg-muted/30 border-b flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            Bitácora de Actividad del Portal
            {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </DialogTitle>
          <div className="flex items-center gap-4">
            <div className="relative w-64 hidden sm:block">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por usuario o proyecto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-[11px] bg-white/50 border-muted focus-visible:ring-primary/30"
              />
              {searchTerm && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 hover:bg-transparent"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </Button>
              )}
            </div>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted/50 rounded-full">
                <X className="h-4 w-4" />
                <span className="sr-only">Cerrar bitácora</span>
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        
        <div className="sm:hidden p-3 border-b bg-muted/10">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-[11px] bg-white border-muted"
            />
          </div>
        </div>

        <ScrollArea className="flex-grow">
          <div className="p-0">
            <Table className="border-collapse">
              <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 text-[9px] uppercase font-bold px-3">Fecha/Hora</TableHead>
                  <TableHead className="h-8 text-[9px] uppercase font-bold px-3">Usuario</TableHead>
                  <TableHead className="h-8 text-[9px] uppercase font-bold px-3 text-center">Acción</TableHead>
                  <TableHead className="h-8 text-[9px] uppercase font-bold px-3">Proyecto / Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActivities.map((activity, index) => (
                  <TableRow 
                    key={activity.id} 
                    className={cn(
                      "hover:bg-muted/40 transition-colors border-b border-muted/20 cursor-pointer group",
                      index % 2 === 0 ? "bg-[#cceeff]/40" : "bg-muted/10"
                    )}
                    onClick={() => {
                      if (activity.cardId) {
                        onActivityClick?.(activity.cardId);
                        onOpenChange(false);
                      }
                    }}
                  >
                    <TableCell className="text-[10px] font-mono whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                      {activity.timestamp ? format(activity.timestamp.toDate(), 'dd/MM/yy HH:mm', { locale: es }) : '---'}
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-4 w-4 border">
                          <AvatarImage src={activity.userPhoto} />
                          <AvatarFallback className="text-[6px]">{activity.userName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-[10px] font-medium leading-none truncate max-w-[120px]">
                          {activity.userName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-center">
                      <Badge 
                        variant="outline" 
                        className={`text-[8px] h-4 px-1 leading-none font-bold ${getActionColor(activity.actionType)}`}
                      >
                        {getActionLabel(activity.actionType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[10px] px-3 py-1.5 truncate max-w-[300px]">
                      <div className="flex flex-col">
                        <span className="font-semibold group-hover:text-primary transition-colors">{activity.projectName}</span>
                        {activity.detail && <span className="text-[9px] text-muted-foreground italic">{activity.detail}</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!isLoading && filteredActivities.length === 0 && (
              <div className="p-8 text-center text-[10px] text-muted-foreground italic">
                {searchTerm ? 'No se encontraron resultados para tu búsqueda.' : 'No se registran actividades en el portal aún.'}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
