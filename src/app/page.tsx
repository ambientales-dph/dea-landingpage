'use client';

import { useState, useCallback, useEffect } from 'react';
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
} from 'lucide-react';
import MapBackground from '@/components/map-background';
import TrelloConnectionToast from '@/components/trello-connection-toast';
import CardSearch from '@/components/card-search';
import { type TrelloCard, getAllCardsFromAllBoards, getCardById } from '@/services/trello';
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
import { useAuth, useUser } from '@/firebase';
import { loginConGoogle, cerrarSesion, isUserAuthorized, WHITELIST } from '@/services/auth-service';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

const INITIAL_VIEW_STATE = {
  center: [-6450000, -4150000],
  zoom: 5,
};

export default function Home() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const { toast } = useToast();

  const [selectedCard, setSelectedCard] = useState<TrelloCard | null>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [isHelpPanelOpen, setIsHelpPanelOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isCreateProjectOpen, setCreateProjectOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [userProjects, setUserProjects] = useState<TrelloCard[]>([]);
  const [isUserProjectsLoading, setIsUserProjectsLoading] = useState(false);
  
  const authorized = user ? isUserAuthorized(user.email) : false;

  const fetchUserProjects = useCallback(async () => {
    if (!user?.email) return;
    setIsUserProjectsLoading(true);
    try {
      const authorizedUser = WHITELIST.find(u => u.email.toLowerCase() === user.email?.toLowerCase());
      if (!authorizedUser?.name) return;
      
      const allCards = await getAllCardsFromAllBoards();
      const myName = authorizedUser.name.toLowerCase();
      
      const filtered = allCards.filter(card => {
        const hasCode = card.name.match(/\(([A-Z]{3}\d{3})\)$/);
        const isMine = card.desc?.toLowerCase().includes(myName);
        return hasCode && isMine;
      }).sort((a, b) => a.name.localeCompare(b.name));
      
      setUserProjects(filtered);
    } catch (error) {
      console.error("Error fetching user projects:", error);
    } finally {
      setIsUserProjectsLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    if (user && authorized) {
      fetchUserProjects();
    }
  }, [user, authorized, fetchUserProjects]);

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
      toast({ title: 'Sesión cerrada', description: 'Has salido de la aplicación.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cerrar la sesión.' });
    }
  };

  const getProjectInfo = (name: string): { code: string | null; nameWithoutCode: string } => {
    const projectRegex = /\(([A-Z]{3}\d{3})\)$/;
    const match = name.match(projectRegex);
    if (match && match[1]) {
        return {
            code: match[1],
            nameWithoutCode: name.replace(projectRegex, '').trim()
        };
    }
    return { code: null, nameWithoutCode: name };
  };

  const handleCardSelect = useCallback(async (card: TrelloCard | null) => {
    setSelectedCard(card);

    if (card && card.desc) {
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
          setViewState(INITIAL_VIEW_STATE);
        }
      } else {
        setViewState(INITIAL_VIEW_STATE);
      }
    } else {
      setViewState(INITIAL_VIEW_STATE);
    }
  }, []);

  const handleNotificationClick = useCallback((card: TrelloCard) => {
    handleCardSelect(card);
    // Give time for UI transitions to complete
    setTimeout(() => {
      setIsSummaryOpen(true);
    }, 150);
  }, [handleCardSelect]);

  const handleCardOrBoardButtonClick = () => {
    if (selectedCard) {
      setIsSummaryOpen(true);
    } else {
      window.open('https://trello.com/b/CgG4b3B0/proyectos-deas', '_blank');
    }
  };

  const handleTimelineButtonClick = () => {
    const baseUrl = 'https://studio--studio-1444688551-39519.us-central1.hosted.app';
    let finalUrl = baseUrl;

    if (selectedCard) {
      finalUrl = `${baseUrl}?cardId=${selectedCard.id}`;
    }

    window.open(finalUrl, '_blank');
  };
  
  const handleClearSelection = useCallback(() => {
      setSelectedCard(null);
      setViewState(INITIAL_VIEW_STATE);
      setIsSummaryOpen(false);
  }, []);

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

        const cardsFromTrello = await getAllCardsFromAllBoards();
        const cardsByCode: Record<string, TrelloCard[]> = {};

        for (const card of cardsFromTrello) {
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
            cards.sort((a, b) => a.boardName.localeCompare(b.boardName));
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
    toast({ title: 'Generando PDF...', description: 'Obteniendo los datos de Trello.' });
    
    try {
        const doc = new jsPDF('l', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 10;
        let y = 20;

        const extractField = (desc: string, field: string): string => {
            if (!desc) return '';
            const lines = desc.split('\n');
            for (const line of lines) {
                if (line.includes(field)) {
                    const parts = line.split(':');
                    if (parts.length > 1) {
                        let val = parts.slice(1).join(':').trim();
                        val = val.replace(/\*\*/g, '').trim();
                        if (val === '****' || val === '') return '';
                        return val;
                    }
                }
            }
            return '';
        };

        const allCardsFromTrello = await getAllCardsFromAllBoards();
        const cardsToProcess = allCardsFromTrello.filter(card => getProjectInfo(card.name).code && !card.name.includes('(XXX000)'));
        const groupedByBoard: Record<string, TrelloCard[]> = cardsToProcess.reduce((acc, card) => {
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
            
            // Título del Tablero
            doc.setFontSize(9);
            doc.setFillColor(230, 230, 230);
            doc.rect(margin, y - 5, pageWidth - (2 * margin), 7, 'F');
            doc.setTextColor(0, 0, 0);
            doc.setFont('Helvetica', 'bold');
            doc.text(boardName, margin + 2, y);
            y += 8;

            // Encabezado de Tabla
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
                const proyectista = extractField(card.desc, 'PROYECTISTA');
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

                // Alternating row colors
                if (rowIndex % 2 === 0) {
                    doc.setFillColor(204, 238, 255); // Celeste
                } else {
                    doc.setFillColor(245, 245, 245); // Gris claro
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
    // Add small delay to let dropdown menu close properly
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
        <MapBackground viewState={INITIAL_VIEW_STATE} />
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
        <MapBackground viewState={INITIAL_VIEW_STATE} />
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
      <div className="relative z-10 flex h-full flex-col font-body text-foreground">
        <header className="bg-primary shadow-md h-16 flex-shrink-0">
          <div className="container mx-auto flex h-full items-center justify-between px-4">
            <h1 className="font-headline text-lg md:text-xl font-bold tracking-tight text-primary-foreground">Departamento de Estudios Ambientales</h1>
            <div className='flex items-center gap-2'>
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
              <div className="h-32 bg-neutral-700/60 p-6 rounded-lg text-primary-foreground flex flex-col justify-center shadow-lg">
                <h2 className="text-xl font-bold mb-2 text-primary">Búsqueda de proyectos</h2>
                <p className="text-sm text-balance">Encontrá proyectos por nombre o código. Si tiene una ubicación asignada, la verás en el mapa.</p>
              </div>
              <div className="h-32 bg-neutral-700/60 p-6 rounded-lg flex flex-col justify-end shadow-lg">
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

        <Sheet open={isHelpPanelOpen} onOpenChange={setIsHelpPanelOpen}>
          <SheetContent className="bg-neutral-800 text-white sm:max-w-md border-l-primary/20">
            <SheetHeader>
              <SheetTitle className="text-primary text-xl font-bold flex items-center gap-2">
                <HelpCircle className="h-6 w-6" />
                Centro de Ayuda
              </SheetTitle>
              <SheetDescription className="text-neutral-400">
                Guía rápida de uso del Portal DEA
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100%-8rem)] w-full mt-6 pr-4">
              <Accordion type="single" collapsible className="w-full space-y-2">
                <AccordionItem value="busqueda" className="border-neutral-700">
                  <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors text-left">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Búsqueda y Mapa
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-neutral-300 leading-relaxed">
                    Utilizá el buscador central para filtrar proyectos por nombre o código (ej: MAR001). 
                    Si la descripción de la tarjeta en Trello contiene un hashtag con una ubicación (ej: #LaPlata), 
                    el mapa se desplazará automáticamente hacia ese punto al seleccionar la tarjeta.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="gestion" className="border-neutral-700">
                  <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors text-left">
                    <div className="flex items-center gap-2">
                      <FolderKanban className="h-4 w-4" />
                      Gestión de Proyectos
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-neutral-300 leading-relaxed space-y-2">
                    <p>Al crear un proyecto nuevo desde el botón central:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Se genera un código correlativo único según la cuenca seleccionada.</li>
                      <li>Se crea una tarjeta en la lista correspondiente del tablero de Trello.</li>
                      <li>Se crea automáticamente una carpeta en Google Drive dentro de la estructura de la cuenca.</li>
                      <li>Se otorgan permisos de edición en Drive a los profesionales seleccionados.</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="recursos" className="border-neutral-700">
                  <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors text-left">
                    <div className="flex items-center gap-2">
                      <Library className="h-4 w-4" />
                      Biblioteca de Recursos
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-neutral-300 leading-relaxed">
                    Podés adjuntar enlaces de interés a cualquier proyecto seleccionado. 
                    Buscá en repositorios nacionales (SNRD) o bases internacionales (Elsevier, Crossref, PLOS, DOAJ). 
                    Hacé clic en el ícono del clip para "vincular" el recurso directamente en la tarjeta de Trello.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="notificaciones" className="border-neutral-700">
                  <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors text-left">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Notificaciones y Bitácora
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-neutral-300 leading-relaxed">
                    La campana muestra la actividad reciente de todo el equipo. 
                    Al hacer clic en una notificación, se abrirá la ficha técnica del proyecto. 
                    La <strong>Bitácora de Actividad</strong> (accesible desde el engranaje) ofrece un registro detallado de todas las acciones del portal.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="herramientas" className="border-neutral-700">
                  <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors text-left">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Herramientas Extra
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-neutral-300 leading-relaxed">
                    En el menú de configuración (engranaje) podés descargar el listado consolidado del departamento en PDF 
                    o ejecutar el detector de códigos duplicados para mantener la base de datos limpia.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="contacto" className="border-neutral-700">
                  <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors text-left">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Soporte Técnico
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-neutral-300 leading-relaxed">
                    Para problemas de acceso, reporte de errores o sugerencias, comunicate con los administradores del sistema 
                    según la lista de contactos autorizados del Departamento de Estudios Ambientales.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </ScrollArea>
            <div className="absolute bottom-6 left-6 right-6">
               <Separator className="mb-4 bg-neutral-700" />
               <p className="text-[10px] text-neutral-500 text-center uppercase tracking-widest font-bold">
                 Departamento de Estudios Ambientales - 2024
               </p>
            </div>
          </SheetContent>
        </Sheet>
        <ResourceLibrary isOpen={isLibraryOpen} onOpenChange={setIsLibraryOpen} selectedCard={selectedCard} onCardUpdate={handleCardSelect} />
        <ActivityLogDialog isOpen={isActivityLogOpen} onOpenChange={setIsActivityLogOpen} />
      </div>
    </div>
  );
}
