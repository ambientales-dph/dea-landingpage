
'use client';

import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { useEffect, useRef } from 'react';
import { DragPan, MouseWheelZoom } from 'ol/interaction';

interface MapBackgroundProps {
  viewState: {
    center: number[];
    zoom: number;
  };
}

export default function MapBackground({ viewState }: MapBackgroundProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) {
      return;
    }

    const esriLayer = new TileLayer({
      source: new XYZ({
        attributions:
          'Tiles © <a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer">ArcGIS</a>',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      }),
    });

    const view = new View({
      center: viewState.center,
      zoom: viewState.zoom,
    });

    const map = new Map({
      target: mapRef.current,
      layers: [esriLayer],
      view: view,
      controls: [],
      interactions: [new DragPan(), new MouseWheelZoom()],
    });

    mapInstance.current = map;

    return () => {
      map.setTarget(undefined);
      mapInstance.current = null;
    };
  }, []); // Only run on initial mount

  useEffect(() => {
    if (mapInstance.current) {
      const view = mapInstance.current.getView();
      view.animate({ center: viewState.center, zoom: viewState.zoom, duration: 1000 });
    }
  }, [viewState]);

  return (
    <div
      ref={mapRef}
      className="absolute inset-0 -z-20 bg-cover bg-center"
      style={{ filter: 'grayscale(80%) contrast(1.1)' }}
    ></div>
  );
}
