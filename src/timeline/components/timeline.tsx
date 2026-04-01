'use client';

import * as React from 'react';
import type { Milestone } from '@/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  format,
  parseISO,
  differenceInMilliseconds,
  eachMonthOfInterval,
  differenceInMonths,
  differenceInDays,
  eachDayOfInterval,
  eachHourOfInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { Star, Paperclip } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, XAxis } from 'recharts';

interface TimelineProps {
  milestones: Milestone[];
  startDate: Date;
  endDate: Date;
  onMilestoneClick: (milestone: Milestone) => void;
  isDetailOpen?: boolean;
}

interface DateMarker {
    date: Date;
    label: string; 
    dayLabel?: string; 
    monthLabel?: string; 
    position: number;
}

interface TimelineData {
  markers: DateMarker[];
  filePositions: Map<string, number>;
  visibleMilestones: Milestone[];
  centralMonthLabel?: string;
  startTime: number;
  endTime: number;
}

const STATUS_COLORS_MAP: Record<string, string> = {
    'Sin iniciar': 'red',
    'Iniciado': 'orange',
    'Neutralizado': 'pink',
    'Terminado': 'yellow',
    'Con DIA': 'green',
    'Rescindido': 'black',
    'En seguimiento': 'sky',
};

const TRELLO_HEX_MAP: Record<string, string> = {
    'green': '#4bce97',
    'yellow': '#eed12b',
    'red': '#f87168',
    'orange': '#ff9f1a',
    'purple': '#9f8fef',
    'blue': '#579dff',
    'sky': '#6cc3e0',
    'lime': '#94c748',
    'pink': '#e774bb',
    'black': '#44546f',
};

