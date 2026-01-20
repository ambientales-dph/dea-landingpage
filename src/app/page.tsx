
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  FolderKanban,
  LayoutGrid,
  Waypoints,
  Mail,
  X,
  Clock,
} from 'lucide-react';
import MapBackground from '@/components/map-background';
import TrelloConnectionToast from '@/components/trello-connection-toast';
import CardSearch from '@/components/card-search';
import type { TrelloCard } from '@/services/trello';
import { searchLocation } from '@/services/nominatim';
import { fromLonLat } from 'ol/proj';
import { useToast } from '@/hooks/use-toast';

const INITIAL_VIEW_STATE = {
  center: [-6450000, -4150000],
  zoom: 5,
};

export default function Home() {
  const [selectedCard, setSelectedCard] = useState<TrelloCard | null>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const { toast } = useToast();

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
            <h1 className="font-headline text-xl font-bold tracking-tight text-primary-foreground">
              Departamento de Estudios Ambientales
            </h1>
          </div>
        </header>

        <main className="flex-1 flex flex-col p-16">
          <div className="w-3/5 mx-auto flex flex-col gap-8">
            <div className="grid grid-cols-2 gap-8">
              <div className="bg-neutral-700/60 p-6 rounded-lg text-primary-foreground flex flex-col justify-center shadow-lg">
                <h2 className="text-xl font-bold mb-4 text-primary">Búsqueda Avanzada de Proyectos</h2>
                <p className="text-sm mb-2">Este buscador permite encontrar proyectos por su nombre o por el contenido de su descripción.</p>
                <p className="text-sm mb-2">Ingrese palabras clave para localizar la tarjeta de Trello correspondiente.</p>
                <p className="text-sm mb-2">La ubicación del proyecto se mostrará en el mapa si está disponible.</p>
                <p className="text-sm">Utilice el botón de descarga para obtener una lista completa de proyectos.</p>
              </div>
              <div className="bg-neutral-700/60 p-6 rounded-lg flex flex-col justify-center shadow-lg">
                <div className="flex items-center gap-2 w-full">
                  <CardSearch onCardSelect={handleCardSelect} selectedCard={selectedCard} />
                  {selectedCard && (
                    <Button variant="ghost" size="icon" onClick={handleClearSelection} className="text-primary-foreground hover:bg-primary/80">
                      <X className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
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
                onClick={() => window.open('https://6000-firebase-studio-1750900454304.cluster-vpxjqdstfzgs6qeiaf7rdlsqrc.cloudworkstations.dev/', '_blank')}
              >
                <Clock className="h-8 w-8 text-primary" />
                Línea de tiempo
              </Button>
              <Button
                variant="outline"
                className="h-32 flex-col gap-2 rounded-lg border-transparent bg-neutral-700/60 p-4 text-xl font-semibold text-primary-foreground shadow-lg transition-all hover:bg-neutral-700/80 hover:text-primary dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
                onClick={() => window.open('https://6000-firebase-studio-1753298695333.cluster-vpxjqdstfzgs6qeiaf7rdlsqrc.cloudworkstations.dev/', '_blank')}
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
      </div>
    </div>
  );
}
