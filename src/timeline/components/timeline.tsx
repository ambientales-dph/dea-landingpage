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
  getMonth,
  getYear,
  differenceInDays,
  eachDayOfInterval,
  eachHourOfInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, XAxis } from 'recharts';

interface TimelineProps {
  milestones: Milestone[];
  startDate: Date;
  endDate: Date;
  onMilestoneClick: (milestone: Milestone) => void;
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

export function Timeline({ milestones, startDate, endDate, onMilestoneClick }: TimelineProps) {
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
      dateMarkers = eachDayOfInterval({ start: timelineStart, end: timelineEnd }).map(d => ({ date: d, label: '', dayLabel: format(d, 'd') }));
      centralMonthLabel = format(new Date(timelineStart.getTime() + totalTimelineDuration/2), 'MMMM yyyy', { locale: es });
    } else {
      dateMarkers = eachMonthOfInterval({ start: timelineStart, end: timelineEnd }).map(d => ({ date: d, label: format(d, 'MMM yy', { locale: es }) }));
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
        <div className="absolute inset-x-0 bottom-7 h-32 z-0 pointer-events-none opacity-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activityData} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#888888" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#888888" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide type="number" domain={[startTime, endTime]} />
              <Area type="monotone" dataKey="count" stroke="#888888" strokeWidth={1} fill="url(#colorActivity)" isAnimationActive={false}/>
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

        <TooltipProvider>
          {visibleMilestones.map(milestone => {
            const position = filePositions.get(milestone.id) ?? 0;
            const height = heights.current.get(milestone.id) ?? 60;
            return (
              <div key={milestone.id} className={cn("absolute bottom-7 flex flex-col items-center", activeMilestoneId === milestone.id ? 'z-30' : 'z-20')} style={{ left: `${position}%`, transform: 'translateX(-50%)' }}>
                <Tooltip delayDuration={100} onOpenChange={o => setActiveMilestoneId(o ? milestone.id : null)}>
                  <TooltipTrigger asChild>
                    <div className="relative flex flex-col-reverse items-center cursor-pointer group" onClick={() => onMilestoneClick(milestone)}>
                       <div className="w-px bg-gray-300" style={{ height: `${height}px` }} />
                       <div className="w-2.5 h-2.5 rounded-full border-2 border-background shadow-md group-hover:scale-125 transition-transform" style={{ backgroundColor: milestone.category.color }} />
                       {milestone.isImportant && <div style={{ bottom: `${height + 10}px`}} className="absolute"><Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /></div>}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent><p className="font-semibold">{milestone.name}</p></TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}
