'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { getDatabusFirestore } from '@/firebase/databus-client';
import { 
  FlaskConical, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  FolderKanban, 
  FileSpreadsheet, 
  Loader2, 
  User, 
  ExternalLink 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { evaluateReading, resolveMatrixFromPlanillaOrMedium, EvaluationResult } from '@/lib/guideline-evaluator';

export interface EnvironmentalAlert {
  id: string;
  analyte: string;
  value: string | number;
  unit?: string;
  matrix: string;
  formName: string;
  projectName: string;
  stationName: string;
  stationId?: string;
  reportId?: string;
  reportOid?: string;
  userName?: string;
  userPhoto?: string;
  date: Date;
  violations: Array<{
    fuenteNormativa: string;
    limiteTexto: string;
    comentarioTecnico?: string;
  }>;
  primaryNorm: string;
  primaryLimit: string;
  technicalComment?: string;
}

interface Props {
  onAlertClick: (alert: EnvironmentalAlert) => void;
}

const FORM_NAMES: Record<string, string> = {
  agua_superficial: 'Agua Superficial (AS-001)',
  agua_subterranea: 'Freatímetros (FTA-001)',
  calidad_aire: 'Calidad de Aire (CA-001)',
  suelo_edafologico: 'Perfil Edafológico (PE-001)',
  suelo_geotecnia: 'Mecánica de Suelos (MS-001)',
};

export default function EnvironmentalAlertsBell({ onAlertClick }: Props) {
  const [alerts, setAlerts] = useState<EnvironmentalAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastViewedAt, setLastViewedAt] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const localDb = useFirestore();
  const databusDb = useMemo(() => getDatabusFirestore(), []);

  // Cargar timestamp de última lectura
  useEffect(() => {
    const stored = localStorage.getItem('guideline_alerts_last_viewed');
    if (stored) setLastViewedAt(parseInt(stored, 10));
  }, []);

  // Actualizar contador de no leídas
  useEffect(() => {
    const count = alerts.filter(a => a.date.getTime() > lastViewedAt).length;
    setUnreadCount(count);
  }, [alerts, lastViewedAt]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      const now = Date.now();
      setLastViewedAt(now);
      setUnreadCount(0);
      localStorage.setItem('guideline_alerts_last_viewed', now.toString());
    }
  };

  useEffect(() => {
    setIsLoading(true);
    const unsubs: Array<() => void> = [];

    // Mapas en memoria para enriquecer samples con projectName y stationName
    const reportsMap = new Map<string, { projectName: string; stationName?: string; reportOid?: string }>();
    const stationsMap = new Map<string, string>();

    // 1. Escuchar reports y stations de Data Bus para nombres amigables
    if (databusDb) {
      const qRep = query(collection(databusDb, 'reports'), limit(100));
      unsubs.push(onSnapshot(qRep, snap => {
        snap.docs.forEach(d => {
          const dt = d.data();
          reportsMap.set(d.id, {
            projectName: dt.trelloCardName || 'Proyecto DPH',
            reportOid: dt.oid,
            stationName: dt.stationName
          });
        });
      }, err => console.warn('[EnvAlerts] Error reports:', err)));

      const qSt = query(collection(databusDb, 'stations'), limit(100));
      unsubs.push(onSnapshot(qSt, snap => {
        snap.docs.forEach(d => {
          const dt = d.data();
          stationsMap.set(d.id, dt.name || dt.code || 'Estación');
        });
      }, err => console.warn('[EnvAlerts] Error stations:', err)));
    }

    // Estado interno para combinar ambas fuentes (actividades y muestras)
    let activitiesAlerts: EnvironmentalAlert[] = [];
    let samplesAlerts: EnvironmentalAlert[] = [];

    const updateCombined = () => {
      const all = [...activitiesAlerts, ...samplesAlerts];
      const seenKeys = new Set<string>();
      const deduped: EnvironmentalAlert[] = [];

      all.sort((a, b) => b.date.getTime() - a.date.getTime());

      for (const item of all) {
        // Clave única por analito, valor y estación para evitar duplicados entre activity y sample
        const key = `${item.stationName}_${item.analyte}_${item.value}_${Math.floor(item.date.getTime() / (1000 * 60 * 30))}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          deduped.push(item);
        }
      }

      setAlerts(deduped);
      setIsLoading(false);
    };

    // 2. Suscripción a app_activities con actionType 'data_bus_guideline_alert'
    const targetDb = databusDb || localDb;
    if (targetDb) {
      const qAct = query(collection(targetDb, 'app_activities'), orderBy('timestamp', 'desc'), limit(50));
      unsubs.push(onSnapshot(qAct, snap => {
        activitiesAlerts = snap.docs
          .map(docSnap => {
            const data = docSnap.data();
            if (data.actionType !== 'data_bus_guideline_alert') return null;

            const date = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
            if (date.getTime() < Date.now() - 48 * 60 * 60 * 1000) return null;
            const violations = data.violations || [];
            const primary = violations[0] || {};

            return {
              id: `act-${docSnap.id}`,
              analyte: data.analyte || 'Parámetro',
              value: data.value ?? '',
              unit: data.unit || '',
              matrix: data.medium || 'agua_superficial',
              formName: data.details || 'Planilla de Monitoreo',
              projectName: data.projectName || 'Proyecto DPH',
              stationName: data.stationName || 'Estación',
              stationId: data.stationId,
              reportId: data.reportId,
              reportOid: data.reportOid,
              userName: data.userName || data.userEmail || 'Técnico de Campo',
              userPhoto: data.userPhoto,
              date,
              violations,
              primaryNorm: data.norm || primary.fuenteNormativa || 'Nivel Guía Ambiental',
              primaryLimit: data.limitText || primary.limiteTexto || '',
              technicalComment: primary.comentarioTecnico,
            } as EnvironmentalAlert;
          })
          .filter((a): a is EnvironmentalAlert => a !== null);

        updateCombined();
      }, err => console.warn('[EnvAlerts] Error app_activities:', err)));
    }

    // 3. Suscripción en tiempo real a 'samples' para detectar analitos que vulneran niveles guía
    if (databusDb) {
      const qSamples = query(collection(databusDb, 'samples'), limit(150));
      unsubs.push(onSnapshot(qSamples, snap => {
        const found: EnvironmentalAlert[] = [];

        snap.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (!data.analyte || data.value === undefined || data.value === null || data.value === '') return;

          const matrix = resolveMatrixFromPlanillaOrMedium(data.medium || data.formId);
          const evalRes: EvaluationResult = evaluateReading(matrix, data.analyte, data.value, '');

          if (evalRes.hasViolations && evalRes.primaryViolation) {
            const date = data.timestamp?.toDate 
              ? data.timestamp.toDate() 
              : data.fechaServidor?.toDate 
                ? data.fechaServidor.toDate() 
                : new Date();
            if (date.getTime() < Date.now() - 48 * 60 * 60 * 1000) return;

            const repInfo = data.reportId ? reportsMap.get(data.reportId) : null;
            const stName = data.stationId ? (stationsMap.get(data.stationId) || repInfo?.stationName || 'Estación') : 'Estación';
            const projName = repInfo?.projectName || 'Monitoreo de Campo DPH';
            const formLabel = FORM_NAMES[data.medium || data.formId] || (data.medium ? data.medium.toUpperCase() : 'Planilla');

            found.push({
              id: `smp-${docSnap.id}`,
              analyte: data.analyte,
              value: data.value,
              unit: evalRes.primaryViolation.unidadIngresada || '',
              matrix,
              formName: formLabel,
              projectName: projName,
              stationName: stName,
              stationId: data.stationId,
              reportId: data.reportId,
              reportOid: repInfo?.reportOid,
              userName: data.userEmail ? data.userEmail.split('@')[0] : 'Técnico',
              date,
              violations: evalRes.violations,
              primaryNorm: evalRes.primaryViolation.fuenteNormativa,
              primaryLimit: evalRes.primaryViolation.limiteTexto,
              technicalComment: evalRes.primaryViolation.comentarioTecnico,
            });
          }
        });

        samplesAlerts = found;
        updateCombined();
      }, err => console.warn('[EnvAlerts] Error samples:', err)));
    }

    return () => {
      unsubs.forEach(u => u());
    };
  }, [databusDb, localDb]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative text-amber-300 hover:text-amber-200 hover:bg-white/10 transition-colors cursor-pointer"
          title="Alertas de Niveles Guía Normativos"
        >
          <FlaskConical className="h-6 w-6 text-amber-300 hover:text-amber-200 drop-shadow-sm" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 min-w-5 justify-center rounded-full p-0 px-1 text-[10px] font-black bg-amber-400 hover:bg-amber-300 text-neutral-950 border border-amber-300 shadow-md animate-in zoom-in-75"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        align="end" 
        className="w-80 md:w-96 max-h-[70vh] overflow-hidden flex flex-col p-0 bg-neutral-900 border-neutral-700 text-white shadow-2xl z-50 rounded-none"
      >
        {/* Primer renglón: Aviso en desarrollo */}
        <div className="px-3 py-1.5 bg-amber-400/15 border-b border-amber-400/25 flex items-center justify-between text-[11px] text-amber-200">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse shrink-0" />
            <span className="font-semibold uppercase tracking-wider text-[10px] text-amber-300">
              En desarrollo...
            </span>
          </div>
          <span className="text-[9px] text-neutral-400 italic">
            Módulo de alertas normativas
          </span>
        </div>

        {/* Cabecera del Panel de Alertas */}
        <div className="p-3 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-amber-300" />
            <span className="font-bold text-xs uppercase tracking-wider text-amber-200">
              Alertas de Niveles Guía
            </span>
          </div>
          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-300 border-amber-400/30 font-bold px-1.5 py-0.2">
            {alerts.length} {alerts.length === 1 ? 'Alerta' : 'Alertas'}
          </Badge>
        </div>

        {/* Lista de Alertas */}
        <div className="overflow-y-auto flex-1 divide-y divide-neutral-800">
          {isLoading && alerts.length === 0 && (
            <div className="p-8 flex flex-col items-center justify-center gap-2 text-neutral-400">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              <span className="text-xs">Escaneando niveles guía ambientales...</span>
            </div>
          )}

          {alerts.length > 0 ? (
            alerts.map((alert) => (
              <DropdownMenuItem
                key={alert.id}
                onSelect={() => onAlertClick(alert)}
                className="h-auto items-start gap-2.5 p-3 cursor-pointer hover:bg-neutral-800/80 focus:bg-neutral-800/80 text-white border-none rounded-none transition-colors"
              >
                <div className="mt-1 p-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>

                <div className="flex-1 space-y-1 text-xs">
                  {/* Analito y Valor */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-white text-[13px] leading-tight">
                      {alert.analyte}
                    </span>
                    <span className="font-mono font-bold text-amber-400 text-xs px-1.5 py-0.5 bg-amber-950/60 border border-amber-700/50 rounded-sm">
                      {alert.value} {alert.unit}
                    </span>
                  </div>

                  {/* Norma y Límite */}
                  <div className="text-[11px] text-amber-200/90 leading-snug">
                    <span className="font-semibold">{alert.primaryNorm}</span>
                    {alert.primaryLimit && (
                      <span className="text-neutral-400 ml-1">({alert.primaryLimit})</span>
                    )}
                  </div>

                  {/* Metadatos: Proyecto, Estación, Planilla */}
                  <div className="pt-1 space-y-0.5 text-[10px] text-neutral-400">
                    <div className="flex items-center gap-1 truncate text-neutral-300">
                      <FolderKanban className="h-3 w-3 text-blue-400 shrink-0" />
                      <span className="truncate font-medium">{alert.projectName}</span>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-neutral-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5 text-teal-400 shrink-0" />
                        {alert.stationName}
                      </span>
                      <span className="flex items-center gap-1 text-neutral-500">
                        <FileSpreadsheet className="h-2.5 w-2.5 shrink-0" />
                        {alert.formName}
                      </span>
                    </div>
                  </div>

                  {/* Pie: Tiempo */}
                  <div className="flex items-center justify-between pt-1 text-[9px] text-neutral-500 border-t border-neutral-800/60 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDistanceToNow(alert.date, { addSuffix: true, locale: es })}
                    </span>
                    <span className="text-amber-500/80 hover:text-amber-400 flex items-center gap-0.5 font-medium">
                      Ver en CartoDEA <ExternalLink className="h-2.5 w-2.5" />
                    </span>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          ) : !isLoading && (
            <div className="p-8 text-center text-neutral-400 space-y-1">
              <FlaskConical className="h-8 w-8 mx-auto text-neutral-600 mb-2 opacity-50" />
              <p className="text-xs font-medium">No se registran vulneraciones normativas.</p>
              <p className="text-[10px] text-neutral-500">Todos los analitos reportados se encuentran dentro de los niveles guía.</p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

