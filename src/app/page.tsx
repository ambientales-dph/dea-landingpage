'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  FolderKanban,
  LayoutGrid,
  Waypoints,
  Mail,
  Clock,
  HelpCircle,
  Search,
  FileText,
  Construction,
  Settings,
  Download,
  AlertTriangle,
  Library,
  Bell,
  LogIn,
  LogOut,
  User as UserIcon,
  Loader2,
  ShieldAlert,
  History,
  Info,
  Map as MapIcon,
  ChevronRight,
  Database,
  Globe,
  Zap,
  MousePointer2,
  FileSearch,
} from 'lucide-react';
import MapBackground from '@/components/map-background';
import TrelloConnectionToast from '@/components/trello-connection-toast';
import CardSearch from '@/components/card-search';
import { type TrelloCard, getCardById } from '@/services/trello';
import { searchLocation } from '@/services/nominatim';
import { fromLonLat } from 'ol/proj';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import CreateProjectForm from '@/components/create-project-form';
import ResourceLibrary from '@/components/resource-library';
import ActivityLogDialog from '@/components/activity-log-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal
} from '@/components/ui/dropdown-menu';
import jsPDF from 'jspdf';
import NotificationsBell from '@/components/notifications-bell';
import MailRadar from '@/components/mail-radar';
import { useAuth, useUser } from '@/firebase';
import { loginConGoogle, cerrarSesion, isUserAuthorized, WHITELIST } from '@/services/auth-service';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useProject, INITIAL_MAP_VIEW } from '@/providers/project-provider';
import { useMailNotifications } from '@/hooks/use-mail-notifications';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardIdParam = searchParams.get('cardId');
  const { user, loading } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  const { allCards, selectedCard, setSelectedCard, isLoadingCards, viewState, setViewState } = useProject();

  // Activamos el listener de notificaciones de Gmail en tiempo real
  useMailNotifications();

  const [isHelpPanelOpen, setIsHelpPanelOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isCreateProjectOpen, setCreateProjectOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [userProjects, setUserProjects] = useState<TrelloCard[]>([]);
  const [recentProjects, setRecentProjects] = useState<TrelloCard[]>([]);
  const [isUserProjectsLoading, setIsUserProjectsLoading] = useState(false);
  
  const authorized = user ? isUserAuthorized(user.email) : false;

  useEffect(() => {
    if (user?.uid) {
      const stored = localStorage.getItem(`recent_projects_${user.uid}`);
      if (stored) {
        try {
          setRecentProjects(JSON.parse(stored));
        } catch (e) {
          console.error("Error parsing recent projects", e);
        }
      }
    }
  }, [user?.uid]);

  const updateRecentProjects = useCallback((card: TrelloCard) => {
    if (!user?.uid) return;
    setRecentProjects(prev => {
      const filtered = prev.filter(p => p.id !== card.id);
      const updated = [card, ...filtered].slice(0, 10);
      localStorage.setItem(`recent_projects_${user.uid}`, JSON.stringify(updated));
      return updated;
    });
  }, [user?.uid]);

  const fetchUserProjects = useCallback(async () => {
    if (!user?.email || allCards.length === 0) return;
    setIsUserProjectsLoading(true);
    try {
      const authorizedUser = WHITELIST.find(u => u.email.toLowerCase() === user.email?.toLowerCase());
      if (!authorizedUser?.name) return;
      
      const myName = authorizedUser.name.toLowerCase();
      
      const filtered = allCards.filter(card => {
        return card.desc?.toLowerCase().includes(myName);
      }).sort((a, b) => a.name.localeCompare(b.name));
      
      setUserProjects(filtered);
    } catch (error) {
      console.error("Error filtering user projects:", error);
    } finally {
      setIsUserProjectsLoading(false);
    }
  }, [user?.email, allCards]);

  useEffect(() => {
    if (user && authorized) {
      fetchUserProjects();
    }
  }, [user, authorized, fetchUserProjects]);

  const handleCardSelect = useCallback(async (card: TrelloCard | null) => {
    setSelectedCard(card);

    if (card) {
      updateRecentProjects(card);

      if (card.desc) {
        const match = card.desc.match(/^\s*\\?#\s*(.*)$/m);
        const query = match && match[1] ? match[1].trim() : null;
        
        if (query) {
          try {
            const location = await searchLocation(query);
            if (location) {
              setViewState({
                center: fromLonLat([parseFloat(location.lon), parseFloat(location.lat)]),
                zoom: 14,
              });
            }
          } catch (error) {
            console.error('Error geocoding card description:', error);
            setViewState(INITIAL_MAP_VIEW);
          }
        } else {
          setViewState(INITIAL_MAP_VIEW);
        }
      } else {
        setViewState(INITIAL_MAP_VIEW);
      }
    } else {
      setViewState(INITIAL_MAP_VIEW);
    }
  }, [updateRecentProjects, setSelectedCard, setViewState]);

  useEffect(() => {
    if (cardIdParam && (!selectedCard || selectedCard.id !== cardIdParam)) {
      const cachedCard = allCards.find(c => c.id === cardIdParam);
      if (cachedCard) {
        handleCardSelect(cachedCard);
      } else {
        const syncCardFromUrl = async () => {
          try {
            const card = await getCardById(cardIdParam);
            handleCardSelect(card);
          } catch (error) {
            console.error("Error syncing card from URL:", error);
          }
        };
        syncCardFromUrl();
      }
    }
  }, [cardIdParam, selectedCard, handleCardSelect, allCards]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await loginConGoogle(auth);
      toast({ title: '¡Bienvenido!', description: 'Has iniciado sesión correctamente.' });
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        toast({
          variant: 'destructive',
          title: 'Error de acceso',
          description: error.message || 'No se pudo iniciar sesión.',
        });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await cerrarSesion(auth);
      setSelectedCard(null);
      setViewState(INITIAL_MAP_VIEW);
      toast({ title: 'Sesión cerrada', description: 'Has salido de la aplicación.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cerrar la sesión.' });
    }
  };

  const getProjectInfo = (name: string): { code: string | null; nameWithoutCode: string } => {
    // Regex actualizada para soportar códigos de 2 a 4 letras
    const projectRegex = /\(([A-Z]{2,4}\d{3})\)$/;
    const match = name.match(projectRegex);
    if (match && match[1]) {
        return {
            code: match[1],
            nameWithoutCode: name.replace(projectRegex, '').trim()
        };
    }
    return { code: null, nameWithoutCode: name };
  };

  const handleNotificationClick = useCallback((card: TrelloCard) => {
    handleCardSelect(card);
    setTimeout(() => {
      setIsSummaryOpen(true);
    }, 150);
  }, [handleCardSelect]);

  const handleActivityLogClick = useCallback(async (cardId: string) => {
    const cached = allCards.find(c => c.id === cardId);
    if (cached) {
      handleNotificationClick(cached);
    } else {
      try {
        const card = await getCardById(cardId);
        handleNotificationClick(card);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error al abrir proyecto',
          description: 'No se pudo cargar la información desde Trello.',
        });
      }
    }
  }, [handleNotificationClick, toast, allCards]);

  const handleCardOrBoardButtonClick = () => {
    if (selectedCard) {
      setIsSummaryOpen(true);
    } else {
      window.open('https://trello.com/b/CgG4b3B0/proyectos-deas', '_blank');
    }
  };

  const handleTimelineButtonClick = () => {
    setIsNavigating(true);
    let path = '/timeline';
    if (selectedCard) {
      path += `?cardId=${selectedCard.id}`;
    }
    router.push(path);
  };
  
  const handleClearSelection = useCallback(() => {
      setSelectedCard(null);
      setViewState(INITIAL_MAP_VIEW);
      setIsSummaryOpen(false);
      router.push('/');
  }, [router, setSelectedCard, setViewState]);

  const handleDownloadDuplicatesPdf = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    toast({ title: 'Preparando lista de duplicados...' });

    try {
        const doc = new jsPDF();
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        const title = 'Lista de Proyectos Duplicados';
        doc.text(title, 10, 10);

        const cardsByCode: Record<string, TrelloCard[]> = {};

        for (const card of allCards) {
          if (card.name.includes('(XXX000)')) continue;
          const { code } = getProjectInfo(card.name);
          if (code) {
            if (!cardsByCode[code]) cardsByCode[code] = [];
            cardsByCode[code].push(card);
          }
        }

        const duplicates = Object.entries(cardsByCode)
          .filter(([, cards]) => cards.length > 1)
          .sort(([codeA], [codeB]) => codeA.localeCompare(codeB));

        if (duplicates.length === 0) {
          toast({ title: 'No se encontraron duplicados', description: 'Todos los códigos de proyecto son únicos.' });
          setIsDownloading(false);
          return;
        }

        let y = 20;
        const lineHeight = 7;
        const margin = 10;
        
        for (const [code, cards] of duplicates) {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.setFont('Helvetica', 'bold');
            doc.text(`Código duplicado: ${code}`, margin, y);
            y += lineHeight;
            doc.setFont('Helvetica', 'normal');
            cards.sort((a, b) => a.name.localeCompare(b.name));
            for (const card of cards) {
                const { code: cardCode, nameWithoutCode } = getProjectInfo(card.name);
                doc.text(`${cardCode || ''} - ${nameWithoutCode}`, margin, y);
                doc.text(card.boardName, 120, y);
                y += lineHeight;
                if (y > 280) { doc.addPage(); y = 20; }
            }
            y += lineHeight;
        }
        doc.save('trello-proyectos-duplicados.pdf');
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error al generar el PDF', description: 'No se pudo generar la lista.' });
    } finally {
        setIsDownloading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    toast({ title: 'Generando PDF...', description: 'Procesando datos en memoria.' });
    
    try {
        const doc = new jsPDF('l', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 10;
        let y = 20;

        const extractField = (desc: string, field: string): string => {
            if (!desc) return '';
            const lines = desc.split('\n');
            const fieldLower = field.toLowerCase().trim();
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.toLowerCase().startsWith(fieldLower + ':')) {
                    let val = trimmedLine.substring(fieldLower.length + 1).trim();
                    val = val.replace(/\*\*/g, '').trim();
                    if (val === '****' || val === '') return '';
                    return val;
                }
            }
            return '';
        };

        const groupedByBoard: Record<string, TrelloCard[]> = allCards.reduce((acc, card) => {
            const boardName = card.boardName || 'Sin tablero';
            if (!acc[boardName]) acc[boardName] = [];
            acc[boardName].push(card);
            return acc;
        }, {} as Record<string, TrelloCard[]>);

        const cols = {
            code: { x: margin, w: 15, label: 'Cód.' },
            name: { x: margin + 15, w: 75, label: 'Proyecto' },
            partido: { x: margin + 90, w: 35, label: 'Partido' },
            proyectista: { x: margin + 125, w: 35, label: 'Proyectista' },
            financiamiento: { x: margin + 160, w: 35, label: 'Financiamiento' },
            equipo: { x: margin + 195, w: 82, label: 'Equipo (DEA / SIG / Dron)' },
        };

        doc.setFontSize(12);
        doc.setFont('Helvetica', 'bold');
        doc.text('Lista Consolidada de Proyectos - DEA', margin, 12);
        
        for (const boardName of Object.keys(groupedByBoard).sort()) {
            if (y > pageHeight - 40) { doc.addPage(); y = 20; }
            
            doc.setFontSize(9);
            doc.setFillColor(230, 230, 230);
            doc.rect(margin, y - 5, pageWidth - (2 * margin), 7, 'F');
            doc.setTextColor(0, 0, 0);
            doc.setFont('Helvetica', 'bold');
            doc.text(boardName, margin + 2, y);
            y += 8;

            doc.setFontSize(7);
            doc.setFillColor(70, 70, 70);
            doc.rect(margin, y - 4, pageWidth - (2 * margin), 6, 'F');
            doc.setTextColor(255, 255, 255);
            Object.values(cols).forEach(col => {
                doc.text(col.label, col.x + 1, y);
            });
            y += 8;

            doc.setTextColor(0, 0, 0);
            doc.setFont('Helvetica', 'normal');

            let rowIndex = 0;
            for (const card of groupedByBoard[boardName].sort((a,b) => a.name.localeCompare(b.name))) {
                const { code, nameWithoutCode } = getProjectInfo(card.name);
                
                const partido = extractField(card.desc, 'PARTIDO');
                const proyectista = extractField(card.desc, '- Proyectista');
                const financiamiento = extractField(card.desc, 'FINANCIAMIENTO');
                const dea = extractField(card.desc, '- Diagnóstico ambiental-socioeconómico');
                const sig = extractField(card.desc, '- Información SIG-imágenes');
                const dron = extractField(card.desc, '- Información LIDAR/vuelos Dron');
                
                const equipoParts = [];
                if (dea) equipoParts.push(`DEA: ${dea}`);
                if (sig) equipoParts.push(`SIG: ${sig}`);
                if (dron) equipoParts.push(`DRON: ${dron}`);
                const equipoText = equipoParts.join(' | ');

                const nameLines = doc.splitTextToSize(nameWithoutCode, cols.name.w - 2);
                const equipoLines = doc.splitTextToSize(equipoText, cols.equipo.w - 2);
                const maxLines = Math.max(nameLines.length, equipoLines.length);
                const rowHeight = Math.max(6, maxLines * 3.5 + 2);

                if (y + rowHeight > pageHeight - margin) { 
                    doc.addPage(); 
                    y = 20; 
                }

                if (rowIndex % 2 === 0) {
                    doc.setFillColor(204, 238, 255); 
                } else {
                    doc.setFillColor(245, 245, 245);
                }
                doc.rect(margin, y - 4, pageWidth - (2 * margin), rowHeight, 'F');

                doc.setFontSize(6);
                doc.text(code || '', cols.code.x + 1, y);
                doc.text(nameLines, cols.name.x + 1, y);
                doc.text(doc.splitTextToSize(partido, cols.partido.w - 2), cols.partido.x + 1, y);
                doc.text(doc.splitTextToSize(proyectista, cols.proyectista.w - 2), cols.proyectista.x + 1, y);
                doc.text(doc.splitTextToSize(financiamiento, cols.financiamiento.w - 2), cols.financiamiento.x + 1, y);
                doc.text(equipoLines, cols.equipo.x + 1, y);
                
                y += rowHeight;
                rowIndex++;
            }
            y += 10;
        }
        doc.save('DEA-Listado-Proyectos.pdf');
    } catch (error) {
        console.error('PDF generation error:', error);
        toast({ variant: 'destructive', title: 'Error al generar el PDF' });
    } finally {
        setIsDownloading(false);
    }
  };

  const handleMyProjectClick = (card: TrelloCard) => {
    handleCardSelect(card);
    setTimeout(() => {
      setIsSummaryOpen(true);
    }, 150);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          <p className="text-primary-foreground font-medium">Iniciando sistema...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative h-screen w-screen overflow-hidden">
        <MapBackground viewState={INITIAL_MAP_VIEW} />
        <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" />
        <div className="relative z-10 flex h-full items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-800/90 p-8 rounded-2xl shadow-2xl border border-neutral-700 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">DEA</h1>
            <p className="text-neutral-400 mb-8">Departamento de Estudios Ambientales</p>
            <Separator className="bg-neutral-700 mb-8" />
            <Button size="lg" className="w-full gap-2 bg-white text-black hover:bg-neutral-200" onClick={handleLogin} disabled={isLoggingIn}>
              {isLoggingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              {isLoggingIn ? 'Iniciando sesión...' : 'Ingresar con Google'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (user && !authorized) {
    return (
      <div className="relative h-screen w-screen overflow-hidden">
        <MapBackground viewState={INITIAL_MAP_VIEW} />
        <div className="absolute inset-0 bg-red-950/80 backdrop-blur-md" />
        <div className="relative z-10 flex h-full items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900/90 p-8 rounded-2xl shadow-2xl border border-red-500/50 text-center">
            <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Acceso Denegado</h1>
            <p className="text-sm font-bold text-white mb-6 bg-neutral-800 p-2 rounded border border-neutral-700">{user.email}</p>
            <Button variant="destructive" size="lg" className="w-full gap-2" onClick={handleLogout}><LogOut className="h-5 w-5" />Cerrar sesión</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen">
      <TrelloConnectionToast />
      <MapBackground viewState={viewState} />
      <div className="absolute inset-0 -z-10 bg-background/40" />
      {isNavigating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/20 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 bg-white/90 p-8 rounded-2xl shadow-2xl border border-primary/20">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-primary font-bold text-lg">Cargando línea de tiempo...</p>
          </div>
        </div>
      )}
      <div className="relative z-10 flex h-full flex-col font-body text-foreground">
        <header className="bg-primary shadow-md h-16 flex-shrink-0">
          <div className="container mx-auto flex h-full items-center justify-between px-4">
            <h1 className="font-headline text-lg md:text-xl font-bold tracking-tight text-primary-foreground">Portal DEA</h1>
            <div className='flex items-center gap-2'>
              <MailRadar />
              <NotificationsBell onNotificationClick={handleNotificationClick} />
              <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary/80"><Settings className="h-6 w-6" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent>
                      <DropdownMenuLabel>Herramientas</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={handleDownloadPdf} disabled={isDownloading}><Download className="mr-2 h-4 w-4" /><span>Descargar listado</span></DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleDownloadDuplicatesPdf} disabled={isDownloading}><AlertTriangle className="mr-2 h-4 w-4" /><span>Detectar duplicados</span></DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={(e) => {
                          e.preventDefault();
                          setTimeout(() => {
                            setIsActivityLogOpen(true);
                          }, 300);
                      }}>
                          <History className="mr-2 h-4 w-4" />
                          <span>Ver Bitácora de Actividad</span>
                      </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              <Button variant="ghost" size="icon" onClick={() => setIsHelpPanelOpen(true)} className="text-primary-foreground hover:bg-primary/80"><HelpCircle className="h-6 w-6" /></Button>
              <Separator orientation="vertical" className="h-8 bg-primary-foreground/20 mx-1" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10 border border-primary-foreground/50">
                      <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || 'Usuario'} />
                      <AvatarFallback className="bg-neutral-700 text-white">{user?.displayName?.charAt(0) || <UserIcon className="h-5 w-5" />}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user?.displayName}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <FolderKanban className="mr-2 h-4 w-4" />
                      <span>Mis Proyectos</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="w-64 max-h-[300px] p-0 overflow-hidden flex flex-col">
                        <DropdownMenuLabel className="bg-muted/50 p-2 text-[10px] uppercase font-bold text-muted-foreground">Proyectos asignados</DropdownMenuLabel>
                        <DropdownMenuSeparator className="m-0" />
                        <ScrollArea className="flex-1">
                          {isUserProjectsLoading ? (
                            <div className="p-4 flex items-center justify-center">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                          ) : userProjects.length > 0 ? (
                            userProjects.map(project => (
                              <DropdownMenuItem 
                                key={project.id} 
                                onSelect={() => handleMyProjectClick(project)}
                                className="text-[11px] py-2 px-3 cursor-pointer"
                              >
                                <span className="font-mono font-bold mr-2 text-primary">{project.name.match(/\(([^)]+)\)$/)?.[1]}</span>
                                <span className="truncate">{project.name.replace(/\([^)]+\)$/, '').trim()}</span>
                              </DropdownMenuItem>
                            ))
                          ) : (
                            <div className="p-4 text-center text-[10px] text-muted-foreground italic">
                              No tenés proyectos asignados.
                            </div>
                          )}
                        </ScrollArea>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <History className="mr-2 h-4 w-4" />
                      <span>Recientes...</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="w-64 max-h-[300px] p-0 overflow-hidden flex flex-col">
                        <DropdownMenuLabel className="bg-muted/50 p-2 text-[10px] uppercase font-bold text-muted-foreground">Últimos proyectos visitados</DropdownMenuLabel>
                        <DropdownMenuSeparator className="m-0" />
                        <ScrollArea className="flex-1">
                          {recentProjects.length > 0 ? (
                            recentProjects.map(project => (
                              <DropdownMenuItem 
                                key={project.id} 
                                onSelect={() => handleMyProjectClick(project)}
                                className="text-[11px] py-2 px-3 cursor-pointer"
                              >
                                <span className="font-mono font-bold mr-2 text-primary">{project.name.match(/\(([^)]+)\)$/)?.[1] || '---'}</span>
                                <span className="truncate">{project.name.replace(/\([^)]+\)$/, '').trim()}</span>
                              </DropdownMenuItem>
                            ))
                          ) : (
                            <div className="p-4 text-center text-[10px] text-muted-foreground italic">
                              No tenés historial de búsqueda.
                            </div>
                          )}
                        </ScrollArea>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col p-4 md:p-16 overflow-y-auto min-h-0">
          <div className="w-full md:w-4/5 mx-auto flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="h-32 bg-neutral-700/60 p-6 rounded-lg text-primary-foreground flex flex-col justify-center shadow-lg overflow-hidden transition-all duration-500">
                {selectedCard ? (
                  <div className="space-y-1">
                    {(() => {
                      const { code, nameWithoutCode } = getProjectInfo(selectedCard.name);
                      return (
                        <>
                          <div className="flex items-center gap-2 mb-1.5">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#9FCCE3] opacity-90">Proyecto Cargado</p>
                            {code && <span className="text-[10px] font-bold text-[#9FCCE3] font-mono select-none bg-[#9FCCE3]/10 px-1.5 py-0.5 rounded border border-[#9FCCE3]/20">{code.toUpperCase()}</span>}
                          </div>
                          <h2 className="text-white text-sm font-headline leading-tight text-justify line-clamp-4">
                            <span className="font-medium">{nameWithoutCode}</span>
                          </h2>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold mb-2 text-[#9FCCE3] shrink-0">Búsqueda de proyectos</h2>
                    <p className="text-sm text-balance truncate">Encontrá proyectos por nombre o código.</p>
                  </>
                )}
              </div>
              <div className="h-32 bg-neutral-700/60 p-6 rounded-lg flex flex-col justify-center shadow-lg overflow-hidden">
                <CardSearch
                  onCardSelect={handleCardSelect}
                  selectedCard={selectedCard}
                  onClear={handleClearSelection}
                  isSummaryOpen={isSummaryOpen}
                  onSummaryOpenChange={setIsSummaryOpen}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <Button variant="outline" className="h-32 flex-col gap-2 rounded-lg border-transparent bg-neutral-700/60 p-4 text-xl font-semibold text-primary-foreground shadow-lg transition-all hover:bg-neutral-700/80 hover:text-primary" onClick={handleTimelineButtonClick}>
                <Clock className="h-8 w-8 text-primary" />
                <span>Línea de tiempo</span>
              </Button>
              <Button variant="outline" className="h-32 flex-col gap-2 rounded-lg border-transparent bg-neutral-700/60 p-4 text-xl font-semibold text-primary-foreground shadow-lg transition-all hover:bg-neutral-700/80 hover:text-primary" onClick={handleCardOrBoardButtonClick}>
                {selectedCard ? <FileText className="h-8 w-8 text-primary" /> : <LayoutGrid className="h-8 w-8 text-primary" />}
                <span>{selectedCard ? 'Tarjeta' : 'Tablero'}</span>
              </Button>
              <Dialog open={isCreateProjectOpen} onOpenChange={setCreateProjectOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="h-32 flex-col gap-2 rounded-lg border-transparent bg-neutral-700/60 p-4 text-xl font-semibold text-primary-foreground shadow-lg transition-all hover:bg-neutral-700/80 hover:text-primary">
                      <FolderKanban className="h-8 w-8 text-primary" />
                      <span>Gestión de proyectos</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 border-0" showCloseButton={false}>
                  <DialogHeader className="sr-only"><DialogTitle>Gestión de Proyectos</DialogTitle></DialogHeader>
                  <CreateProjectForm 
                    setOpen={setCreateProjectOpen} 
                    onEditCard={(card) => {
                      handleCardSelect(card);
                      setTimeout(() => setIsSummaryOpen(true), 150);
                    }}
                  />
                </DialogContent>
              </Dialog>
              <Button variant="outline" className="h-32 flex-col gap-2 rounded-lg border-transparent bg-neutral-700/60 p-4 text-xl font-semibold text-primary-foreground shadow-lg transition-all hover:bg-neutral-700/80 hover:text-primary" onClick={() => setIsLibraryOpen(true)}>
                <Library className="h-8 w-8 text-primary" />
                <span>Biblioteca de Recursos</span>
              </Button>
            </div>
          </div>
        </main>

        <footer className="h-10 bg-black/10 backdrop-blur-sm flex items-center justify-center border-t border-white/5 shrink-0 px-4">
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-white/60">
            <span>© 2026 Departamento de Estudios Ambientales</span>
            <Separator orientation="vertical" className="h-3 bg-white/10" />
            <a href="mailto:ambientales.dph@gmail.com" className="hover:text-white transition-colors flex items-center gap-1">
              <Mail className="h-3 w-3" />
              ambientales.dph@gmail.com
            </a>
          </div>
        </footer>

        <Sheet open={isHelpPanelOpen} onOpenChange={setIsHelpPanelOpen}>
          <SheetContent className="bg-neutral-900 text-white sm:max-w-md border-l-primary/20 shadow-2xl p-0 flex flex-col">
            <SheetHeader className="p-6 bg-primary shrink-0 text-left">
              <SheetTitle className="text-white text-xl font-bold flex items-center gap-2">
                <HelpCircle className="h-6 w-6" />
                Centro de Ayuda DEA
              </SheetTitle>
              <SheetDescription className="text-white/80 text-xs">
                Guía completa para el uso del Portal y la Línea de Tiempo.
              </SheetDescription>
            </SheetHeader>
            
            <ScrollArea className="flex-1 px-6">
              <div className="py-6">
                <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-xl border border-primary/20 mb-6">
                  <Zap className="h-10 w-10 text-primary shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-primary">Navegación Fluida</p>
                    <p className="text-[11px] text-neutral-400 Kaladin leading-tight">Tu proyecto seleccionado y la vista del mapa se mantienen vivos al cambiar de sección.</p>
                  </div>
                </div>

                <Accordion type="single" collapsible className="w-full space-y-4">
                  <AccordionItem value="busqueda" className="border-b border-neutral-800">
                    <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors py-3">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <Search className="h-4 w-4" />
                        Búsqueda y Mapa
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-xs text-neutral-400 leading-relaxed space-y-2 pb-4">
                      <p>Localizá proyectos por nombre o código (ej: MAR001) usando el buscador central.</p>
                      <div className="flex items-start gap-2 bg-neutral-800/50 p-2 rounded">
                        <MousePointer2 className="h-3 w-3 text-primary mt-0.5" />
                        <span><strong>Geolocalización:</strong> Si la descripción en Trello contiene un hashtag (ej: #LaPlata), el mapa se centrará automáticamente.</span>
                      </div>
                      <p>La aplicación guarda tu nivel de <strong>zoom</strong> y posición del mapa incluso si navegás a la Línea de Tiempo y regresás.</p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="gestion" className="border-b border-neutral-800">
                    <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors py-3">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <FolderKanban className="h-4 w-4" />
                        Gestión de Proyectos
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-xs text-neutral-400 leading-relaxed space-y-3 pb-4">
                      <p>Al crear un proyecto nuevo, el sistema automatiza las tareas administrativas:</p>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          <span>Genera un código correlativo único por cuenca.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          <span>Crea la tarjeta de Trello con la ficha técnica estandarizada.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          <span>Crea la carpeta en Google Drive y otorga permisos de edición a los responsables seleccionados.</span>
                        </li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="timeline" className="border-b border-neutral-800">
                    <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors py-3">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <Clock className="h-4 w-4" />
                        Línea de Tiempo (TL)
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-xs text-neutral-400 leading-relaxed space-y-3 pb-4">
                      <p>La TL centraliza el historial dinámico de cada intervención ambiental:</p>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="p-2 border border-neutral-800 rounded bg-neutral-800/30">
                          <span className="text-primary font-bold">Sincronización Automática:</span>
                          <p className="mt-1">Comentarios, archivos adjuntos y cambios de estado en Trello se transforman en hitos de la TL sin intervención manual.</p>
                        </div>
                        <div className="p-2 border border-neutral-800 rounded bg-neutral-800/30">
                          <span className="text-primary font-bold">Hitos Manuales:</span>
                          <p className="mt-1">Podés registrar eventos específicos subiendo fotos o documentos. Estos archivos se guardan en Drive y se vinculan a Trello automáticamente.</p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="recursos" className="border-b border-neutral-800">
                    <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors py-3">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <Library className="h-4 w-4" />
                        Biblioteca de Recursos
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-xs text-neutral-400 leading-relaxed space-y-2 pb-4">
                      <p>Centralizá la bibliografía de tus proyectos:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li><strong>Repositorios:</strong> SNRD (Argentina), Elsevier, Crossref, PLOS, DOAJ.</li>
                        <li><strong>Recursos Propios:</strong> Atlas de cuencas, digesto normativo y matrices de impacto.</li>
                        <li><strong>Vinculación:</strong> Usá el icono del clip para adjuntar cualquier recurso a la ficha técnica del proyecto.</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="actividad" className="border-b border-neutral-800">
                    <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors py-3">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <History className="h-4 w-4" />
                        Notificaciones y Bitácora
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-xs text-neutral-400 leading-relaxed space-y-2 pb-4">
                      <p>Mantenete al tanto de lo que sucede en el departamento:</p>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-2">
                          <Bell className="h-3 w-3 text-primary mt-0.5" />
                          <span><strong>Campana:</strong> Notificaciones en tiempo real de acciones en Trello y el Portal.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <History className="h-3 w-3 text-primary mt-0.5" />
                          <span><strong>Bitácora:</strong> Registro histórico detallado de todas las ediciones, creación de hitos y descargas.</span>
                        </li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="contacto" className="border-b border-neutral-800">
                    <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors py-3">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <Mail className="h-4 w-4" />
                        Soporte y Contacto
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-xs text-neutral-400 leading-relaxed pb-4">
                      <p>Para errores de sincronización, problemas de acceso o sugerencias, contactá al equipo de administración del Departamento de Estudios Ambientales.</p>
                      <div className="mt-3 p-3 bg-neutral-800 rounded border border-neutral-700 text-center">
                        <p className="font-bold text-neutral-200">ambientales.dph@gmail.com</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </ScrollArea>
            
            <div className="p-6 bg-neutral-950 border-t border-neutral-800 shrink-0">
               <p className="text-[10px] text-neutral-500 text-center uppercase tracking-widest font-bold">
                 Departamento de Estudios Ambientales &copy; 2026
               </p>
            </div>
          </SheetContent>
        </Sheet>
        <ResourceLibrary isOpen={isLibraryOpen} onOpenChange={setIsLibraryOpen} selectedCard={selectedCard} onCardUpdate={handleCardSelect} />
        <ActivityLogDialog 
          isOpen={isActivityLogOpen} 
          onOpenChange={setIsActivityLogOpen} 
          onActivityClick={handleActivityLogClick}
        />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-primary"><Loader2 className="h-12 w-12 animate-spin text-white" /></div>}>
      <HomeContent />
    </Suspense>
  );
}
