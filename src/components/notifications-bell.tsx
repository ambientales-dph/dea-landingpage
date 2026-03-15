
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Bell, Loader2 } from 'lucide-react';
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
import { useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface CombinedAction {
    id: string;
    type: string;
    source: 'trello' | 'portal';
    date: Date;
    text: string;
    userName: string;
    userAvatar?: string;
    cardId?: string;
}

interface NotificationsBellProps {
    onNotificationClick: (card: TrelloCard) => void;
}

export default function NotificationsBell({ onNotificationClick }: NotificationsBellProps) {
    const [notifications, setNotifications] = useState<CombinedAction[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [lastViewedAt, setLastViewedAt] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const db = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();

    const [allActions, setAllActions] = useState<{trello: CombinedAction[], portal: CombinedAction[]}>({ trello: [], portal: [] });

    const formatTrelloAction = (a: TrelloBoardAction): string => {
        const cardName = a.data.card ? `"${a.data.card.name}"` : 'una tarjeta';
        if (a.type === 'commentCard') return `comentó en ${cardName}`;
        if (a.type === 'updateCard' && a.data.listAfter) return `movió ${cardName} a ${a.data.listAfter.name}`;
        if (a.type === 'addAttachmentToCard') return `adjuntó un archivo en ${cardName}`;
        if (a.type === 'createCard') return `creó la tarjeta ${cardName}`;
        if (a.type === 'updateCard' && a.data.old && 'cover' in a.data.old) return `cambió la portada de ${cardName}`;
        return `realizó una acción en ${cardName}`;
    };

    const filterDuplicateActions = (actions: CombinedAction[]): CombinedAction[] => {
        return actions.filter((action, index, self) => {
            if (action.source === 'trello') {
                const cardNameMatch = action.text.match(/"([^"]+)"/);
                const cardName = cardNameMatch ? cardNameMatch[1] : null;

                if (cardName) {
                    const isAutomated = ['createCard', 'addAttachmentToCard', 'updateCard'].includes(action.type);
                    if (isAutomated) {
                        const hasPortalEquivalent = self.some(other => 
                            other.source === 'portal' && 
                            other.text.includes(`"${cardName}"`) &&
                            Math.abs(other.date.getTime() - action.date.getTime()) < 120000 
                        );
                        if (hasPortalEquivalent) return false;
                    }
                }
            }
            return true;
        });
    };

    useEffect(() => {
        const stored = localStorage.getItem('notifications_last_viewed');
        if (stored) setLastViewedAt(parseInt(stored, 10));
    }, []);

    useEffect(() => {
        const count = notifications.filter(n => n.date.getTime() > lastViewedAt).length;
        setUnreadCount(count);
    }, [notifications, lastViewedAt]);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            const now = Date.now();
            setLastViewedAt(now);
            setUnreadCount(0);
            localStorage.setItem('notifications_last_viewed', now.toString());
        }
    };

    useEffect(() => {
        if (!db || !user) return;
        
        setIsLoading(true);
        
        const q = query(collection(db, 'app_activities'), orderBy('timestamp', 'desc'), limit(50));
        const unsubscribePortal = onSnapshot(q, (snapshot) => {
            const eightHoursAgo = Date.now() - 8 * 60 * 60 * 1000;
            const portalActions: CombinedAction[] = snapshot.docs
                .map(doc => {
                    const data = doc.data();
                    const date = data.timestamp?.toDate() || new Date();
                    
                    if (date.getTime() < eightHoursAgo) return null;
                    
                    if (data.actionType === 'export_card') return null;

                    let actionText = '';
                    if (data.actionType === 'create_project') {
                        actionText = `creó el proyecto "${data.projectName}" desde el portal`;
                    } else if (data.actionType === 'attach_resource') {
                        actionText = `adjuntó un recurso en "${data.projectName}" desde el portal`;
                    } else if (data.actionType === 'update_project') {
                        actionText = `editó el proyecto "${data.projectName}" desde el portal`;
                    } else if (data.actionType === 'update_cover') {
                        actionText = `cambió la portada de "${data.projectName}" desde el portal`;
                    } else if (data.actionType === 'update_labels') {
                        actionText = `actualizó etiquetas de "${data.projectName}" desde el portal`;
                    } else if (data.actionType === 'add_comment') {
                        actionText = `comentó en "${data.projectName}" desde el portal`;
                    } else if (data.actionType === 'remove_attachment') {
                        actionText = `quitó un adjunto de "${data.projectName}" desde el portal`;
                    } else if (data.actionType === 'status_change') {
                        actionText = `cambió el hito/estado de "${data.projectName}" desde el portal`;
                    } else if (data.actionType === 'timeline_milestone_created') {
                        actionText = `creó un hito en la línea de tiempo de "${data.projectName}"`;
                    } else if (data.actionType === 'milestone_files_added') {
                        actionText = `subió nuevos archivos al hito de "${data.projectName}"`;
                    } else if (data.actionType === 'timeline_milestone_deleted') {
                        actionText = `eliminó un hito de la línea de tiempo de "${data.projectName}"`;
                    } else {
                        actionText = `actualizó el proyecto "${data.projectName}" desde el portal`;
                    }

                    return {
                        id: doc.id,
                        source: 'portal',
                        type: data.actionType,
                        date: date,
                        userName: data.userName,
                        userAvatar: data.userPhoto,
                        cardId: data.cardId,
                        text: actionText,
                    };
                })
                .filter((a): a is CombinedAction => a !== null);
            
            setAllActions(prev => {
                const updated = { ...prev, portal: portalActions };
                const combined = [...updated.trello, ...updated.portal]
                    .sort((a, b) => b.date.getTime() - a.date.getTime());
                
                const filtered = filterDuplicateActions(combined);
                setNotifications(filtered);
                return updated;
            });
            setIsLoading(false);
        }, (error) => {
            console.warn('Error en snapshot de actividades:', error.message);
        });

        const fetchTrello = async () => {
            try {
                const trelloRaw = await getAllRecentActions(8);
                const trelloActions: CombinedAction[] = trelloRaw.map(a => ({
                    id: a.id,
                    source: 'trello',
                    type: a.type,
                    date: new Date(a.date),
                    userName: a.memberCreator.fullName,
                    userAvatar: a.memberCreator.avatarUrl ? `${a.memberCreator.avatarUrl}/50.png` : undefined,
                    cardId: a.data.card?.id,
                    text: formatTrelloAction(a),
                }));
                
                setAllActions(prev => {
                    const updated = { ...prev, trello: trelloActions };
                    const combined = [...updated.trello, ...updated.portal]
                        .sort((a, b) => b.date.getTime() - a.date.getTime());
                    
                    const filtered = filterDuplicateActions(combined);
                    setNotifications(filtered);
                    return updated;
                });
            } catch (e) {
                console.error("Error fetching Trello actions:", e);
            }
        };

        fetchTrello();
        const interval = setInterval(fetchTrello, 3 * 60 * 1000);

        return () => {
            unsubscribePortal();
            clearInterval(interval);
        };
    }, [db, user]);

    const handleSelect = async (action: CombinedAction) => {
        if (action.cardId) {
            try {
                const card = await getCardById(action.cardId);
                onNotificationClick(card);
            } catch (e) {
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudo abrir la tarjeta.' });
            }
        }
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-primary-foreground">
                    <Bell className="h-6 w-6" />
                    {unreadCount > 0 && (
                         <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center rounded-full p-0 text-[10px] animate-in zoom-in-50">
                            {unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 md:w-96 max-h-[60vh] overflow-hidden flex flex-col p-0">
                <div className="overflow-y-auto flex-1">
                    {isLoading && notifications.length === 0 && (
                        <div className="p-8 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {notifications.length > 0 ? (
                        notifications.map(action => (
                            <DropdownMenuItem key={action.id} onSelect={() => handleSelect(action)} className="h-auto items-start gap-3 py-3 px-4 cursor-pointer border-b last:border-0 hover:bg-muted/50 focus:bg-muted/50">
                               <Avatar className="h-8 w-8 mt-1 border">
                                    <AvatarImage src={action.userAvatar} />
                                    <AvatarFallback className="text-[10px]">{action.userName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 text-xs whitespace-normal">
                                    <p className="leading-relaxed">
                                        <span className="font-semibold">{action.userName}</span>{' '}
                                        <span className="text-muted-foreground">{action.text}</span>
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-[10px] text-muted-foreground">
                                            {formatDistanceToNow(action.date, { addSuffix: true, locale: es })}
                                        </span>
                                        {action.source === 'portal' && (
                                            <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-primary/30 text-primary uppercase font-bold">Portal</Badge>
                                        )}
                                    </div>
                                </div>
                            </DropdownMenuItem>
                        ))
                    ) : !isLoading && (
                        <div className="p-8 text-center">
                            <p className="text-sm text-muted-foreground">No hay actividad reciente.</p>
                        </div>
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
