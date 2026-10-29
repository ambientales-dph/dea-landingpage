'use client';

import { useState, useEffect, useMemo } from 'react';
import { Bell, Loader2, ExternalLink } from 'lucide-react';
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
import { getDatabusFirestore } from '@/firebase/databus-client';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface CombinedAction {
    id: string;
    type: string;
    source: 'trello' | 'portal' | 'databus';
    date: Date;
    text: string;
    userName: string;
    userAvatar?: string;
    cardId?: string;
    stationName?: string;
    reportOid?: string;
    details?: string;
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

    const [allActions, setAllActions] = useState<{
        trello: CombinedAction[];
        portal: CombinedAction[];
        databus: CombinedAction[];
    }>({ trello: [], portal: [], databus: [] });

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
        const seenIds = new Set<string>();
        return actions.filter((action) => {
            if (seenIds.has(action.id)) return false;
            seenIds.add(action.id);
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
        if (!user) return;
        setIsLoading(true);

        const eightHoursAgo = Date.now() - 24 * 60 * 60 * 1000; // Últimas 24 hs

        // 1. Suscripción a actividades del Portal DEA (backend local)
        let unsubPortal: (() => void) | null = null;
        if (db) {
            const q = query(collection(db, 'app_activities'), orderBy('timestamp', 'desc'), limit(50));
            unsubPortal = onSnapshot(q, (snapshot) => {
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
                            id: `portal-${doc.id}`,
                            source: 'portal',
                            type: data.actionType,
                            date: date,
                            userName: data.userName || 'Usuario',
                            userAvatar: data.userPhoto,
                            cardId: data.cardId,
                            text: actionText,
                            stationName: data.stationName,
                            reportOid: data.reportOid,
                            details: data.details,
                        };
                    })
                    .filter((a): a is CombinedAction => a !== null);

                setAllActions(prev => {
                    const updated = { ...prev, portal: portalActions };
                    const combined = [...updated.trello, ...updated.portal, ...updated.databus]
                        .sort((a, b) => b.date.getTime() - a.date.getTime());
                    setNotifications(filterDuplicateActions(combined));
                    return updated;
                });
                setIsLoading(false);
            }, (error) => {
                console.warn('[Notifications] Error snapshot Portal:', error.message);
            });
        }

        // 2. Suscripción a actividades de DEA Data Bus (backend remoto de campo)
        let unsubDataBus: (() => void) | null = null;
        const databusDb = getDatabusFirestore();
        if (databusDb) {
            const qDdb = query(collection(databusDb, 'app_activities'), orderBy('timestamp', 'desc'), limit(50));
            unsubDataBus = onSnapshot(qDdb, (snapshot) => {
                const databusActions: CombinedAction[] = snapshot.docs
                    .map(doc => {
                        const data = doc.data();
                        const date = data.timestamp?.toDate() || new Date();
                        if (date.getTime() < eightHoursAgo) return null;

                        let actionText = '';
                        if (data.actionType === 'data_bus_report_created') {
                            actionText = `inició el reporte ${data.reportOid ? `[${data.reportOid}]` : ''} en "${data.stationName || 'estación de campo'}" (${data.projectName || 'DPH'})`;
                        } else if (data.actionType === 'data_bus_samples_uploaded') {
                            actionText = `cargó mediciones de campo ${data.details ? `(${data.details})` : ''} en "${data.stationName || 'estación'}"`;
                        } else if (data.actionType === 'data_bus_photos_uploaded') {
                            actionText = `subió evidencia fotográfica de campo en "${data.stationName || 'estación'}"${data.details ? ` (${data.details})` : ''}`;
                        } else if (data.actionType === 'data_bus_survey_created') {
                            actionText = `inició la campaña de campo "${data.projectName || data.details || 'Campaña DPH'}"`;
                        } else {
                            actionText = `registró actividad de campo en "${data.stationName || 'estación'}"`;
                        }

                        return {
                            id: `ddb-${doc.id}`,
                            source: 'databus',
                            type: data.actionType || 'databus',
                            date: date,
                            userName: data.userName || 'Técnico de Campo',
                            userAvatar: data.userPhoto,
                            cardId: data.cardId,
                            text: actionText,
                            stationName: data.stationName,
                            reportOid: data.reportOid,
                            details: data.details,
                        };
                    })
                    .filter((a): a is CombinedAction => a !== null);

                setAllActions(prev => {
                    const updated = { ...prev, databus: databusActions };
                    const combined = [...updated.trello, ...updated.portal, ...updated.databus]
                        .sort((a, b) => b.date.getTime() - a.date.getTime());
                    setNotifications(filterDuplicateActions(combined));
                    return updated;
                });
                setIsLoading(false);
            }, (error) => {
                console.warn('[Notifications] Error snapshot Data Bus:', error.message);
            });
        }

        // 3. Consulta periódica a Trello
        const fetchTrello = async () => {
            try {
                const trelloRaw = await getAllRecentActions(8);
                const trelloActions: CombinedAction[] = trelloRaw.map(a => ({
                    id: `trello-${a.id}`,
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
                    const combined = [...updated.trello, ...updated.portal, ...updated.databus]
                        .sort((a, b) => b.date.getTime() - a.date.getTime());
                    setNotifications(filterDuplicateActions(combined));
                    return updated;
                });
            } catch (e) {
                console.error("[Notifications] Error fetching Trello actions:", e);
            }
        };

        fetchTrello();
        const interval = setInterval(fetchTrello, 3 * 60 * 1000);

        return () => {
            if (unsubPortal) unsubPortal();
            if (unsubDataBus) unsubDataBus();
            clearInterval(interval);
        };
    }, [db, user]);

    const databusUrl = process.env.NEXT_PUBLIC_DATABUS_URL || 'https://dea-data-bus--studio-7793356696-41de0.us-east4.hosted.app';

    const handleSelect = async (action: CombinedAction) => {
        if (action.cardId) {
            try {
                const card = await getCardById(action.cardId);
                onNotificationClick(card);
            } catch (e) {
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudo abrir la tarjeta.' });
            }
        } else if (action.source === 'databus') {
            toast({
                title: action.stationName ? `Monitoreo en ${action.stationName}` : 'Actividad DEA Data Bus',
                description: (
                    <div className="space-y-2 mt-1">
                        <p>{action.text}</p>
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            className="h-7 text-xs flex items-center gap-1.5 w-full justify-center mt-1"
                            onClick={() => window.open(databusUrl, '_blank')}
                        >
                            <span>Abrir DEA Data Bus en vivo</span>
                            <ExternalLink className="h-3 w-3" />
                        </Button>
                    </div>
                ),
            });
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
                                        {action.source === 'databus' && (
                                            <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-teal-500/50 text-teal-600 dark:text-teal-400 bg-teal-500/10 uppercase font-bold">Data Bus</Badge>
                                        )}
                                        {action.source === 'portal' && (
                                            <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-primary/30 text-primary uppercase font-bold">Portal</Badge>
                                        )}
                                        {action.source === 'trello' && (
                                            <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-blue-500/30 text-blue-600 dark:text-blue-400 uppercase font-bold">Trello</Badge>
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
