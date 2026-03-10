'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { TrelloCard, getAllCardsFromAllBoards } from '@/services/trello';

interface ProjectContextType {
  allCards: TrelloCard[];
  isLoadingCards: boolean;
  selectedCard: TrelloCard | null;
  setSelectedCard: (card: TrelloCard | null) => void;
  refreshCards: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [allCards, setAllCards] = useState<TrelloCard[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [selectedCard, setSelectedCard] = useState<TrelloCard | null>(null);

  const refreshCards = useCallback(async () => {
    // Si ya estamos cargando o ya tenemos las tarjetas, evitamos duplicar la carga pesada
    if (isLoadingCards) return;
    
    setIsLoadingCards(true);
    try {
      const cards = await getAllCardsFromAllBoards();
      // Filtrar solo las tarjetas que parecen proyectos (tienen código entre paréntesis)
      const projectCards = cards.filter(card => card.name.match(/\(([A-Z]{3}\d{3})\)$/));
      setAllCards(projectCards);
    } catch (e) {
      console.error("Error loading cards in ProjectProvider:", e);
    } finally {
      setIsLoadingCards(false);
    }
  }, [isLoadingCards]);

  // Carga inicial de la lista completa de proyectos al entrar al portal
  useEffect(() => {
    if (allCards.length === 0) {
      refreshCards();
    }
  }, [refreshCards, allCards.length]);

  return (
    <ProjectContext.Provider value={{ 
      allCards, 
      isLoadingCards, 
      selectedCard, 
      setSelectedCard, 
      refreshCards 
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
