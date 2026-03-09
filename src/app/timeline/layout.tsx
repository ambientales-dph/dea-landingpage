'use client';

import React from 'react';
import '@/timeline/app/globals.css';

/**
 * Layout específico para la línea de tiempo.
 * Importa los estilos globales originales de la TL para preservar su aspecto único,
 * incluyendo las fuentes Encode Sans Condensed y los estilos de impresión.
 */
export default function TimelineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="timeline-app-root h-screen w-full overflow-hidden">
      {children}
    </div>
  );
}
