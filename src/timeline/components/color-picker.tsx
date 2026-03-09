'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// A curated list of colors, arranged in rows to create a honeycomb shape.
const HONEYCOMB_COLORS = [
  ['#a3e635', '#84cc16', '#65a30d', '#4d7c0f', '#365314'],
  ['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d', '#052e16'],
  ['#14b8a6', '#0d9488', '#0f766e', '#115e59', '#134e4a', '#042f2e', '#020617'],
  ['#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e', '#083344', '#172554', '#1e1b4b'],
  ['#4f46e5', '#4338ca', '#3730a3', '#312e81', '#1e1b4b', '#311b92', '#512da8', '#673ab7', '#7e57c2'],
  ['#8b5cf6', '#7e22ce', '#6b21a8', '#581c87', '#4a044e', '#881337', '#9f1239', '#be123c'],
  ['#be185d', '#9d174d', '#831843', '#9f1239', '#e11d48', '#f43f5e', '#fb7185'],
  ['#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12', '#451a03'],
  ['#facc15', '#eab308', '#ca8a04', '#a16207', '#854d0e'],
];

interface ColorPickerProps {
  onColorSelect: (color: string) => void;
}

const Hexagon = ({ color, onClick }: { color: string; onClick: () => void }) => {
  return (
    <div
      className="relative h-8 w-9 cursor-pointer transition-transform hover:scale-125 hover:z-10"
      style={{
        backgroundColor: color,
        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
      }}
      onClick={onClick}
    />
  );
};

export function ColorPicker({ onColorSelect }: ColorPickerProps) {
  return (
    <div className="flex flex-col items-center p-2">
      {HONEYCOMB_COLORS.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={cn(
            'flex justify-center space-x-1',
            rowIndex > 0 && '-mt-2' // Overlap rows to create honeycomb effect
          )}
        >
          {row.map((color, colorIndex) => (
            <Hexagon
              key={`${rowIndex}-${colorIndex}`}
              color={color}
              onClick={() => onColorSelect(color)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}