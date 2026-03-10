'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { TrelloCard, getAllCardsFromAllBoards } from '@/services/trello';

/**
 * Estado inicial del mapa (Provincia de Buenos Aires)
 */
export const INITIAL_MAP_VIEW = {
  center: [-6450000, -4150000],
  zoom: 5,
};

interface ProjectContextType {
  allCards: TrelloCard[];
  isLoadingCards: boolean;
  selectedCard: TrelloCard | null;
  setSelectedCard: (card: TrelloCard | null) => void;
  refreshCards: () => Promise<void>;
  viewState: { center: number[]; zoom: number };
  setViewState: (state: { center: number[]; zoom: number }) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [allCards, setAllCards] = useState<TrelloCard[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [selectedCard, setSelectedCard] = useState<TrelloCard | null>(null);
  const [viewState, setViewState] = useState(INITIAL_MAP_VIEW);
  const initialLoadDone = useRef(false);

  const refreshCards = useCallback(async () => {
    // Evitar múltiples cargas simultáneas
    if (isLoadingCards) return;
    
    setIsLoadingCards(true);
    try {
      const cards = await getAllCardsFromAllBoards();
      // Filtrar solo las tarjetas que parecen proyectos (tienen código entre paréntesis)
      const projectCards = cards.filter(card => card.name.match(/\(([A-Z]{3}\d{3})\)$/));
      setAllCards(projectCards);
      initialLoadDone.current = true;
    } catch (e) {
      console.error("Error loading cards in ProjectProvider:", e);
    } finally {
      setIsLoadingCards(false);
    }
  }, [isLoadingCards]);

  // Carga inicial única al montar la aplicación
  useEffect(() => {
    if (!initialLoadDone.current && allCards.length === 0) {
      refreshCards();
    }
  }, [refreshCards, allCards.length]);

  return (
    <ProjectContext.Provider value={{ 
      allCards, 
      isLoadingCards, 
      selectedCard, 
      setSelectedCard, 
      refreshCards,
      viewState,
      setViewState
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within ProjectProvider');
  return context;
};
