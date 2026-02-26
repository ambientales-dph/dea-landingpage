'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import MapBackground from '@/components/map-background';
import TrelloConnectionToast from '@/components/trello-connection-toast';
import CardSearch from '@/components/card-search';
import type { TrelloCard } from '@/services/trello';
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
import CreateProjectForm from '@/components/create-project-form';
import ResourceLibrary from '@/components/resource-library';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getAllCardsFromAllBoards } from '@/services/trello';
import jsPDF from 'jspdf';
import NotificationsBell from '@/components/notifications-bell';
import { useAuth, useUser } from '@/firebase';
import { loginConGoogle, cerrarSesion } from '@/services/auth-service';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
  
  const handleLogin = async () => {
    try {
      await loginConGoogle(auth);
      toast({ title: '¡Bienvenido!', description: 'Has iniciado sesión correctamente.' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error de acceso',
        description: error.message || 'No se pudo iniciar sesión.',
      });
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

  const handleNotificationClick = (card: TrelloCard) => {
    handleCardSelect(card);
    setIsSummaryOpen(true);
  };

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
            if (!cardsByCode[code]) {
              cardsByCode[code] = [];
            }
            cardsByCode[code].push(card);
          }
        }

        const duplicates = Object.entries(cardsByCode)
          .filter(([, cards]) => cards.length > 1)
          .sort(([codeA], [codeB]) => codeA.localeCompare(codeB));

        if (duplicates.length === 0) {
          toast({
            title: 'No se encontraron duplicados',
            description: 'Todos los códigos de proyecto son únicos.',
          });
          setIsDownloading(false);
          return;
        }

        const lineHeight = 7;
        const margin = 10;
        const nameColX = margin;
        const boardColX = 120;
        const pageHeight = doc.internal.pageSize.height;
        let y = 20;

        const checkPageBreak = (neededHeight: number) => {
            if (y + neededHeight > pageHeight - margin) {
                doc.addPage();
                y = margin;
                return true;
            }
            return false;
        }
        
        let isFirstDuplicate = true;
        for (const [code, cards] of duplicates) {
            const headerHeight = isFirstDuplicate ? lineHeight : lineHeight * 2;
            if (checkPageBreak(headerHeight)) {
                isFirstDuplicate = true;
            }

            if (!isFirstDuplicate) {
                y += lineHeight;
            }

            doc.setFont('Helvetica', 'bold');
            doc.text(`Código duplicado: ${code}`, nameColX, y);
            y += lineHeight;
            doc.setFont('Helvetica', 'normal');

            cards.sort((a, b) => a.boardName.localeCompare(b.boardName));
            
            for (const card of cards) {
                const { code: cardCode, nameWithoutCode } = getProjectInfo(card.name);
                const formattedName = cardCode ? `${cardCode} - ${nameWithoutCode}` : nameWithoutCode;
                
                const nameLines = doc.splitTextToSize(formattedName, boardColX - nameColX - 2);
                const boardLines = doc.splitTextToSize(card.boardName, doc.internal.pageSize.width - boardColX - margin);
                const requiredHeight = Math.max(nameLines.length, boardLines.length) * lineHeight;

                if (checkPageBreak(requiredHeight + 2)) {
                    doc.setFont('Helvetica', 'bold');
                    doc.text(`Código duplicado: ${code} (cont.)`, nameColX, y);
                    y += lineHeight;
                    doc.setFont('Helvetica', 'normal');
                }

                doc.text(nameLines, nameColX, y);
                doc.text(boardLines, boardColX, y);
                y += requiredHeight;
            }
            isFirstDuplicate = false;
        }
      
        doc.save('trello-proyectos-duplicados.pdf');
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error al generar el PDF',
            description: error instanceof Error ? error.message : 'No se pudo generar la lista de duplicados.',
        });
    } finally {
        setIsDownloading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    toast({ title: 'Generando PDF...', description: 'Obteniendo los datos más recientes de Trello.' });
    
    try {
        const doc = new jsPDF('l', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 10;
        let y = 20;

        const extractField = (desc: string, field: string): string => {
            if (!desc) return '****';
            const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`^${escapedField}:\\s*\\*\\*(.*?)\\*\\*`, 'm');
            const match = desc.match(regex);
            return (match && match[1] && !/^\*+$/.test(match[1])) ? match[1].trim() : '****';
        };

        const allCardsFromTrello = await getAllCardsFromAllBoards();
        const cardsToProcess = allCardsFromTrello.filter(card => 
            getProjectInfo(card.name).code &&
            !card.name.includes('(XXX000)')
        );

        const groupedByBoard: Record<string, TrelloCard[]> = cardsToProcess.reduce((acc, card) => {
            const boardName = card.boardName || 'Sin tablero';
            if (!acc[boardName]) acc[boardName] = [];
            acc[boardName].push(card);
            return acc;
        }, {} as Record<string, TrelloCard[]>);

        const sortedBoardNames = Object.keys(groupedByBoard).sort((a, b) => a.localeCompare(b));

        const cols = {
            code: { x: margin, w: 20, label: 'Código' },
            name: { x: margin + 20, w: 90, label: 'Nombre del Proyecto' },
            proyectista: { x: margin + 110, w: 45, label: 'Proyectista' },
            financiamiento: { x: margin + 155, w: 45, label: 'Financiamiento' },
            equipo: { x: margin + 200, w: 77, label: 'Equipo (DEA)' },
        };

        const drawHeader = (boardName?: string) => {
            doc.setFontSize(10);
            doc.setFont('Helvetica', 'bold');
            if (boardName) {
                doc.setFillColor(70, 70, 70);
                doc.rect(margin, y - 5, pageWidth - (2 * margin), 7, 'F');
                doc.setTextColor(255, 255, 255);
                doc.text(boardName, margin + 2, y);
                y += 10;
            }

            doc.setFillColor(200, 200, 200);
            doc.rect(margin, y - 5, pageWidth - (2 * margin), 7, 'F');
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(8);
            Object.values(cols).forEach(col => {
                doc.text(col.label, col.x + 1, y);
            });
            y += 5;
            doc.setFont('Helvetica', 'normal');
        };

        const checkPageBreak = (neededHeight: number, boardName: string) => {
            if (y + neededHeight > pageHeight - margin) {
                doc.addPage();
                y = 20;
                drawHeader(boardName + " (cont.)");
                return true;
            }
            return false;
        };

        doc.setFontSize(12);
        doc.setFont('Helvetica', 'bold');
        doc.text('Lista Consolidada de Proyectos - DEA', margin, 12);
        
        let rowCount = 0;
        for (const boardName of sortedBoardNames) {
            if (groupedByBoard[boardName].length === 0) continue;

            if (y > pageHeight - 40) {
                doc.addPage();
                y = 20;
            }
            
            drawHeader(boardName);
            
            const sortedCards = groupedByBoard[boardName].sort((a, b) => {
                const codeA = getProjectInfo(a.name).code || '';
                const codeB = getProjectInfo(b.name).code || '';
                return codeA.localeCompare(codeB);
            });

            for (const card of sortedCards) {
                const { code, nameWithoutCode } = getProjectInfo(card.name);
                const proyectista = extractField(card.desc, 'PROYECTISTA');
                const financiamiento = extractField(card.desc, 'FINANCIAMIENTO');
                const equipo = extractField(card.desc, '- Diagnóstico ambiental-socioeconómico');

                const nameLines = doc.splitTextToSize(nameWithoutCode, cols.name.w - 2);
                const proyectistaLines = doc.splitTextToSize(proyectista, cols.proyectista.w - 2);
                const financiamientoLines = doc.splitTextToSize(financiamiento, cols.financiamiento.w - 2);
                const equipoLines = doc.splitTextToSize(equipo, cols.equipo.w - 2);

                const maxLines = Math.max(nameLines.length, proyectistaLines.length, financiamientoLines.length, equipoLines.length);
                const rowHeight = Math.max(maxLines * 4, 6);

                checkPageBreak(rowHeight, boardName);

                if (rowCount % 2 === 0) {
                    doc.setFillColor(245, 245, 245);
                } else {
                    doc.setFillColor(230, 245, 255);
                }
                doc.rect(margin, y - 4, pageWidth - (2 * margin), rowHeight, 'F');
                
                doc.setFontSize(7);
                doc.setTextColor(0, 0, 0);
                
                doc.text(code || '', cols.code.x + 1, y);
                doc.text(nameLines, cols.name.x + 1, y);
                doc.text(proyectistaLines, cols.proyectista.x + 1, y);
                doc.text(financiamientoLines, cols.financiamiento.x + 1, y);
                doc.text(equipoLines, cols.equipo.x + 1, y);

                y += rowHeight;
                rowCount++;
            }
            y += 10;
        }
      
        doc.save('DEA-Listado-Proyectos.pdf');
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error al generar el PDF',
            description: error instanceof Error ? error.message : 'No se pudo generar le listado.',
        });
    } finally {
        setIsDownloading(false);
    }
  };

  const handleCardSelect = async (card: TrelloCard | null) => {
    setSelectedCard(card);

    if (card && card.desc) {
      try {
        const query = extractLocationFromDesc(card.desc, true);
        
        if (query) {
            const location = await searchLocation(query);
            if (location) {
              setViewState({
                center: fromLonLat([parseFloat(location.lon), parseFloat(location.lat)]),
                zoom: 14,
              });
            } else {
              setViewState(INITIAL_VIEW_STATE);
            }
        } else {
            setViewState(INITIAL_VIEW_STATE);
        }
      } catch (error) {
        console.error('Error geocoding card description:', error);
        setViewState(INITIAL_VIEW_STATE);
      }
    } else {
      setViewState(INITIAL_VIEW_STATE);
    }
  };
  
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
  
  const handleClearSelection = () => {
      setSelectedCard(null);
      setViewState(INITIAL_VIEW_STATE);
  }
  
  const extractLocationFromDesc = (desc: string | undefined, returnNull?: boolean): string | null => {
    const defaultMessage = 'No se encontró ubicación con # en la descripción.';
    const nullReturn = returnNull ? null : defaultMessage;

    if (!desc) {
      return 'Seleccione una tarjeta para ver su ubicación.';
    }

    const match = desc.match(/^\s*\\?#\s*(.*)$/m);

    if (match && match[1]) {
        return match[1].trim();
    }
    
    return nullReturn;
  };

  // Pantalla de carga inicial
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

  // Pantalla de Login si no hay usuario
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
            <p className="text-sm text-neutral-300 mb-6">
              Esta aplicación es de uso exclusivo para el personal autorizado del departamento.
            </p>
            <Button 
              size="lg" 
              className="w-full gap-2 bg-white text-black hover:bg-neutral-200"
              onClick={handleLogin}
            >
              <LogIn className="h-5 w-5" />
              Ingresar con Google
            </Button>
            <p className="mt-6 text-[10px] text-neutral-500 uppercase tracking-widest">
              Seguridad garantizada por Firebase Auth
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Interfaz principal (Solo si está autenticado)
  return (
    <div className="relative h-screen w-screen">
      <TrelloConnectionToast />
      <MapBackground viewState={viewState} />
      <div className="absolute inset-0 -z-10 bg-background/40" />
      <div
        className="relative z-10 flex h-full flex-col font-body text-foreground"
      >
        <header className="bg-primary shadow-md h-16 flex-shrink-0">
          <div className="container mx-auto flex h-full items-center justify-between px-4">
            <h1 className="font-headline text-lg md:text-xl font-bold tracking-tight text-primary-foreground">
              Departamento de Estudios Ambientales
            </h1>
            <div className='flex items-center gap-2'>
              <NotificationsBell onNotificationClick={handleNotificationClick} />
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary/80">
                      <Settings className="h-6 w-6" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                      <DropdownMenuLabel>Herramientas</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={handleDownloadPdf} disabled={isDownloading}>
                        <Download className="mr-2 h-4 w-4" />
                        <span>Descargar listado de proyectos</span>
                      </DropdownMenuItem>
                       <DropdownMenuItem onSelect={handleDownloadDuplicatesPdf} disabled={isDownloading}>
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        <span>Detectar duplicados</span>
                      </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              <Button variant="ghost" size="icon" onClick={() => setIsHelpPanelOpen(true)} className="text-primary-foreground hover:bg-primary/80">
                <HelpCircle className="h-6 w-6" />
              </Button>
              
              <Separator orientation="vertical" className="h-8 bg-primary-foreground/20 mx-1" />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10 border border-primary-foreground/50">
                      <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'Usuario'} />
                      <AvatarFallback className="bg-neutral-700 text-white">
                        {user.displayName?.charAt(0) || <UserIcon className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.displayName}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {selectedCard && (
          <div className="absolute top-20 left-0 right-0 z-10 container mx-auto px-4 pointer-events-none text-center">
            <h2
              className="text-[10px] md:text-xs font-bold text-primary-foreground drop-shadow-md text-balance"
              style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.8)' }}
            >
              {selectedCard.name}
            </h2>
          </div>
        )}

        <main className="flex-1 flex flex-col p-4 md:p-16 overflow-y-auto min-h-0">
          <div className="w-full md:w-4/5 mx-auto flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="h-32 bg-neutral-700/60 p-6 rounded-lg text-primary-foreground flex flex-col justify-center shadow-lg">
                <h2 className="text-xl font-bold mb-2 text-primary">Búsqueda de proyectos</h2>
                <p className="text-sm">Encontrá proyectos por nombre o descripción. Si tiene una ubicación asignada, la verás en el mapa.</p>
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
               <Button
                variant="outline"
                className="h-32 flex-col gap-2 rounded-lg border-transparent bg-neutral-700/60 p-4 text-xl font-semibold text-primary-foreground shadow-lg transition-all hover:bg-neutral-700/80 hover:text-primary dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
                onClick={handleTimelineButtonClick}
              >
                <Clock className="h-8 w-8 text-primary" />
                <div className="flex flex-col items-center text-center">
                  <span>Línea de tiempo</span>
                </div>
              </Button>
              <Button
                variant="outline"
                className="h-32 flex-col gap-2 rounded-lg border-transparent bg-neutral-700/60 p-4 text-xl font-semibold text-primary-foreground shadow-lg transition-all hover:bg-neutral-700/80 hover:text-primary dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
                onClick={handleCardOrBoardButtonClick}
              >
                {selectedCard ? <FileText className="h-8 w-8 text-primary" /> : <LayoutGrid className="h-8 w-8 text-primary" />}
                <div className="flex flex-col items-center text-center">
                  <span>{selectedCard ? 'Tarjeta' : 'Tablero'}</span>
                </div>
              </Button>
              <Dialog open={isCreateProjectOpen} onOpenChange={setCreateProjectOpen}>
                <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-32 flex-col gap-2 rounded-lg border-transparent bg-neutral-700/60 p-4 text-xl font-semibold text-primary-foreground shadow-lg transition-all hover:bg-neutral-700/80 hover:text-primary dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
                    >
                      <FolderKanban className="h-8 w-8 text-primary" />
                      <span>Gestión de proyectos</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 border-0" showCloseButton={false}>
                  <DialogHeader className="sr-only">
                    <DialogTitle>Gestión de Proyectos</DialogTitle>
                    <DialogDescription>
                      Consultá la lista de proyectos o creá uno nuevo.
                    </DialogDescription>
                  </DialogHeader>
                  <CreateProjectForm setOpen={setCreateProjectOpen} />
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                className="h-32 flex-col gap-2 rounded-lg border-transparent bg-neutral-700/60 p-4 text-xl font-semibold text-primary-foreground shadow-lg transition-all hover:bg-neutral-700/80 hover:text-primary dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
                onClick={() => setIsLibraryOpen(true)}
              >
                <Library className="h-8 w-8 text-primary" />
                <div className="flex items-center gap-2">
                  <span>Biblioteca de Recursos</span>
                </div>
              </Button>
              <Button
                variant="outline"
                className="h-32 flex-col gap-2 rounded-lg border-transparent bg-neutral-700/60 p-4 text-xl font-semibold text-primary-foreground shadow-lg transition-all hover:bg-neutral-700/80 hover:text-primary dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80 md:col-span-2"
                disabled
              >
                <Waypoints className="h-8 w-8 text-primary" />
                <div className="flex items-center gap-2">
                  <span>CartoDEA</span>
                  <Construction className="h-5 w-5" />
                </div>
              </Button>
            </div>
          </div>
        </main>

        <footer className="bg-neutral-700/60 py-2 dark:bg-neutral-800/60 flex-shrink-0">
          <div className="container mx-auto flex items-center justify-center gap-8 text-sm text-primary-foreground">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>ambientales.dph@gmail.com</span>
            </div>
          </div>
        </footer>

        <Sheet open={isHelpPanelOpen} onOpenChange={setIsHelpPanelOpen}>
          <SheetContent className="bg-neutral-700/95 text-primary-foreground border-l-primary/20 sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="text-primary">Centro de Ayuda</SheetTitle>
              <SheetDescription className="text-primary-foreground/80">
                Acá te contamos para qué sirve cada función de la aplicación.
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100%-4rem)] w-full mt-4 pr-4">
              <div className="space-y-6 p-1">
                <div>
                  <h3 className="font-semibold text-lg text-primary flex items-center gap-2">
                    <Bell className="h-5 w-5" /> Notificaciones
                  </h3>
                  <p className="text-sm mt-1">
                    La campana te avisa sobre la actividad reciente en Trello (últimas 8 horas). Un círculo rojo indica notificaciones nuevas. Al hacer clic, verás una lista de acciones (comentarios, tarjetas movidas, etc.). Si seleccionás una notificación, se abrirá la ventana de detalles de esa tarjeta.
                  </p>
                </div>
                <Separator className="bg-primary/20" />
                <div>
                  <h3 className="font-semibold text-lg text-primary flex items-center gap-2">
                    <Settings className="h-5 w-5" /> Herramientas
                  </h3>
                  <p className="text-sm mt-1">
                    Este menú contiene herramientas administrativas:
                  </p>
                  <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                    <li><strong>Descargar listado de proyectos:</strong> Genera un PDF con todos los proyectos, ordenados y agrupados por tablero.</li>
                    <li><strong>Detectar duplicados:</strong> Crea un informe en PDF que resalta los proyectos que tienen códigos duplicados en Trello.</li>
                  </ul>
                </div>
                <Separator className="bg-primary/20" />
                <div>
                  <h3 className="font-semibold text-lg text-primary flex items-center gap-2">
                    <Search className="h-5 w-5" /> Búsqueda de proyectos
                  </h3>
                  <p className="text-sm mt-1">
                    Buscá proyectos por nombre, código o palabras clave en su descripción. Al seleccionar un proyecto, el mapa se centrará en su ubicación (si está definida con <strong># Ubicación</strong> en la tarjeta de Trello).
                  </p>
                </div>
                <Separator className="bg-primary/20" />
                <div>
                  <h3 className="font-semibold text-lg text-primary flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5" /> Tarjeta / Tablero
                  </h3>
                  <p className="text-sm mt-1">
                    Este botón cambia según el contexto. Si no hay ningún proyecto seleccionado, te llevará al tablero principal de "Proyectos" en Trello. Si seleccionaste un proyecto, abrirá una ventana con todos sus detalles (descripción, adjuntos, comentarios), donde además podrás editar su contenido.
                  </p>
                </div>
                <Separator className="bg-primary/20" />
                <div>
                  <h3 className="font-semibold text-lg text-primary flex items-center gap-2">
                    <Clock className="h-5 w-5" /> Línea de tiempo
                  </h3>
                  <p className="text-sm mt-1">
                    Abre la aplicación de línea de tiempo en una nueva pestaña. Si tenés un proyecto seleccionado, la línea de tiempo se abrirá centrada en ese proyecto.
                  </p>
                </div>
                <Separator className="bg-primary/20" />
                <div>
                  <h3 className="font-semibold text-lg text-primary flex items-center gap-2">
                    <FolderKanban className="h-5 w-5" /> Gestión de proyectos
                  </h3>
                  <p className="text-sm mt-1">
                    Abre una ventana para administrar todos los proyectos. Te muestra una lista completa que podés filtrar, y te permite crear nuevos proyectos con el botón <strong>+</strong>.
                  </p>
                </div>
                <Separator className="bg-primary/20" />
                <div>
                  <h3 className="font-semibold text-lg text-primary flex items-center gap-2">
                    <Library className="h-5 w-5" /> Biblioteca de Recursos
                  </h3>
                  <p className="text-sm mt-1">
                    Abre una ventana con una colección de enlaces y recursos externos útiles para el departamento, con una función de búsqueda para encontrar lo que necesites rápidamente.
                  </p>
                </div>
                <Separator className="bg-primary/20" />
                <div>
                  <h3 className="font-semibold text-lg text-primary flex items-center gap-2">
                    <Waypoints className="h-5 w-5" /> CartoDEA
                  </h3>
                  <p className="text-sm mt-1">
                    (En desarrollo) Abrirá la aplicación de información geoespacial del departamento.
                  </p>
                </div>
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
        <ResourceLibrary isOpen={isLibraryOpen} onOpenChange={setIsLibraryOpen} selectedCard={selectedCard} onCardUpdate={handleCardSelect} />
      </div>
    </div>
  );
}