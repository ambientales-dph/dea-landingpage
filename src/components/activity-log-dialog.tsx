'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useFirestore } from '@/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';

interface Activity {
  id: string;
  userName: string;
  userEmail: string;
  userPhoto: string;
  actionType: string;
  projectName: string;
  timestamp: any;
}

interface ActivityLogDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ActivityLogDialog({ isOpen, onOpenChange }: ActivityLogDialogProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const db = useFirestore();

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

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'create_project': return 'CREACIÓN';
      case 'attach_resource': return 'RECURSO';
      case 'update_project': return 'EDICIÓN';
      default: return type.toUpperCase();
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'create_project': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'attach_resource': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[70vh] flex flex-col p-0 overflow-hidden border-0">
        <DialogHeader className="p-4 bg-muted/30 border-b">
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            Bitácora de Actividad del Portal
            {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </DialogTitle>
        </DialogHeader>
        
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
                {activities.map((activity) => (
                  <TableRow key={activity.id} className="hover:bg-muted/30 border-b border-muted/20">
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
                      {activity.projectName}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!isLoading && activities.length === 0 && (
              <div className="p-8 text-center text-[10px] text-muted-foreground italic">
                No se registran actividades en el portal aún.
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
