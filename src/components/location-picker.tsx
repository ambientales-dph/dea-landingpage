'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crosshair, MapPin } from 'lucide-react';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat, toLonLat } from 'ol/proj';
import 'ol/ol.css';

interface LocationPickerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (lon: number, lat: number, zoom: number) => void;
  initialLon?: number;
  initialLat?: number;
  initialZoom?: number;
}

export default function LocationPicker({
  isOpen,
  onOpenChange,
  onSelect,
  initialLon = -58.4,
  initialLat = -34.6,
  initialZoom = 12,
}: LocationPickerProps) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const mapInstance = React.useRef<Map | null>(null);

  React.useEffect(() => {
    if (!isOpen || !mapRef.current) return;

    // Inicializar el mapa
    const view = new View({
      center: fromLonLat([initialLon, initialLat]),
      zoom: initialZoom,
    });

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM({
            crossOrigin: 'anonymous'
          }),
        }),
      ],
      view: view,
      controls: [],
    });

    mapInstance.current = map;

    // Importante: Forzar actualización de tamaño después de que el diálogo se abra
    // Esto evita el problema de los cuadros grises por falta de dimensiones iniciales
    const timeoutId = setTimeout(() => {
      if (mapInstance.current) {
        mapInstance.current.updateSize();
      }
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      map.setTarget(undefined);
      mapInstance.current = null;
    };
  }, [isOpen, initialLon, initialLat, initialZoom]);

  const handleConfirm = () => {
    if (mapInstance.current) {
      const view = mapInstance.current.getView();
      const center = view.getCenter();
      const zoom = view.getZoom();
      if (center && zoom !== undefined) {
        const [lon, lat] = toLonLat(center);
        onSelect(lon, lat, Math.round(zoom));
        onOpenChange(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[500px] flex flex-col p-0 overflow-hidden border-0 shadow-2xl bg-zinc-100">
        <DialogHeader className="p-4 bg-primary text-primary-foreground shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <MapPin className="h-4 w-4" />
            Definir Vista del Proyecto
          </DialogTitle>
        </DialogHeader>

        <div className="relative flex-1 bg-zinc-200">
          <div ref={mapRef} className="w-full h-full" />
          
          {/* Mira central fija */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <Crosshair className="h-10 w-10 text-primary opacity-60 stroke-[1.5px]" />
          </div>
          
          <div className="absolute bottom-4 left-4 bg-white/90 p-2 rounded-md border shadow-sm pointer-events-none">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
              Encuadre la zona del proyecto en la mira
            </p>
          </div>
        </div>

        <DialogFooter className="p-3 bg-zinc-100 border-t shrink-0 flex flex-row justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-zinc-600">
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} className="px-6 shadow-md">
            Aceptar Vista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
