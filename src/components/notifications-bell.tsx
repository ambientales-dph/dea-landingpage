'use client';

import { useState, useEffect } from 'react';
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
import { useFirestore } from '@/firebase';
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
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const db = useFirestore();
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
        setIsLoading(true);
        
        const q = query(collection(db, 'app_activities'), orderBy('timestamp', 'desc'), limit(20));
        const unsubscribePortal = onSnapshot(q, (snapshot) => {
            const portalActions: CombinedAction[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    source: 'portal',
                    type: data.actionType,
                    date: data.timestamp?.toDate() || new Date(),
                    userName: data.userName,
                    userAvatar: data.userPhoto,
                    cardId: data.cardId,
                    text: data.actionType === 'create_project' 
                        ? `creó el proyecto "${data.projectName}" desde el portal`
                        : `actualizó el proyecto "${data.projectName}" desde el portal`,
                };
            });
            
            setAllActions(prev => {
                const updated = { ...prev, portal: portalActions };
                const combined = [...updated.trello, ...updated.portal]
                    .sort((a, b) => b.date.getTime() - a.date.getTime());
                
                const filtered = filterDuplicateActions(combined).slice(0, 30);
                setNotifications(filtered);
                return updated;
            });
        });

        const fetchTrello = async () => {
            try {
                const trelloRaw = await getAllRecentActions(24);
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
                    
                    const filtered = filterDuplicateActions(combined).slice(0, 30);
                    setNotifications(filtered);
                    return updated;
                });
            } catch (e) {
                console.error("Error fetching Trello actions:", e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTrello();
        const interval = setInterval(fetchTrello, 5 * 60 * 1000);

        return () => {
            unsubscribePortal();
            clearInterval(interval);
        };
    }, [db]);

    const handleSelect = async (action: CombinedAction) => {
        setIsOpen(false);
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
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-primary-foreground">
                    <Bell className="h-6 w-6" />
                    {notifications.length > 0 && (
                         <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center rounded-full p-0 text-[10px]">
                            {notifications.length}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 md:w-96 max-h-[60vh] overflow-y-auto">
                <DropdownMenuLabel className="flex justify-between items-center">
                    <span>Notificaciones</span>
                    {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length > 0 ? (
                    notifications.map(action => (
                        <DropdownMenuItem key={action.id} onSelect={() => handleSelect(action)} className="h-auto items-start gap-3 py-2 cursor-pointer">
                           <Avatar className="h-8 w-8 mt-1 border">
                                <AvatarImage src={action.userAvatar} />
                                <AvatarFallback className="text-[10px]">{action.userName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-xs whitespace-normal">
                                <p>
                                    <span className="font-semibold">{action.userName}</span>{' '}
                                    <span className="text-muted-foreground">{action.text}</span>
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-muted-foreground">
                                        {formatDistanceToNow(action.date, { addSuffix: true, locale: es })}
                                    </span>
                                    {action.source === 'portal' && (
                                        <Badge variant="outline" className="text-[8px] h-3 px-1 border-primary/30 text-primary uppercase">Portal</Badge>
                                    )}
                                </div>
                            </div>
                        </DropdownMenuItem>
                    ))
                ) : (
                    <p className="p-4 text-center text-sm text-muted-foreground">No hay actividad reciente.</p>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
