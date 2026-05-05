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

  // Centro de la Provincia de Buenos Aires (Saladillo aprox)
  const BA_CENTER = [-60.018, -36.037];
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

  // Inicialización del Mapa
  React.useEffect(() => {
    if (!isOpen) return;

    // Pequeño retardo para que el Dialog empiece a existir en el DOM
    const initTimer = setTimeout(() => {
      if (!mapRef.current || mapInstance.current) return;

      const lon = initialLon ?? BA_CENTER[0];
      const lat = initialLat ?? BA_CENTER[1];
      const zoom = initialZoom ?? DEFAULT_ZOOM;

      const baseLayer = new TileLayer({
        source: getLayerSource(baseLayerType),
        properties: { id: 'base-layer' }
      });

      const map = new Map({
        target: mapRef.current,
        layers: [baseLayer],
        view: new View({
          center: fromLonLat([lon, lat]),
          zoom: zoom,
          minZoom: 4,
          maxZoom: 19,
          projection: 'EPSG:3857'
        }),
        interactions: defaultInteractions({
          doubleClickZoom: true,
          dragPan: true,
          mouseWheelZoom: true,
          pinchRotate: false,
        }),
        controls: [],
      });

      mapInstance.current = map;

      // Forzar redimensionamiento múltiple para contrarrestar la animación del Dialog
      const r1 = setTimeout(() => map.updateSize(), 100);
      const r2 = setTimeout(() => map.updateSize(), 400);
      const r3 = setTimeout(() => map.updateSize(), 800);

      return () => {
        [r1, r2, r3].forEach(clearTimeout);
      };
    }, 150);

    return () => {
      clearTimeout(initTimer);
      if (mapInstance.current) {
        mapInstance.current.setTarget(undefined);
        mapInstance.current = null;
      }
    };
  }, [isOpen]);

  // Cambio reactivo de capa base
  React.useEffect(() => {
    if (mapInstance.current) {
      const layers = mapInstance.current.getLayers();
      const baseLayer = layers.getArray().find(l => l.get('id') === 'base-layer') as TileLayer<any>;
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
        // Convertimos de Web Mercator a Coordenadas Geográficas para guardar
        const [lon, lat] = toLonLat(center);
        onSelect(lon, lat, Math.round(zoom));
        onOpenChange(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[400px] flex flex-col p-0 overflow-hidden border-0 shadow-2xl bg-zinc-200">
        <DialogHeader className="p-3 bg-primary text-primary-foreground shrink-0 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="flex items-center gap-2 text-xs font-bold font-headline">
            <MapPin className="h-4 w-4" />
            Ubicar Proyecto
          </DialogTitle>
        </DialogHeader>

        <div className="relative flex-1 bg-zinc-300 overflow-hidden min-h-0 border-y border-zinc-400/20">
          <div 
            ref={mapRef} 
            className="w-full h-full bg-zinc-300 outline-none" 
          />
          
          {/* Mira central fija */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
            <div className="relative flex items-center justify-center">
              <Crosshair className="h-10 w-10 text-primary opacity-60 stroke-[1.5px]" />
              <div className="absolute h-1.5 w-1.5 bg-primary rounded-full shadow-sm" />
            </div>
          </div>

          {/* Selector de Capas */}
          <div className="absolute top-3 right-3 z-50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="shadow-lg bg-white/95 hover:bg-white text-zinc-700 gap-1.5 border border-zinc-300 h-7 text-[9px] font-bold uppercase">
                  <Layers className="h-3 w-3" />
                  <span>Capas</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 bg-white border-zinc-200 z-[100]">
                <DropdownMenuItem onClick={() => setBaseLayerType('osm')} className="gap-2 text-[10px] cursor-pointer">
                  <div className="flex-1">OpenStreetMap</div>
                  {baseLayerType === 'osm' && <Check className="h-3 w-3 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBaseLayerType('gray')} className="gap-2 text-[10px] cursor-pointer">
                  <div className="flex-1">OSM Gris</div>
                  {baseLayerType === 'gray' && <Check className="h-3 w-3 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBaseLayerType('satellite')} className="gap-2 text-[10px] cursor-pointer">
                  <div className="flex-1">Satélite</div>
                  {baseLayerType === 'satellite' && <Check className="h-3 w-3 text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <DialogFooter className="p-3 bg-zinc-200 border-t shrink-0 flex flex-row justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-zinc-600 hover:bg-zinc-300 h-8 text-[11px] font-bold uppercase tracking-wide">
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} className="px-6 shadow-md h-8 text-[11px] font-bold uppercase tracking-wide">
            Confirmar Vista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
