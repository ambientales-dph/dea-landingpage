'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { getCardById, getCardActivity, type TrelloCard, type TrelloAction } from '@/services/trello';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Clock, 
    ArrowLeft, 
    MessageSquare, 
    ArrowRightLeft, 
    FileUp, 
    PlusCircle, 
    History, 
    Flag, 
    Loader2, 
    Search,
    ChevronDown,
    MapPin,
    ExternalLink
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface UnifiedEvent {
    id: string;
    date: Date;
    type: string;
    source: 'trello' | 'portal';
    userName: string;
    userPhoto?: string;
    text: string;
    detail?: string;
    projectName?: string;
    listBefore?: string;
    listAfter?: string;
}

export default function TimelinePage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user, loading } = useUser();
    const db = useFirestore();
    const cardId = searchParams.get('cardId');

    const [events, setEvents] = useState<UnifiedEvent[]>([]);
    const [selectedProject, setSelectedProject] = useState<TrelloCard | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    const fetchHistory = async () => {
        setIsInitialLoading(true);
        try {
            let combinedEvents: UnifiedEvent[] = [];

            // 1. Obtener eventos de Firestore (Portal)
            const activitiesRef = collection(db, 'app_activities');
            let q;
            if (cardId) {
                q = query(activitiesRef, where('cardId', '==', cardId), orderBy('timestamp', 'desc'));
            } else {
                q = query(activitiesRef, orderBy('timestamp', 'desc'), limit(100));
            }
            
            const portalSnap = await getDocs(q);
            const portalEvents: UnifiedEvent[] = portalSnap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    date: data.timestamp?.toDate() || new Date(),
                    source: 'portal',
                    type: data.actionType,
                    userName: data.userName,
                    userPhoto: data.userPhoto,
                    projectName: data.projectName,
                    text: data.detail || `Acción: ${data.actionType}`,
                };
            });
            combinedEvents = [...portalEvents];

            // 2. Obtener eventos de Trello si hay un proyecto seleccionado
            if (cardId) {
                const [card, trelloActions] = await Promise.all([
                    getCardById(cardId),
                    getCardActivity(cardId)
                ]);
                setSelectedProject(card);

                const trelloEvents: UnifiedEvent[] = trelloActions.map(a => {
                    let text = '';
                    if (a.type === 'commentCard') text = a.data.text || '';
                    else if (a.type === 'updateCard' && a.data.listAfter) text = `Movido a ${a.data.listAfter.name}`;
                    else if (a.type === 'addAttachmentToCard') text = `Adjuntó un recurso`;
                    else text = `Acción en Trello: ${a.type}`;

                    return {
                        id: a.id,
                        date: new Date(a.date),
                        source: 'trello',
                        type: a.type,
                        userName: a.memberCreator.fullName,
                        userPhoto: a.memberCreator.avatarUrl ? `${a.memberCreator.avatarUrl}/50.png` : undefined,
                        text: text,
                        listBefore: a.data.listBefore?.name,
                        listAfter: a.data.listAfter?.name,
                    };
                });
                combinedEvents = [...combinedEvents, ...trelloEvents];
            }

            // Ordenar por fecha descendente
            combinedEvents.sort((a, b) => b.date.getTime() - a.date.getTime());
            setEvents(combinedEvents);

        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setIsInitialLoading(false);
        }
    };

    useEffect(() => {
        if (!loading && user) {
            fetchHistory();
        }
    }, [user, loading, cardId]);

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'commentCard':
            case 'add_comment': return <MessageSquare className="h-4 w-4" />;
            case 'updateCard': return <ArrowRightLeft className="h-4 w-4" />;
            case 'addAttachmentToCard':
            case 'attach_resource': return <FileUp className="h-4 w-4" />;
            case 'create_project': return <PlusCircle className="h-4 w-4" />;
            case 'status_change': return <Flag className="h-4 w-4" />;
            default: return <Clock className="h-4 w-4" />;
        }
    };

    const getEventColor = (type: string, source: 'trello' | 'portal') => {
        if (source === 'portal') {
            if (type === 'create_project') return 'bg-green-500';
            if (type === 'status_change') return 'bg-orange-500';
            return 'bg-primary';
        }
        if (type === 'commentCard') return 'bg-blue-500';
        if (type === 'updateCard') return 'bg-purple-500';
        return 'bg-neutral-500';
    };

    if (isInitialLoading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground font-medium">Reconstruyendo la historia...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background">
            <header className="bg-primary p-4 shrink-0 shadow-md">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/20" onClick={() => router.push('/')}>
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold text-primary-foreground leading-none mb-1">
                                {selectedProject ? 'Historial del Proyecto' : 'Bitácora Global'}
                            </h1>
                            <p className="text-xs text-primary-foreground/80 font-medium">
                                {selectedProject ? selectedProject.name : 'Todos los hilos de actividad del Departamento'}
                            </p>
                        </div>
                    </div>
                    {selectedProject && (
                        <Badge variant="outline" className="bg-white/10 text-white border-white/20 px-3 py-1">
                            {selectedProject.boardName}
                        </Badge>
                    )}
                </div>
            </header>

            <main className="flex-1 overflow-hidden flex flex-col">
                <div className="container mx-auto max-w-4xl py-8 px-4 flex-1 flex flex-col min-h-0">
                    {events.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                            <History className="h-16 w-16 text-muted-foreground/30 mb-4" />
                            <h3 className="text-lg font-semibold text-muted-foreground">No hay actividad registrada</h3>
                            <p className="text-sm text-muted-foreground/60">Los hitos y comentarios aparecerán aquí a medida que ocurran.</p>
                        </div>
                    ) : (
                        <ScrollArea className="flex-1 pr-4">
                            <div className="relative pl-8 space-y-8 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-muted-foreground/20">
                                {events.map((event, index) => {
                                    const showDateHeader = index === 0 || 
                                        format(events[index - 1].date, 'yyyy-MM-dd') !== format(event.date, 'yyyy-MM-dd');

                                    return (
                                        <div key={event.id} className="relative">
                                            {showDateHeader && (
                                                <div className="sticky top-0 z-10 py-4 -ml-8 bg-background/95 backdrop-blur-sm">
                                                    <Badge variant="secondary" className="font-bold text-[10px] uppercase tracking-wider bg-muted text-muted-foreground ml-8">
                                                        {format(event.date, "EEEE d 'de' MMMM", { locale: es })}
                                                    </Badge>
                                                </div>
                                            )}
                                            
                                            <div className="flex gap-4 group">
                                                <div className={cn(
                                                    "absolute -left-[25px] mt-1 h-8 w-8 rounded-full border-4 border-background flex items-center justify-center text-white shadow-sm z-10 transition-transform group-hover:scale-110",
                                                    getEventColor(event.type, event.source)
                                                )}>
                                                    {getEventIcon(event.type)}
                                                </div>

                                                <div className="flex-1 bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-all duration-200">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <Avatar className="h-6 w-6 border">
                                                                <AvatarImage src={event.userPhoto} />
                                                                <AvatarFallback className="text-[8px]">{event.userName.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <p className="text-xs font-bold text-foreground leading-tight">{event.userName}</p>
                                                                <p className="text-[10px] text-muted-foreground font-medium">
                                                                    {format(event.date, 'HH:mm')} · {formatDistanceToNow(event.date, { addSuffix: true, locale: es })}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {event.source === 'portal' && (
                                                                <Badge variant="outline" className="text-[8px] h-4 border-primary/20 text-primary font-bold uppercase tracking-tighter">Portal</Badge>
                                                            )}
                                                            {event.source === 'trello' && (
                                                                <Badge variant="outline" className="text-[8px] h-4 border-blue-500/20 text-blue-600 font-bold uppercase tracking-tighter">Trello</Badge>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {!selectedProject && event.projectName && (
                                                        <div className="flex items-center gap-1 mb-2 text-[10px] font-bold text-primary bg-primary/5 p-1 rounded">
                                                            <MapPin className="h-3 w-3" />
                                                            <span className="uppercase">{event.projectName}</span>
                                                        </div>
                                                    )}

                                                    <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                                        {event.text}
                                                    </div>

                                                    {event.listBefore && event.listAfter && (
                                                        <div className="mt-3 flex items-center gap-2 text-[10px] bg-muted/50 p-2 rounded-lg border border-dashed">
                                                            <span className="text-muted-foreground line-through">{event.listBefore}</span>
                                                            <ChevronDown className="h-3 w-3 -rotate-90 text-muted-foreground" />
                                                            <span className="font-bold text-primary">{event.listAfter}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </main>
        </div>
    );
}
