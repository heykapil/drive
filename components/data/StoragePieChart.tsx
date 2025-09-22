'use client'

import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart'
import { getUsageColor } from '@/lib/helpers/get-usage-color'
import { Cell, Pie, PieChart } from 'recharts'

interface StorageChartProps {
  storageUsedGB: number
  availableCapacityGB: number
  usagePercentage: number
}

export function StorageChart({ storageUsedGB, availableCapacityGB, usagePercentage }: StorageChartProps) {
  // Determine color based on usage percentage for a better visual feedback

  const usedColor = getUsageColor(usagePercentage)

  const chartData = [
    { name: 'Used', value: storageUsedGB, fill: usedColor },
    { name: 'Available', value: availableCapacityGB, fill: 'var(--muted)' },
  ]

  const chartConfig = {
    storage: {
      label: 'Storage',
    },
    Used: {
      label: 'Used Storage',
      color: usedColor,
    },
    Available: {
      label: 'Available Space',
      color: 'var(--muted)',
    },
  }

  return (
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <PieChart>
            {/* Tooltip for hover details */}
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel formatter={(value) => `${Number(value).toFixed(2)} GB`} />}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius="60%"
              strokeWidth={5}
              startAngle={90}
              endAngle={450} // Full circle
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            {/* Legend to clarify colors */}
            <ChartLegend
              content={<ChartLegendContent nameKey="name" />}
              className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-auto [&>*]:justify-center"
            />
          </PieChart>
        </ChartContainer>
  )
}
