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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const INITIAL_VIEW_STATE = {
  center: [-6450000, -4150000],
  zoom: 5,
};

export default function Home() {
  const [selectedCard, setSelectedCard] = useState<TrelloCard | null>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const { toast } = useToast();
  const [isHelpPanelOpen, setIsHelpPanelOpen] = useState(false);

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
  
  const handleBoardButtonClick = () => {
    if (selectedCard) {
      window.open(selectedCard.url, '_blank');
    } else {
      window.open('https://trello.com/b/CgG4b3B0/proyectos-deas', '_blank');
    }
  };

  const handleTimelineButtonClick = () => {
    window.open('https://studio--studio-1444688551-39519.us-central1.hosted.app', '_blank');
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
            <Button variant="ghost" size="icon" onClick={() => setIsHelpPanelOpen(true)} className="text-primary-foreground hover:bg-primary/80">
              <HelpCircle className="h-6 w-6" />
            </Button>
          </div>
        </header>

        <main className="flex-1 flex flex-col p-4 md:p-16">
          <div className="w-full md:w-4/5 mx-auto flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-neutral-700/60 p-6 rounded-lg text-primary-foreground flex flex-col justify-center shadow-lg">
                <h2 className="text-xl font-bold mb-4 text-primary">Búsqueda avanzada de proyectos</h2>
                <p className="text-sm mb-2">Con este buscador podés encontrar proyectos por su nombre o descripción.</p>
                <p className="text-sm mb-2">Ingresá palabras clave para encontrar la tarjeta de Trello que buscás.</p>
                <p className="text-sm mb-2">Si el proyecto tiene una ubicación, la vas a ver en el mapa.</p>
                <p className="text-sm">Usá el botón de descarga para bajarte una lista con todos los proyectos.</p>
              </div>
              <div className="bg-neutral-700/60 p-6 rounded-lg flex flex-col justify-center shadow-lg">
                <CardSearch
                  onCardSelect={handleCardSelect}
                  selectedCard={selectedCard}
                  onClear={handleClearSelection}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Button
                variant="outline"
                className="h-32 flex-col gap-2 rounded-lg border-transparent bg-neutral-700/60 p-4 text-xl font-semibold text-primary-foreground shadow-lg transition-all hover:bg-neutral-700/80 hover:text-primary dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
              >
                <FolderKanban className="h-8 w-8 text-primary" />
                Gestión de proyectos
              </Button>
              <Button
                variant="outline"
                className="h-32 flex-col gap-2 rounded-lg border-transparent bg-neutral-700/60 p-4 text-xl font-semibold text-primary-foreground shadow-lg transition-all hover:bg-neutral-700/80 hover:text-primary dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
                onClick={handleBoardButtonClick}
              >
                <LayoutGrid className="h-8 w-8 text-primary" />
                <div className="flex flex-col items-center text-center">
                  <span>Tableros</span>
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
                onClick={handleTimelineButtonClick}
              >
                <Clock className="h-8 w-8 text-primary" />
                Línea de tiempo
              </Button>
              <Button
                variant="outline"
                className="h-32 flex-col gap-2 rounded-lg border-transparent bg-neutral-700/60 p-4 text-xl font-semibold text-primary-foreground shadow-lg transition-all hover:bg-neutral-700/80 hover:text-primary dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
              >
                <Waypoints className="h-8 w-8 text-primary" />
                CartoDEA
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
                    <LayoutGrid className="h-5 w-5" /> Tableros
                  </h3>
                  <p className="text-sm mt-1">
                    Si no seleccionaste ninguna tarjeta, esto te abre el tablero principal de proyectos en Trello. Si ya elegiste una, te la abre directamente.
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
