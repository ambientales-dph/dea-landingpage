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
import { Crosshair, MapPin, Layers, Check } from 'lucide-react';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, toLonLat } from 'ol/proj';
import { defaults as defaultInteractions } from 'ol/interaction';
import 'ol/ol.css';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type BaseLayerType = 'osm' | 'gray' | 'satellite';

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
  initialLon,
  initialLat,
  initialZoom,
}: LocationPickerProps) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const mapInstance = React.useRef<Map | null>(null);
  const [baseLayerType, setBaseLayerType] = React.useState<BaseLayerType>('osm');

  // Coordenadas del centro de la Prov. de Buenos Aires (Saladillo aprox)
  const BA_CENTER = [-60.0, -36.0];
  const DEFAULT_ZOOM = 6;

  const getLayerSource = (type: BaseLayerType) => {
    switch (type) {
      case 'gray':
        return new XYZ({
          url: 'https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          attributions: '© OpenStreetMap contributors, © CartoDB',
          crossOrigin: 'anonymous'
        });
      case 'satellite':
        return new XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attributions: 'Tiles © Esri',
          crossOrigin: 'anonymous'
        });
      default:
        return new OSM({
          crossOrigin: 'anonymous'
        });
    }
  };

  // Efecto para inicializar el mapa
  React.useEffect(() => {
    if (!isOpen || !mapRef.current) return;

    const lon = initialLon !== undefined ? initialLon : BA_CENTER[0];
    const lat = initialLat !== undefined ? initialLat : BA_CENTER[1];
    const zoom = initialZoom !== undefined ? initialZoom : DEFAULT_ZOOM;

    const baseLayer = new TileLayer({
      source: getLayerSource(baseLayerType),
    });

    const map = new Map({
      target: mapRef.current,
      layers: [baseLayer],
      view: new View({
        center: fromLonLat([lon, lat]),
        zoom: zoom,
      }),
      interactions: defaultInteractions(),
      controls: [],
    });

    mapInstance.current = map;

    const timeoutId = setTimeout(() => {
      if (mapInstance.current) {
        mapInstance.current.updateSize();
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      map.setTarget(undefined);
      mapInstance.current = null;
    };
  }, [isOpen]); // Solo al abrir

  // Efecto para cambiar la capa base sin reinicializar todo el mapa
  React.useEffect(() => {
    if (mapInstance.current) {
      const layers = mapInstance.current.getLayers();
      const baseLayer = layers.item(0) as TileLayer<any>;
      if (baseLayer) {
        baseLayer.setSource(getLayerSource(baseLayerType));
      }
    }
  }, [baseLayerType]);

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
      <DialogContent className="max-w-3xl h-[600px] flex flex-col p-0 overflow-hidden border-0 shadow-2xl bg-zinc-100">
        <DialogHeader className="p-4 bg-primary text-primary-foreground shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <MapPin className="h-4 w-4" />
            Definir Vista del Proyecto
          </DialogTitle>
        </DialogHeader>

        <div className="relative flex-1 bg-zinc-200">
          <div ref={mapRef} className="w-full h-full cursor-crosshair" />
          
          {/* Mira central fija */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <Crosshair className="h-10 w-10 text-primary opacity-60 stroke-[1.5px]" />
          </div>

          {/* Selector de Capas Flotante */}
          <div className="absolute top-4 right-4 z-20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="shadow-lg bg-white/90 hover:bg-white text-zinc-700 gap-2 border border-zinc-200">
                  <Layers className="h-4 w-4" />
                  <span className="hidden sm:inline">Mapa Base</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setBaseLayerType('osm')} className="gap-2">
                  <div className="flex-1">OpenStreetMap</div>
                  {baseLayerType === 'osm' && <Check className="h-3 w-3 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBaseLayerType('gray')} className="gap-2">
                  <div className="flex-1">OSM Gris (Técnico)</div>
                  {baseLayerType === 'gray' && <Check className="h-3 w-3 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBaseLayerType('satellite')} className="gap-2">
                  <div className="flex-1">ESRI Satélite</div>
                  {baseLayerType === 'satellite' && <Check className="h-3 w-3 text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="absolute bottom-4 left-4 bg-white/90 p-2 rounded-md border border-zinc-300 shadow-sm pointer-events-none">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest leading-tight">
              Navegue y encuadre la zona<br/>del proyecto en la mira central
            </p>
          </div>
        </div>

        <DialogFooter className="p-3 bg-zinc-100 border-t shrink-0 flex flex-row justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-zinc-600 hover:bg-zinc-200">
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} className="px-8 shadow-md">
            Confirmar Vista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
