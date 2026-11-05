'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Database,
  HardDrive,
  Activity,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  PenTool,
  Trash2,
  Folder,
  Layers,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollectionStat {
  name: string;
  label: string;
  docCount: number;
  bytes: number;
}

interface FolderStat {
  folder: string;
  label: string;
  fileCount: number;
  bytes: number;
}

interface DailyHistoryItem {
  date: string;
  label: string;
  reads: number;
  writes: number;
  deletes: number;
}

interface FirebaseResourcesData {
  account: {
    ownerEmail: string;
    projectId: string;
    tierName: string;
    quotaResetInfo: string;
  };
  firestore: {
    usedBytes: number;
    estimatedCollectionsBytes: number;
    cloudReportedBytes: number | null;
    remainingBytes: number;
    limitBytes: number;
    totalDocs: number;
    collections: CollectionStat[];
    lastScannedAt: string;
  };
  storage: {
    bucketName: string;
    usedBytes: number;
    remainingBytes: number;
    limitBytes: number;
    totalFiles: number;
    folders: FolderStat[];
  };
  operations: {
    today: {
      date: string;
      reads: { used: number; limit: number; remaining: number };
      writes: { used: number; limit: number; remaining: number };
      deletes: { used: number; limit: number; remaining: number };
    };
    history7Days: DailyHistoryItem[];
  };
  fetchedAt: string;
}

interface FirebaseResourcesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function getUsageColorClass(pct: number): {
  bar: string;
  badge: string;
  text: string;
} {
  if (pct >= 85) {
    return {
      bar: 'bg-red-500',
      badge: 'bg-red-100 text-red-700 border-red-200',
      text: 'text-red-600',
    };
  }
  if (pct >= 60) {
    return {
      bar: 'bg-amber-500',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      text: 'text-amber-600',
    };
  }
  return {
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    text: 'text-emerald-600',
  };
}

