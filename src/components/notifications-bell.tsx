
'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { getAllRecentActions, TrelloBoardAction, getCardById, TrelloCard } from '@/services/trello';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from './ui/skeleton';

interface NotificationsBellProps {
    onNotificationClick: (card: TrelloCard) => void;
}

export default function NotificationsBell({ onNotificationClick }: NotificationsBellProps) {
    const [notifications, setNotifications] = useState<TrelloBoardAction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const fetchNotifications = async () => {
            setIsLoading(true);
            const actions = await getAllRecentActions(48); // Last 48 hours
            setNotifications(actions);
            setIsLoading(false);
        };

        fetchNotifications();
        // Refresh every 5 minutes
        const interval = setInterval(fetchNotifications, 5 * 60 * 1000); 

        return () => clearInterval(interval);
    }, []);

    const handleNotificationSelect = async (cardId: string) => {
        setIsOpen(false);
        try {
            const card = await getCardById(cardId);
            onNotificationClick(card);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error al cargar tarjeta',
                description: 'No se pudo encontrar la tarjeta seleccionada.',
            });
        }
    };
    
    const formatActionText = (action: TrelloBoardAction): string => {
        const cardName = `"${action.data.card.name}"`;
        switch (action.type) {
            case 'commentCard': return `comentó en ${cardName}`;
            case 'createCard': return `creó la tarjeta ${cardName}`;
            case 'updateCard':
                if (action.data.listBefore && action.data.listAfter) {
                    return `movió ${cardName} de ${action.data.listBefore.name} a ${action.data.listAfter.name}`;
                }
                if (action.data.old?.name) {
                    return `renombró una tarjeta a ${cardName}`;
                }
                 if (action.data.old?.desc) {
                    return `actualizó la descripción de ${cardName}`;
                }
                return `actualizó ${cardName}`;
            case 'addAttachmentToCard': return `adjuntó un archivo a ${cardName}`;
            case 'moveCardToBoard': return `movió ${cardName} al tablero ${action.data.board.name}`;
            default: return `realizó una acción en ${cardName}`;
        }
    };


    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-primary-foreground hover:bg-primary/80">
                    <Bell className="h-6 w-6" />
                    { !isLoading && notifications.length > 0 && (
                         <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center rounded-full p-0 text-xs">
                            {notifications.length > 9 ? '9+' : notifications.length}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 md:w-96">
                <DropdownMenuLabel>Notificaciones recientes</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isLoading ? (
                    <div className="p-2 space-y-3">
                       {[...Array(3)].map((_, i) => (
                           <div className="flex items-start space-x-2 px-2" key={i}>
                               <Skeleton className="h-8 w-8 rounded-full" />
                               <div className="space-y-1.5 flex-1">
                                   <Skeleton className="h-3 w-4/5" />
                                   <Skeleton className="h-3 w-1/2" />
                               </div>
                           </div>
                       ))}
                    </div>
                ) : notifications.length > 0 ? (
                    notifications.map(action => (
                        <DropdownMenuItem key={action.id} onSelect={() => handleNotificationSelect(action.data.card.id)} className="h-auto items-start gap-3 py-2 cursor-pointer">
                           <Avatar className="h-8 w-8 mt-1">
                                <AvatarImage src={action.memberCreator.avatarUrl ? `${action.memberCreator.avatarUrl}/50.png` : undefined} alt={action.memberCreator.fullName} />
                                <AvatarFallback>{action.memberCreator.fullName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-xs whitespace-normal">
                                <p>
                                    <span className="font-semibold">{action.memberCreator.fullName}</span>
                                    {' '}
                                    {formatActionText(action)}
                                </p>
                                <p className="text-muted-foreground text-[10px] mt-0.5">
                                    {formatDistanceToNow(new Date(action.date), { addSuffix: true, locale: es })}
                                </p>
                            </div>
                        </DropdownMenuItem>
                    ))
                ) : (
                    <p className="p-4 text-center text-sm text-muted-foreground">No hay notificaciones nuevas.</p>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

    