export function Timeline({ milestones, startDate, endDate, onMilestoneClick, isDetailOpen = false }: TimelineProps) {
  const [timelineData, setTimelineData] = React.useState<TimelineData | null>(null);
  const heights = React.useRef(new Map<string, number>());
  const timelineContainerRef = React.useRef<HTMLDivElement>(null);
  const [viewRange, setViewRange] = React.useState({ start: startDate, end: endDate });
  const [isPanning, setIsPanning] = React.useState(false);
  const panStartRef = React.useRef({x: 0, rangeStart: new Date(), rangeEnd: new Date()});
  const [activeMilestoneId, setActiveMilestoneId] = React.useState<string | null>(null);
  const prevMilestoneIdsRef = React.useRef<string>('');

  React.useEffect(() => {
    setViewRange({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  const activityData = React.useMemo(() => {
    if (!viewRange.start || !viewRange.end || milestones.length === 0) return [];
    
    const startTime = viewRange.start.getTime();
    const endTime = viewRange.end.getTime();
    const duration = endTime - startTime;
    const pointsCount = 150; 
    const sigma = duration / 50; 
    
    return Array.from({ length: pointsCount + 1 }).map((_, i) => {
      const pointTime = startTime + (i * duration / pointsCount);
      let sum = 0;
      milestones.forEach(m => {
        const mTime = parseISO(m.occurredAt).getTime();
        const diff = pointTime - mTime;
        if (Math.abs(diff) < sigma * 4) {
           sum += Math.exp(-Math.pow(diff, 2) / (2 * Math.pow(sigma, 2)));
        }
      });
      return { time: pointTime, count: sum };
    });
  }, [milestones, viewRange]);

  const statusSegments = React.useMemo(() => {
    const segments: { start: number; status: string; color: string }[] = [];
    
    const creationMilestone = milestones.find(m => m.id.startsWith('hito-creacion-'));
    const projectStartTime = creationMilestone ? parseISO(creationMilestone.occurredAt).getTime() : 0;

    const changeMilestones = milestones
      .filter(m => m.description?.includes('📍 HITO DE PROYECTO: El estado ha cambiado'))
      .sort((a, b) => parseISO(a.occurredAt).getTime() - parseISO(b.occurredAt).getTime());

    if (changeMilestones.length > 0) {
      const firstMatch = changeMilestones[0].description.match(/El estado ha cambiado de "(.*?)" a "(.*?)". Fecha/);
      if (firstMatch) {
        const oldStatus = firstMatch[1] === '---' ? 'Sin iniciar' : firstMatch[1];
        segments.push({
          start: projectStartTime || parseISO(changeMilestones[0].occurredAt).getTime() - 86400000,
          status: oldStatus,
          color: TRELLO_HEX_MAP[STATUS_COLORS_MAP[oldStatus] || 'red'] || '#f87168'
        });
      }

      changeMilestones.forEach(m => {
        const match = m.description.match(/a "(.*?)". Fecha/);
        if (match && match[1]) {
          const newStatus = match[1];
          segments.push({
            start: parseISO(m.occurredAt).getTime(),
            status: newStatus,
            color: TRELLO_HEX_MAP[STATUS_COLORS_MAP[newStatus] || 'red'] || '#f87168'
          });
        }
      });
    } else if (milestones.length > 0) {
      segments.push({
        start: projectStartTime || Date.now() - 31536000000,
        status: 'Sin iniciar',
        color: TRELLO_HEX_MAP['red']
      });
    }
    return segments;
  }, [milestones]);

  React.useEffect(() => {
    const currentMilestoneIds = milestones.map(m => m.id).sort().join(',');

    if (currentMilestoneIds !== prevMilestoneIdsRef.current) {
      prevMilestoneIdsRef.current = currentMilestoneIds;

      if (milestones.length > 0) {
        const newHeights = new Map<string, number>();
        const sortedMilestones = [...milestones].sort(
          (a, b) => parseISO(a.occurredAt).getTime() - parseISO(b.occurredAt).getTime()
        );

        const MIN_HEIGHT = 60;
        const MAX_HEIGHT = 150;
        const VERTICAL_SEPARATION = 35;

        const allDates = sortedMilestones.map(m => parseISO(m.occurredAt));
        const oldestTime = allDates[0]?.getTime() ?? 0;
        const newestTime = allDates[allDates.length - 1]?.getTime() ?? 0;
        const totalDuration = newestTime - oldestTime;
        const TIME_SEPARATION_THRESHOLD = totalDuration > 0 ? totalDuration * 0.015 : 1;

        const placedMilestones: { time: number; height: number }[] = [];

        sortedMilestones.forEach(milestone => {
          const milestoneTime = parseISO(milestone.occurredAt).getTime();
          let finalHeight: number = MIN_HEIGHT;
          let collision = true;
          let attempts = 0;

          while (collision && attempts < 20) {
            attempts++;
            collision = false;
            finalHeight = Math.floor(Math.random() * (MAX_HEIGHT - MIN_HEIGHT + 1)) + MIN_HEIGHT;
            for (const placed of placedMilestones) {
              const timeDiff = Math.abs(milestoneTime - placed.time);
              const heightDiff = Math.abs(finalHeight - placed.height);
              if (timeDiff < TIME_SEPARATION_THRESHOLD && heightDiff < VERTICAL_SEPARATION) {
                collision = true;
                break;
              }
            }
          }
          newHeights.set(milestone.id, finalHeight);
          placedMilestones.push({ time: milestoneTime, height: finalHeight });
        });
        heights.current = newHeights;
      }
    }
  }, [milestones]);
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const container = timelineContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseXPercent = (e.clientX - rect.left) / rect.width;
    const currentDuration = viewRange.end.getTime() - viewRange.start.getTime();
    if(currentDuration <= 0) return;
    const zoomIntensity = 0.1;
    const delta = currentDuration * zoomIntensity * (e.deltaY > 0 ? 1 : -1);
    const newStartMs = viewRange.start.getTime() - delta * mouseXPercent;
    const newEndMs = viewRange.end.getTime() + delta * (1 - mouseXPercent);
    if (newEndMs > newStartMs) {
        setViewRange({ start: new Date(newStartMs), end: new Date(newEndMs) });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 2 && e.button !== 1) return; 
    e.preventDefault();
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, rangeStart: viewRange.start, rangeEnd: viewRange.end };
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !timelineContainerRef.current) return;
    e.preventDefault();
    const deltaX = e.clientX - panStartRef.current.x;
    const fullDuration = panStartRef.current.rangeEnd.getTime() - panStartRef.current.rangeStart.getTime();
    const timeDelta = deltaX * (fullDuration / timelineContainerRef.current.offsetWidth);
    setViewRange({
        start: new Date(panStartRef.current.rangeStart.getTime() - timeDelta),
        end: new Date(panStartRef.current.rangeEnd.getTime() - timeDelta),
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  React.useEffect(() => {
    const timelineStart = viewRange.start;
    const timelineEnd = viewRange.end;
    const totalTimelineDuration = differenceInMilliseconds(timelineEnd, timelineStart);
  
    const getPositionOnTimeline = (date: Date) => {
      if (totalTimelineDuration <= 0) return 0;
      return (differenceInMilliseconds(date, timelineStart) / totalTimelineDuration) * 100;
    };
  
    const durationInDays = differenceInDays(timelineEnd, timelineStart);
    const durationInMonths = differenceInMonths(timelineEnd, timelineStart);
    let dateMarkers: Omit<DateMarker, 'position'>[] = [];
    let centralMonthLabel: string | undefined;
  
    if (durationInDays <= 1) {
      dateMarkers = eachHourOfInterval({ start: timelineStart, end: timelineEnd })
        .filter((_, i) => i % 2 === 0)
        .map(d => ({ date: d, label: format(d, 'HH:mm') }));
    } else if (durationInMonths < 1) {
      const allDays = eachDayOfInterval({ start: timelineStart, end: timelineEnd });
      const step = durationInDays > 14 ? 3 : durationInDays > 7 ? 2 : 1;
      dateMarkers = allDays
        .filter((_, i) => i % step === 0)
        .map(d => ({ date: d, label: '', dayLabel: format(d, 'd') }));
      centralMonthLabel = format(new Date(timelineStart.getTime() + totalTimelineDuration/2), 'MMMM yyyy', { locale: es });
    } else {
      const allMonths = eachMonthOfInterval({ start: timelineStart, end: timelineEnd });
      const step = durationInMonths > 24 ? 4 : durationInMonths > 12 ? 2 : 1;
      dateMarkers = allMonths
        .filter((_, i) => i % step === 0)
        .map(d => ({ date: d, label: format(d, 'MMM yy', { locale: es }) }));
    }
    
    const filePositions = new Map<string, number>();
    milestones.forEach(m => filePositions.set(m.id, getPositionOnTimeline(parseISO(m.occurredAt))));
  
    setTimelineData({
      markers: dateMarkers.map(m => ({ ...m, position: getPositionOnTimeline(m.date) })),
      filePositions,
      visibleMilestones: milestones.filter(m => {
          const pos = getPositionOnTimeline(parseISO(m.occurredAt));
          return pos >= 0 && pos <= 100;
      }),
      centralMonthLabel,
      startTime: timelineStart.getTime(),
      endTime: timelineEnd.getTime()
    });
  }, [milestones, viewRange]);


  if (milestones.length === 0) return null;

  if (!timelineData) return <div className="w-full h-full flex items-end p-8 pb-16"><Skeleton className="h-32 w-full" /></div>;

  const { markers, filePositions, visibleMilestones, centralMonthLabel, startTime, endTime } = timelineData;

  return (
    <div 
      ref={timelineContainerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      className={cn("relative w-full h-full flex items-end p-4 sm:p-8 pb-16 touch-none cursor-grab", isPanning && "cursor-grabbing")}
    >
      <div className="relative h-full w-full">
        
        {/* Barra de Estado Evolutiva - Posicionamiento Dinámico */}
        <div className={cn(
            "absolute inset-x-0 h-8 pointer-events-none z-[15] transition-all duration-500 ease-in-out",
            isDetailOpen ? "bottom-[-45px]" : "top-[15px]"
        )}>
            {statusSegments.map((seg, i) => {
                const nextStart = statusSegments[i+1]?.start || endTime;
                const duration = endTime - startTime;
                
                const left = ((seg.start - startTime) / duration) * 100;
                const right = ((nextStart - startTime) / duration) * 100;
                
                const visibleLeft = Math.max(0, left);
                const visibleRight = Math.min(100, right);
                const segmentWidth = visibleRight - visibleLeft;
                
                if (visibleRight <= visibleLeft) return null;

                const labelOffset = i % 2 === 0 ? '6px' : '18px';

                return (
                    <React.Fragment key={i}>
                        {i > 0 && left >= 0 && left <= 100 && (
                            <div 
                                className={cn(
                                    "absolute w-px h-10 bg-gray-400/50 transition-all duration-500",
                                    isDetailOpen ? "bottom-[-5px]" : "top-[-5px]"
                                )}
                                style={{ left: `${left}%` }}
                            />
                        )}
                        
                        <div 
                            className="absolute flex items-end" 
                            style={{ 
                                left: `${visibleLeft}%`, 
                                width: `${segmentWidth}%`, 
                                bottom: '2px', 
                                borderBottom: `1.5px solid ${seg.color}`,
                                opacity: 0.8
                            }}
                        >
                            <TooltipProvider>
                                <Tooltip delayDuration={300}>
                                    <TooltipTrigger asChild>
                                        <span 
                                            className="absolute left-1 text-[8px] uppercase tracking-wider font-bold truncate pointer-events-auto cursor-help transition-all duration-300"
                                            style={{ 
                                                color: seg.color, 
                                                maxWidth: 'calc(100% - 4px)',
                                                bottom: labelOffset 
                                            }}
                                        >
                                            {seg.status}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-white text-black border-zinc-200 shadow-xl">
                                        <div className="flex flex-col gap-0.5">
                                            <p className="text-[10px] font-bold">Estado: {seg.status}</p>
                                            <p className="text-[9px] text-zinc-500">Desde: {format(new Date(seg.start), "PPPp", { locale: es })}</p>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>

        <div className="absolute inset-x-0 bottom-7 h-32 z-0 pointer-events-none opacity-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activityData} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
              <XAxis dataKey="time" hide type="number" domain={[startTime, endTime]} />
              <Area type="monotone" dataKey="count" stroke="#888888" strokeWidth={1} fill="#888888" fillOpacity={0.1} isAnimationActive={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="absolute bottom-7 left-0 right-0 h-px bg-gray-400 z-10" />

        {markers.map(({ label, dayLabel, position }, i) => (
          position >= 0 && position <= 100 && (
            <div key={i} className="absolute -bottom-0.5 flex flex-col items-center z-10" style={{ left: `${position}%`, transform: 'translateX(-50%)' }}>
              <div className="h-2 w-px bg-gray-400" />
              <span className="absolute top-4 text-xs text-muted-foreground whitespace-nowrap">{dayLabel || label}</span>
            </div>
          )
        ))}

        {centralMonthLabel && <div className="absolute bottom-[-50px] w-full text-center z-10 text-lg font-bold text-muted-foreground/50 capitalize">{centralMonthLabel}</div>}

        {/* Capa 1: Palitos (Líneas verticales) - Renderizados por debajo */}
        {visibleMilestones.map(milestone => {
          const position = filePositions.get(milestone.id) ?? 0;
          const height = heights.current.get(milestone.id) ?? 60;
          return (
            <div 
              key={`stick-${milestone.id}`} 
              className="absolute bottom-7 w-px bg-gray-300 pointer-events-none z-10" 
              style={{ 
                left: `${position}%`, 
                height: `${height}px`, 
                transform: 'translateX(-50%)' 
              }} 
            />
          );
        })}

        {/* Capa 2: Globitos y Tooltips - Renderizados por encima */}
        <TooltipProvider>
          {visibleMilestones.map(milestone => {
            const position = filePositions.get(milestone.id) ?? 0;
            const height = heights.current.get(milestone.id) ?? 60;
            const hasFiles = milestone.associatedFiles && milestone.associatedFiles.length > 0;

            return (
              <div 
                key={`ball-container-${milestone.id}`} 
                className={cn(
                  "absolute flex flex-col items-center", 
                  activeMilestoneId === milestone.id ? 'z-40' : 'z-20'
                )} 
                style={{ 
                  left: `${position}%`, 
                  bottom: `calc(1.75rem + ${height}px)`, 
                  transform: 'translate(-50%, 50%)' 
                }}
              >
                <Tooltip delayDuration={100} onOpenChange={o => setActiveMilestoneId(o ? milestone.id : null)}>
                  <TooltipTrigger asChild>
                    <div className="relative cursor-pointer group" onClick={() => onMilestoneClick(milestone)}>
                       <div 
                         className="w-2.5 h-2.5 rounded-full border-2 border-background shadow-md group-hover:scale-125 transition-transform" 
                         style={{ backgroundColor: milestone.category.color }} 
                       />
                       {milestone.isImportant && (
                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1">
                           <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 drop-shadow-sm" />
                         </div>
                       )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="flex items-center gap-1.5 px-2 py-1 bg-white text-black border-zinc-200 shadow-md">
                    {hasFiles && <Paperclip className="h-3 w-3 text-zinc-500" />}
                    <p className="font-semibold text-[10px]">{milestone.name}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}
