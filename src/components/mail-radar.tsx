
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Mail, Loader2, AlertCircle, ExternalLink, Trash2, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
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
import { useFirestore } from '@/firebase';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { syncGmailAlerts, updateAlertStatus } from '@/app/actions/gmail-actions';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/providers/project-provider';
import { ScrollArea } from './ui/scroll-area';

export default function MailRadar() {
    const [alerts, setAlerts] = useState<any[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const db = useFirestore();
    const { toast } = useToast();
    const { allCards, setSelectedCard } = useProject();

    const unreadCount = useMemo(() => alerts.filter(a => a.status === 'new').length, [alerts]);

    useEffect(() => {
        setIsLoading(true);
        const q = query(
            collection(db, 'mail_alerts'), 
            where('status', '!=', 'dismissed'),
            orderBy('status', 'asc'),
            orderBy('processedAt', 'desc'), 
            limit(20)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAlerts(docs);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db]);

    const handleSync = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isSyncing) return;

        setIsSyncing(true);
        toast({ title: 'Escaneando Gmail...', description: 'La IA está analizando nuevos correos vinculados a obras.' });

        try {
            const projectList = allCards.map(c => {
                const codeMatch = c.name.match(/\(([^)]+)\)$/);
                return {
                    id: c.id,
                    code: codeMatch ? codeMatch[1] : 'S/C',
                    name: c.name.replace(/\([^)]+\)$/, '').trim()
                };
            }).filter(p => p.code !== 'S/C');

            const result = await syncGmailAlerts(projectList);
            if (result.success) {
                if (result.newAlerts > 0) {
                    toast({ title: 'Escaneo finalizado', description: `Se detectaron ${result.newAlerts} correos nuevos relacionados con proyectos.` });
                } else {
                    toast({ title: 'Sin novedades', description: 'No se detectaron nuevos correos vinculados a obras en la bandeja de entrada.' });
                }
            } else {
                toast({ variant: 'destructive', title: 'Error de escaneo', description: result.error });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error de conexión', description: 'No se pudo contactar con el servicio de Gmail.' });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSelectAlert = async (alert: any) => {
        if (alert.cardId) {
            const card = allCards.find(c => c.id === alert.cardId);
            if (card) {
                setSelectedCard(card);
                await updateAlertStatus(alert.id, 'read');
            } else {
                toast({ variant: 'destructive', title: 'Proyecto no encontrado', description: 'La tarjeta vinculada ya no está disponible.' });
            }
        }
    };

    const handleDismiss = async (e: React.MouseEvent, alertId: string) => {
        e.preventDefault();
        e.stopPropagation();
        await updateAlertStatus(alertId, 'dismissed');
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-primary-foreground hover:bg-white/10">
                    <Mail className="h-6 w-6" />
                    {unreadCount > 0 && (
                         <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center rounded-full p-0 text-[10px] bg-red-500 animate-pulse">
                            {unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 md:w-[400px] max-h-[70vh] overflow-hidden flex flex-col p-0 shadow-2xl border-primary/20">
                <DropdownMenuLabel className="flex items-center justify-between p-4 bg-muted/30">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-bold uppercase tracking-tight">Radar de Gmail (Experimental)</span>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleSync} 
                        disabled={isSyncing}
                        className="h-8 text-[10px] gap-2 border-primary/30 text-primary hover:bg-primary/10"
                    >
                        {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        Sincronizar
                    </Button>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="m-0" />
                
                <ScrollArea className="flex-1 overflow-y-auto">
                    {isLoading && alerts.length === 0 && (
                        <div className="p-12 flex flex-col items-center justify-center text-muted-foreground gap-3">
                            <Loader2 className="h-8 w-8 animate-spin opacity-20" />
                            <p className="text-xs italic">Cargando alertas de mail...</p>
                        </div>
                    )}
                    
                    {alerts.length > 0 ? (
                        <div className="flex flex-col">
                            {alerts.map(alert => (
                                <DropdownMenuItem 
                                    key={alert.id} 
                                    onSelect={() => handleSelectAlert(alert)}
                                    className={`flex flex-col items-start gap-1 p-4 border-b last:border-0 cursor-pointer hover:bg-primary/5 transition-colors ${alert.status === 'new' ? 'bg-primary/5' : ''}`}
                                >
                                    <div className="flex items-start justify-between w-full gap-2">
                                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                            <span className="text-[10px] font-bold text-primary flex items-center gap-1 uppercase">
                                                <AlertCircle className="h-3 w-3" />
                                                Vínculo detectado: {alert.detectedProjectCode}
                                            </span>
                                            <p className="text-xs font-semibold truncate text-foreground" title={alert.subject}>{alert.subject}</p>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                                            onClick={(e) => handleDismiss(e, alert.id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                    
                                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed bg-muted/30 p-1.5 rounded w-full">
                                        "{alert.snippet}"
                                    </p>
                                    
                                    <div className="flex items-center justify-between w-full mt-2">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-muted-foreground truncate max-w-[180px]">De: {alert.from}</span>
                                            <span className="text-[9px] text-zinc-400">
                                                {alert.processedAt ? formatDistanceToNow(alert.processedAt.toDate(), { addSuffix: true, locale: es }) : 'Recién'}
                                            </span>
                                        </div>
                                        <Badge variant="outline" className="text-[8px] h-4 gap-1 border-primary/20">
                                            IA: {alert.detectedProjectName}
                                        </Badge>
                                    </div>
                                </DropdownMenuItem>
                            ))}
                        </div>
                    ) : !isLoading && (
                        <div className="p-12 text-center flex flex-col items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                <Mail className="h-6 w-6 text-muted-foreground/40" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium">Bandeja de radar limpia</p>
                                <p className="text-[10px] text-muted-foreground px-8">No hay correos detectados para tus obras. Usá el botón sincronizar para escanear de nuevo.</p>
                            </div>
                        </div>
                    )}
                </ScrollArea>
                
                <DropdownMenuSeparator className="m-0" />
                <div className="p-3 bg-muted/10 text-center">
                    <p className="text-[9px] text-muted-foreground italic flex items-center justify-center gap-1">
                        <Sparkles className="h-2.5 w-2.5" /> El Radar analiza el lenguaje natural para ahorrarte tiempo de carga.
                    </p>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
