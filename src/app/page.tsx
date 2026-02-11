
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getAllCardsFromAllBoards } from '@/services/trello';
import jsPDF from 'jspdf';


const INITIAL_VIEW_STATE = {
  center: [-6450000, -4150000],
  zoom: 5,
};

export default function Home() {
  const [selectedCard, setSelectedCard] = useState<TrelloCard | null>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const { toast } = useToast();
  const [isHelpPanelOpen, setIsHelpPanelOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isCreateProjectOpen, setCreateProjectOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
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

        // Group cards by project code, excluding the template
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

        // Filter for groups with more than one card (duplicates) and sort by code
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
        const doc = new jsPDF();
        doc.setFont('Helvetica', 'normal');

        const allCardsFromTrello = await getAllCardsFromAllBoards();
        const cardsToProcess = allCardsFromTrello.filter(card => 
            getProjectInfo(card.name).code &&
            !card.name.includes('(XXX000)')
        );
        const title = 'Lista de todos los proyectos';

        const groupedByBoard: Record<string, TrelloCard[]> = cardsToProcess.reduce((acc, card) => {
            const boardName = card.boardName || 'Sin tablero';
            if (!acc[boardName]) {
                acc[boardName] = [];
            }
            acc[boardName].push(card);
            return acc;
        }, {} as Record<string, TrelloCard[]>);

        const sortedBoardNames = Object.keys(groupedByBoard).sort((a, b) => a.localeCompare(b));

        for (const boardName of sortedBoardNames) {
            groupedByBoard[boardName].sort((a, b) => {
                const codeA = getProjectInfo(a.name).code;
                const codeB = getProjectInfo(b.name).code;
                if (codeA && codeB) {
                    return codeA.localeCompare(codeB);
                }
                return codeA ? -1 : 1;
            });
        }

        doc.setFontSize(10);
        doc.text(title, 10, 10);
      
        const lineHeight = 7;
        const margin = 10;
        const nameColWidth = doc.internal.pageSize.width - (2 * margin);
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

        let isFirstBoard = true;
        for (const boardName of sortedBoardNames) {
            if (groupedByBoard[boardName].length === 0) continue;

            const boardHeaderHeight = isFirstBoard ? lineHeight : lineHeight * 2;
            if (checkPageBreak(boardHeaderHeight)) {
                isFirstBoard = true;
            }

            if (!isFirstBoard) {
                y += lineHeight;
            }
            
            const nameColX = margin;
            doc.setFont('Helvetica', 'bold');
            doc.text(boardName, nameColX, y);
            y += lineHeight;
            doc.setFont('Helvetica', 'normal');
            
            for (const card of groupedByBoard[boardName]) {
                const { code, nameWithoutCode } = getProjectInfo(card.name);
                
                if (!code) continue; 
        
                const formattedName = `${code.replace(/[()]/g, '')} - ${nameWithoutCode}`;
                const nameLines = doc.splitTextToSize(formattedName, nameColWidth);
                const requiredHeight = nameLines.length * lineHeight;

                if (checkPageBreak(requiredHeight + lineHeight)) {
                    doc.setFont('Helvetica', 'bold');
                    doc.text(boardName + " (cont.)", margin, y);
                    y += lineHeight;
                    doc.setFont('Helvetica', 'normal');
                }
                
                doc.text(nameLines, margin, y);
                y += requiredHeight;
            }
            isFirstBoard = false;
        }
      
        doc.save('trello-proyectos.pdf');
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error al generar el PDF',
            description: error instanceof Error ? error.message : 'No se pudo generar el listado.',
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
  
  const formatCardName = (name: string | null): { __html: string } => {
    if (!name) return { __html: '' };
    
    const codeMatch = name.match(/\(([^)]+)\)$/);
    const code = codeMatch ? codeMatch[0] : '';
    let nameWithoutCode = code ? name.substring(0, name.length - code.length).trim() : name;
  
    const lines = [];
    while (nameWithoutCode.length > 0) {
      let cutPoint = 60;
      if (nameWithoutCode.length > 60) {
        const lastSpace = nameWithoutCode.substring(0, 60).lastIndexOf(' ');
        cutPoint = lastSpace > 0 ? lastSpace : 60;
      }
      lines.push(nameWithoutCode.substring(0, cutPoint));
      nameWithoutCode = nameWithoutCode.substring(cutPoint).trim();
    }
  
    return { __html: `${lines.join('<br />')} ${code}`.trim() };
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
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col p-4 md:p-16">
          <div className="w-full md:w-4/5 mx-auto flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="h-32 bg-neutral-700/60 p-6 rounded-lg text-primary-foreground flex flex-col justify-center shadow-lg">
                <h2 className="text-xl font-bold mb-2 text-primary">Búsqueda avanzada de proyectos</h2>
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
                  {selectedCard && (
                    <span
                      className="text-xs font-normal mt-1"
                      dangerouslySetInnerHTML={formatCardName(selectedCard.name)}
                    />
                  )}
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
                  {selectedCard && (
                     <span
                        className="text-xs font-normal mt-1"
                        dangerouslySetInnerHTML={formatCardName(selectedCard.name)}
                     />
                  )}
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
                <DialogContent className="h-screen w-screen max-w-full rounded-none border-0 p-0">
                  <DialogHeader className="sr-only">
                    <DialogTitle>Crear Nuevo Proyecto</DialogTitle>
                    <DialogDescription>
                      Complete el formulario para crear una nueva tarjeta de proyecto en Trello.
                    </DialogDescription>
                  </DialogHeader>
                  <CreateProjectForm setOpen={setCreateProjectOpen} />
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                className="h-32 flex-col gap-2 rounded-lg border-transparent bg-neutral-700/60 p-4 text-xl font-semibold text-primary-foreground shadow-lg transition-all hover:bg-neutral-700/80 hover:text-primary dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
                disabled
              >
                <Library className="h-8 w-8 text-primary" />
                <div className="flex items-center gap-2">
                  <span>Biblioteca de Recursos</span>
                  <Construction className="h-5 w-5" />
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

        <footer className="bg-neutral-700/60 py-2 dark:bg-neutral-800/60 mt-auto">
          <div className="container mx-auto flex items-center justify-center gap-8 text-sm text-primary-foreground">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>ambientales.dph@gmail.com</span>
            </div>
          </div>
        </footer>

        <Sheet open={isHelpPanelOpen} onOpenChange={setIsHelpPanelOpen}>
          <SheetContent className="bg-neutral-700/95 text-primary-foreground border-l-primary/20">
            <SheetHeader>
              <SheetTitle className="text-primary">Ayuda</SheetTitle>
              <SheetDescription className="text-primary-foreground/80">
                Acá te contamos para qué sirve cada control.
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100%-4rem)] w-full mt-4">
              <div className="space-y-6 p-1">
                <div>
                  <h3 className="font-semibold text-lg text-primary flex items-center gap-2">
                    <Search className="h-5 w-5" /> Búsqueda avanzada
                  </h3>
                  <p className="text-sm mt-1">
                    Te permite buscar proyectos por nombre o por lo que dicen en su descripción. Cuando elegís una tarjeta, el mapa te va a mostrar dónde está el proyecto, siempre y cuando la ubicación esté en la descripción de la tarjeta con el formato <strong># Ubicación</strong>.
                  </p>
                </div>
                <Separator className="bg-primary/20" />
                <div>
                  <h3 className="font-semibold text-lg text-primary flex items-center gap-2">
                    <FolderKanban className="h-5 w-5" /> Gestión de proyectos
                  </h3>
                  <p className="text-sm mt-1">
                    Abre en una pestaña nueva el panel para gestionar todos los proyectos del departamento.
                  </p>
                </div>
                <Separator className="bg-primary/20" />
                <div>
                  <h3 className="font-semibold text-lg text-primary flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5" /> Tablero / Tarjeta
                  </h3>
                  <p className="text-sm mt-1">
                    Si no seleccionaste ninguna tarjeta, el botón "Tablero" te abre el tablero principal de proyectos en Trello. Si ya elegiste una, el botón "Tarjeta" te abre un resumen detallado.
                  </p>
                </div>
                <Separator className="bg-primary/20" />
                <div>
                  <h3 className="font-semibold text-lg text-primary flex items-center gap-2">
                    <Clock className="h-5 w-5" /> Línea de tiempo
                  </h3>
                  <p className="text-sm mt-1">
                    Abre en otra pestaña la línea de tiempo de los proyectos, para que los veas en orden cronológico.
                  </p>
                </div>
                <Separator className="bg-primary/20" />
                <div>
                  <h3 className="font-semibold text-lg text-primary flex items-center gap-2">
                    <Waypoints className="h-5 w-5" /> CartoDEA
                  </h3>
                  <p className="text-sm mt-1">
                    Abre en una pestaña nueva la aplicación de mapas del departamento (CartoDEA), para que chusmees información geoespacial importante.
                  </p>
                </div>
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