export default function FirebaseResourcesDialog({
  isOpen,
  onOpenChange,
}: FirebaseResourcesDialogProps) {
  const [data, setData] = useState<FirebaseResourcesData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async (forceRefresh: boolean = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const url = forceRefresh ? '/api/firebase-resources?refresh=1' : '/api/firebase-resources';
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'No se pudieron obtener las métricas de Firebase.');
      }
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error de conexión al consultar recursos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchMetrics(false);
    }
  }, [isOpen, fetchMetrics]);

  const firestorePct = data
    ? Math.min(100, (data.firestore.usedBytes / data.firestore.limitBytes) * 100)
    : 0;
  const storagePct = data
    ? Math.min(100, (data.storage.usedBytes / data.storage.limitBytes) * 100)
    : 0;

  const readsPct = data
    ? Math.min(100, (data.operations.today.reads.used / data.operations.today.reads.limit) * 100)
    : 0;
  const writesPct = data
    ? Math.min(100, (data.operations.today.writes.used / data.operations.today.writes.limit) * 100)
    : 0;
  const deletesPct = data
    ? Math.min(100, (data.operations.today.deletes.used / data.operations.today.deletes.limit) * 100)
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[86vh] flex flex-col p-0 border-0 shadow-2xl overflow-hidden bg-white text-zinc-900">
        {/* Encabezado */}
        <DialogHeader className="bg-zinc-900 text-white p-5 shrink-0 border-b border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-emerald-400 shrink-0" />
                <DialogTitle className="text-base md:text-lg font-bold tracking-tight text-white">
                  Administración de Recursos Firebase
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-zinc-400">
                Monitoreo en tiempo real de espacio ocupado, cuota restante y operaciones diarias (Cloud Monitoring).
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchMetrics(true)}
                disabled={isLoading}
                className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700 hover:text-white gap-1.5"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
                <span>Actualizar</span>
              </Button>
              <a
                href={`https://console.firebase.google.com/project/${data?.account.projectId || 'studio-1428739321-e57bb'}/usage`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs bg-primary/20 border-primary/40 text-sky-300 hover:bg-primary/30 hover:text-white gap-1.5"
                >
                  <span>Consola Firebase</span>
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            </div>
          </div>

          {data && (
            <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] text-zinc-300">
              <Badge variant="outline" className="bg-zinc-800/90 text-emerald-300 border-emerald-500/30 font-medium gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                Cuenta: {data.account.ownerEmail}
              </Badge>
              <Badge variant="outline" className="bg-zinc-800/90 text-zinc-300 border-zinc-700 font-mono text-[10px]">
                Proyecto: {data.account.projectId}
              </Badge>
              <Badge variant="outline" className="bg-zinc-800/90 text-sky-300 border-sky-500/30 text-[10px]">
                {data.account.tierName}
              </Badge>
              <span className="text-[10px] text-zinc-400 ml-auto">
                {data.account.quotaResetInfo}
              </span>
            </div>
          )}
        </DialogHeader>

        {/* Cuerpo desplazable */}
        <ScrollArea className="flex-1 bg-zinc-50/70">
          <div className="p-5 space-y-6">
            {isLoading && !data ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-9 w-9 animate-spin text-primary" />
                <p className="text-xs font-medium text-muted-foreground">
                  Consultando métricas de Firestore, Firebase Storage y Google Cloud Monitoring...
                </p>
              </div>
            ) : error ? (
              <div className="p-6 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold">Error al cargar métricas</p>
                  <p className="text-xs">{error}</p>
                  <Button size="sm" variant="outline" onClick={() => fetchMetrics(true)} className="mt-2 h-7 text-xs">
                    Reintentar
                  </Button>
                </div>
              </div>
            ) : data ? (
              <>
                {/* SECCIÓN 1: ALMACENAMIENTO FIRESTORE Y STORAGE */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                      <HardDrive className="h-4 w-4 text-primary" />
                      1. Espacio de Almacenamiento Ocupado y Restante
                    </h3>
                    <span className="text-[10px] text-muted-foreground">
                      Actualizado: {new Date(data.fetchedAt).toLocaleTimeString('es-AR')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Tarjeta Firestore Storage */}
                    <div className="bg-white rounded-xl border border-zinc-200/90 shadow-sm p-4 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                              <Database className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-zinc-900">Cloud Firestore (Base de Datos)</h4>
                              <p className="text-[11px] text-zinc-500">
                                {data.firestore.totalDocs.toLocaleString('es-AR')} documentos en {data.firestore.collections.length} colecciones
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className={cn('text-[10px] font-bold', getUsageColorClass(firestorePct).badge)}>
                            {firestorePct < 0.1 ? '< 0.1%' : `${firestorePct.toFixed(2)}%`} usado
                          </Badge>
                        </div>

                        {/* Barra de progreso */}
                        <div className="space-y-1.5">
                          <div className="h-2.5 w-full rounded-full bg-zinc-100 overflow-hidden border border-zinc-200/60">
                            <div
                              className={cn('h-full transition-all duration-500', getUsageColorClass(firestorePct).bar)}
                              style={{ width: `${Math.max(1.5, firestorePct)}%` }}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                            <div className="bg-zinc-50 rounded-lg p-2 border border-zinc-100">
                              <span className="block text-[9px] uppercase font-bold text-zinc-400">Ocupado</span>
                              <span className="text-xs font-extrabold text-zinc-900">
                                {formatBytes(data.firestore.usedBytes)}
                              </span>
                            </div>
                            <div className="bg-emerald-50/60 rounded-lg p-2 border border-emerald-100">
                              <span className="block text-[9px] uppercase font-bold text-emerald-700">Restante</span>
                              <span className="text-xs font-extrabold text-emerald-700">
                                {formatBytes(data.firestore.remainingBytes)}
                              </span>
                            </div>
                            <div className="bg-zinc-50 rounded-lg p-2 border border-zinc-100">
                              <span className="block text-[9px] uppercase font-bold text-zinc-400">Límite Capa</span>
                              <span className="text-xs font-bold text-zinc-700">
                                {formatBytes(data.firestore.limitBytes)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Desglose por colección */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            Desglose por colección en Firestore
                          </p>
                          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                            {data.firestore.collections.map((col) => (
                              <div
                                key={col.name}
                                className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-zinc-50/80 hover:bg-zinc-100/80 border border-zinc-100"
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <Layers className="h-3 w-3 text-primary shrink-0" />
                                  <span className="font-medium text-zinc-800 truncate" title={col.label}>
                                    {col.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <span className="text-[10px] text-zinc-500">{col.docCount} docs</span>
                                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-mono">
                                    {formatBytes(col.bytes)}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tarjeta Firebase Storage */}
                    <div className="bg-white rounded-xl border border-zinc-200/90 shadow-sm p-4 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                              <HardDrive className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-zinc-900">Firebase Storage (Archivos y Capas)</h4>
                              <p className="text-[11px] text-zinc-500">
                                {data.storage.totalFiles.toLocaleString('es-AR')} archivos en bucket{' '}
                                <span className="font-mono text-[10px]">{data.storage.bucketName}</span>
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className={cn('text-[10px] font-bold', getUsageColorClass(storagePct).badge)}>
                            {storagePct.toFixed(1)}% usado
                          </Badge>
                        </div>

                        {/* Barra de progreso */}
                        <div className="space-y-1.5">
                          <div className="h-2.5 w-full rounded-full bg-zinc-100 overflow-hidden border border-zinc-200/60">
                            <div
                              className={cn('h-full transition-all duration-500', getUsageColorClass(storagePct).bar)}
                              style={{ width: `${Math.max(1.5, storagePct)}%` }}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                            <div className="bg-zinc-50 rounded-lg p-2 border border-zinc-100">
                              <span className="block text-[9px] uppercase font-bold text-zinc-400">Ocupado</span>
                              <span className="text-xs font-extrabold text-zinc-900">
                                {formatBytes(data.storage.usedBytes)}
                              </span>
                            </div>
                            <div className="bg-emerald-50/60 rounded-lg p-2 border border-emerald-100">
                              <span className="block text-[9px] uppercase font-bold text-emerald-700">Restante</span>
                              <span className="text-xs font-extrabold text-emerald-700">
                                {formatBytes(data.storage.remainingBytes)}
                              </span>
                            </div>
                            <div className="bg-zinc-50 rounded-lg p-2 border border-zinc-100">
                              <span className="block text-[9px] uppercase font-bold text-zinc-400">Límite Capa</span>
                              <span className="text-xs font-bold text-zinc-700">
                                {formatBytes(data.storage.limitBytes)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Desglose por carpeta de Storage */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            Desglose por directorio en Storage
                          </p>
                          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                            {data.storage.folders.map((fld) => (
                              <div
                                key={fld.folder}
                                className="flex items-center justify-between text-[11px] py-1.5 px-2 rounded bg-zinc-50/80 hover:bg-zinc-100/80 border border-zinc-100"
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                  <div className="truncate">
                                    <span className="font-medium text-zinc-800">{fld.label}</span>
                                    <span className="text-[9px] font-mono text-zinc-400 ml-1.5">/{fld.folder}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <span className="text-[10px] text-zinc-500">{fld.fileCount} arch.</span>
                                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-mono">
                                    {formatBytes(fld.bytes)}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* SECCIÓN 2: SEGUIMIENTO DIARIO DE LECTURAS / ESCRITURAS / BORRADOS */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                      <Activity className="h-4 w-4 text-primary" />
                      2. Seguimiento Diario de Operaciones Firestore (Hoy)
                    </h3>
                    <span className="text-[10px] text-zinc-500">
                      Fuente oficial: Google Cloud Monitoring API (`firestore.googleapis.com/document/*`)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Lecturas Diarias */}
                    <div className="bg-white rounded-xl border border-zinc-200/90 shadow-sm p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-sky-50 text-sky-600 border border-sky-100">
                            <BookOpen className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-zinc-900">Lecturas Diarias</p>
                            <p className="text-[10px] text-zinc-500">Cuota: 50.000 / día</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn('text-[10px] font-bold', getUsageColorClass(readsPct).badge)}>
                          {readsPct.toFixed(1)}%
                        </Badge>
                      </div>

                      <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className={cn('h-full transition-all duration-500', getUsageColorClass(readsPct).bar)}
                          style={{ width: `${Math.max(1, readsPct)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <div>
                          <span className="block text-[9px] uppercase font-bold text-zinc-400">Usadas Hoy</span>
                          <span className="font-extrabold text-zinc-900 text-sm">
                            {data.operations.today.reads.used.toLocaleString('es-AR')}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[9px] uppercase font-bold text-emerald-700">Disponibles Hoy</span>
                          <span className="font-extrabold text-emerald-700 text-sm">
                            {data.operations.today.reads.remaining.toLocaleString('es-AR')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Escrituras Diarias */}
                    <div className="bg-white rounded-xl border border-zinc-200/90 shadow-sm p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-violet-50 text-violet-600 border border-violet-100">
                            <PenTool className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-zinc-900">Escrituras Diarias</p>
                            <p className="text-[10px] text-zinc-500">Cuota: 20.000 / día</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn('text-[10px] font-bold', getUsageColorClass(writesPct).badge)}>
                          {writesPct.toFixed(1)}%
                        </Badge>
                      </div>

                      <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className={cn('h-full transition-all duration-500', getUsageColorClass(writesPct).bar)}
                          style={{ width: `${Math.max(1, writesPct)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <div>
                          <span className="block text-[9px] uppercase font-bold text-zinc-400">Usadas Hoy</span>
                          <span className="font-extrabold text-zinc-900 text-sm">
                            {data.operations.today.writes.used.toLocaleString('es-AR')}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[9px] uppercase font-bold text-emerald-700">Disponibles Hoy</span>
                          <span className="font-extrabold text-emerald-700 text-sm">
                            {data.operations.today.writes.remaining.toLocaleString('es-AR')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Borrados Diarios */}
                    <div className="bg-white rounded-xl border border-zinc-200/90 shadow-sm p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-rose-50 text-rose-600 border border-rose-100">
                            <Trash2 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-zinc-900">Borrados Diarios</p>
                            <p className="text-[10px] text-zinc-500">Cuota: 20.000 / día</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn('text-[10px] font-bold', getUsageColorClass(deletesPct).badge)}>
                          {deletesPct.toFixed(2)}%
                        </Badge>
                      </div>

                      <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className={cn('h-full transition-all duration-500', getUsageColorClass(deletesPct).bar)}
                          style={{ width: `${Math.max(1, deletesPct)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <div>
                          <span className="block text-[9px] uppercase font-bold text-zinc-400">Usados Hoy</span>
                          <span className="font-extrabold text-zinc-900 text-sm">
                            {data.operations.today.deletes.used.toLocaleString('es-AR')}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[9px] uppercase font-bold text-emerald-700">Disponibles Hoy</span>
                          <span className="font-extrabold text-emerald-700 text-sm">
                            {data.operations.today.deletes.remaining.toLocaleString('es-AR')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Historial de los últimos 7 días */}
                  <div className="bg-white rounded-xl border border-zinc-200/90 shadow-sm p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-zinc-800">
                        Historial Diario — Últimos 7 días
                      </p>
                      <div className="flex items-center gap-3 text-[10px]">
                        <span className="inline-flex items-center gap-1 text-sky-700 font-semibold">
                          <span className="h-2 w-2 rounded-full bg-sky-500" /> Lecturas (lím. 50k)
                        </span>
                        <span className="inline-flex items-center gap-1 text-violet-700 font-semibold">
                          <span className="h-2 w-2 rounded-full bg-violet-500" /> Escrituras (lím. 20k)
                        </span>
                        <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                          <span className="h-2 w-2 rounded-full bg-rose-500" /> Borrados (lím. 20k)
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-200 text-[10px] uppercase text-zinc-500">
                            <th className="py-2 px-2 text-left font-bold">Fecha</th>
                            <th className="py-2 px-2 text-right font-bold">Lecturas</th>
                            <th className="py-2 px-2 text-right font-bold">% Cuota Lect.</th>
                            <th className="py-2 px-2 text-right font-bold">Escrituras</th>
                            <th className="py-2 px-2 text-right font-bold">% Cuota Escr.</th>
                            <th className="py-2 px-2 text-right font-bold">Borrados</th>
                            <th className="py-2 px-2 text-center font-bold">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {[...data.operations.history7Days].reverse().map((day, idx) => {
                            const rPct = (day.reads / data.operations.today.reads.limit) * 100;
                            const wPct = (day.writes / data.operations.today.writes.limit) * 100;
                            const isToday = idx === 0;
                            return (
                              <tr
                                key={day.date}
                                className={cn(
                                  'hover:bg-zinc-50/80 transition-colors',
                                  isToday && 'bg-primary/5 font-semibold'
                                )}
                              >
                                <td className="py-2 px-2 capitalize">
                                  {day.label}{' '}
                                  {isToday && (
                                    <Badge variant="default" className="ml-1 h-4 px-1 text-[8px] uppercase">
                                      Hoy
                                    </Badge>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-sky-700">
                                  {day.reads.toLocaleString('es-AR')}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-[10px] text-zinc-500">
                                  {rPct.toFixed(1)}%
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-violet-700">
                                  {day.writes.toLocaleString('es-AR')}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-[10px] text-zinc-500">
                                  {wPct.toFixed(1)}%
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-rose-700">
                                  {day.deletes.toLocaleString('es-AR')}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                                    <CheckCircle2 className="h-3 w-3" /> Holgado
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

