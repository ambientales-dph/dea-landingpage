
"use client"

import * as React from "react"
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
      className={cn("p-3 bg-white rounded-md border border-zinc-300 shadow-2xl", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-start pt-1 relative items-center mb-2",
        caption_label: "hidden",
        nav: "hidden", // Ocultamos definitivamente las flechas de navegación
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-zinc-500 rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 text-zinc-900 hover:bg-zinc-200 hover:text-zinc-900"
        ),
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-zinc-200 text-zinc-900 font-bold",
        outside:
          "day-outside text-zinc-400 aria-selected:bg-zinc-100/50 aria-selected:text-zinc-400",
        disabled: "text-zinc-300 opacity-50",
        range_middle: "aria-selected:bg-zinc-100 aria-selected:text-zinc-900",
        hidden: "invisible",
        dropdowns: "flex justify-start gap-2 mb-4 relative z-20", // Alineado a la izquierda
        dropdown: "p-1 text-[10px] border border-zinc-300 rounded bg-white text-zinc-900 focus:ring-1 focus:ring-primary outline-none cursor-pointer",
        dropdown_month: "font-medium min-w-[80px]",
        dropdown_year: "font-medium min-w-[60px]",
        ...classNames,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
