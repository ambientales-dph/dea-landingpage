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
import { Crosshair, MapPin, Layers, Check, Loader2 } from 'lucide-react';
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
  const [isMapReady, setIsMapReady] = React.useState(false);

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

  React.useEffect(() => {
    if (!isOpen || !mapRef.current) return;

    // Iniciamos la creación del mapa con un pequeño delay para el Dialog
    const timer = setTimeout(() => {
      if (!mapRef.current || mapInstance.current) return;

      const lon = initialLon !== undefined ? initialLon : BA_CENTER[0];
      const lat = initialLat !== undefined ? initialLat : BA_CENTER[1];
      const zoom = initialZoom !== undefined ? initialZoom : DEFAULT_ZOOM;

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
          maxZoom: 19
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
      
      // Forzar renderizado inicial
      map.once('postrender', () => {
        setIsMapReady(true);
      });

      // Asegurar que el mapa ocupe todo el espacio
      setTimeout(() => map.updateSize(), 100);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstance.current) {
        mapInstance.current.setTarget(undefined);
        mapInstance.current = null;
      }
      setIsMapReady(false);
    };
  }, [isOpen]);

  // Cambio reactivo de capa base sin reconstruir el mapa
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
        const [lon, lat] = toLonLat(center);
        onSelect(lon, lat, Math.round(zoom));
        onOpenChange(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[550px] flex flex-col p-0 overflow-hidden border-0 shadow-2xl bg-zinc-100">
        <DialogHeader className="p-3 bg-primary text-primary-foreground shrink-0 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold font-headline">
            <MapPin className="h-4 w-4" />
            Definir Vista del Proyecto
          </DialogTitle>
        </DialogHeader>

        <div className="relative flex-1 bg-zinc-200 overflow-hidden min-h-0">
          {/* El spinner ahora no bloquea al mapa, es una capa decorativa de carga */}
          {!isMapReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100 z-10 transition-opacity duration-300">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Cargando cartografía...</p>
            </div>
          )}
          
          <div 
            ref={mapRef} 
            className="w-full h-full cursor-crosshair outline-none bg-zinc-200" 
            style={{ position: 'absolute', top: 0, left: 0 }}
          />
          
          {/* Mira central fija */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
            <div className="relative flex items-center justify-center">
              <Crosshair className="h-10 w-10 text-primary opacity-60 stroke-[1.5px]" />
              <div className="absolute h-1 w-1 bg-primary rounded-full" />
            </div>
          </div>

          {/* Selector de Capas Flotante - Elevado para que sea siempre visible */}
          <div className="absolute top-4 right-4 z-[60]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="shadow-lg bg-white/95 hover:bg-white text-zinc-700 gap-2 border border-zinc-200 h-8 text-[10px] font-bold uppercase">
                  <Layers className="h-3.5 w-3.5" />
                  <span>Mapa Base</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white border-zinc-200 z-[70]">
                <DropdownMenuItem onClick={() => setBaseLayerType('osm')} className="gap-2 text-xs cursor-pointer">
                  <div className="flex-1">OpenStreetMap</div>
                  {baseLayerType === 'osm' && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBaseLayerType('gray')} className="gap-2 text-xs cursor-pointer">
                  <div className="flex-1">OSM Gris (Técnico)</div>
                  {baseLayerType === 'gray' && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBaseLayerType('satellite')} className="gap-2 text-xs cursor-pointer">
                  <div className="flex-1">ESRI Satélite</div>
                  {baseLayerType === 'satellite' && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="absolute bottom-4 left-4 bg-white/90 p-2 rounded-md border border-zinc-300 shadow-sm pointer-events-none z-20">
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest leading-tight">
              Navegue y encuadre la zona<br/>del proyecto en la mira central
            </p>
          </div>
        </div>

        <DialogFooter className="p-3 bg-zinc-200 border-t shrink-0 flex flex-row justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-zinc-600 hover:bg-zinc-300 h-9">
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} className="px-8 shadow-md h-9 text-xs font-bold uppercase tracking-wide">
            Confirmar Vista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
