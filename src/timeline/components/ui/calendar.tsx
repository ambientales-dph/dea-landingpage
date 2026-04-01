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
      className={cn("p-4 bg-white rounded-lg border-0 shadow-2xl", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center mb-4",
        caption_label: "text-base font-medium text-zinc-800 capitalize",
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1 text-zinc-500 border border-zinc-100 rounded-md"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1 text-zinc-500 border border-zinc-100 rounded-md"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex mb-2",
        weekday: "text-zinc-400 rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-1",
        day: cn(
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors flex items-center justify-center rounded-md text-sm"
        ),
        selected:
          "bg-zinc-200 text-zinc-900 font-bold hover:bg-zinc-200 hover:text-zinc-900 focus:bg-zinc-200 focus:text-zinc-900",
        today: "text-primary font-black underline underline-offset-4",
        outside:
          "day-outside text-zinc-300 aria-selected:bg-zinc-100/50 aria-selected:text-zinc-300",
        disabled: "text-zinc-200 opacity-50",
        range_middle: "aria-selected:bg-zinc-100 aria-selected:text-zinc-900",
        hidden: "invisible",
        dropdowns: "flex justify-center gap-2 mb-4 relative z-20",
        dropdown: "p-1 text-[10px] border border-zinc-200 rounded bg-white text-zinc-900 focus:ring-1 focus:ring-primary outline-none cursor-pointer",
        dropdown_month: "font-medium min-w-[80px]",
        dropdown_year: "font-medium min-w-[60px]",
        ...classNames,
      }}
      components={{
        Chevron: ({ ...props }) => {
          if (props.orientation === 'left') {
            return <ChevronLeft className="h-4 w-4" />
          }
          return <ChevronRight className="h-4 w-4" />
        }
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
