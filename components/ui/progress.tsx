// src/components/ui/progress.tsx

"use client"

import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as React from "react";

import { getUsageColor } from "@/lib/helpers/get-usage-color";
import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => {
  // ✨ Calculate the color based on the current value
  const indicatorColor = getUsageColor(value as number)

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary", // Changed height and background for better visibility
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 transition-all" // 🎨 `bg-primary` is removed
        style={{
          backgroundColor: indicatorColor, // 🎨 Color is applied dynamically here
          transform: `translateX(-${100 - (value || 0)}%)`,
        }}
      />
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress };
