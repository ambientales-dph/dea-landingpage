"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 bg-white rounded-lg border border-zinc-200 shadow-2xl", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-3",
        month_caption: "flex justify-center pt-1 relative items-center mb-2",
        caption_label: "text-xs font-bold text-zinc-900 capitalize",
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "h-6 w-6 bg-transparent p-0 opacity-70 hover:opacity-100 absolute left-1 text-zinc-600 border border-zinc-100 rounded-md z-20"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "h-6 w-6 bg-transparent p-0 opacity-70 hover:opacity-100 absolute right-1 text-zinc-600 border border-zinc-100 rounded-md z-20"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex mb-1",
        weekday: "text-zinc-400 rounded-md w-8 font-medium text-[10px] uppercase",
        week: "flex w-full mt-0.5",
        day: cn(
          "h-8 w-8 p-0 font-semibold aria-selected:opacity-100 text-zinc-950 hover:bg-zinc-100 hover:text-zinc-900 transition-colors flex items-center justify-center rounded-md text-[11px] cursor-pointer"
        ),
        selected:
          "bg-zinc-200 text-zinc-950 font-black hover:bg-zinc-200 hover:text-zinc-950 focus:bg-zinc-200 focus:text-zinc-950 shadow-sm",
        today: "text-primary font-black underline underline-offset-2",
        outside:
          "day-outside text-zinc-400 opacity-50 aria-selected:bg-zinc-100/50 aria-selected:text-zinc-400",
        disabled: "text-zinc-300 opacity-40 cursor-default",
        range_middle: "aria-selected:bg-zinc-100 aria-selected:text-zinc-900",
        hidden: "invisible",
        dropdowns: "flex justify-center gap-1.5 mb-2 relative z-20",
        dropdown: "p-0.5 text-[9px] border border-zinc-200 rounded bg-white text-zinc-900 focus:ring-1 focus:ring-primary outline-none cursor-pointer font-bold",
        dropdown_month: "min-w-[70px]",
        dropdown_year: "min-w-[50px]",
        ...classNames,
      }}
      components={{
        Chevron: ({ ...props }) => {
          if (props.orientation === 'left') {
            return <ChevronLeft className="h-3.5 w-3.5" />
          }
          return <ChevronRight className="h-3.5 w-3.5" />
        }
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
