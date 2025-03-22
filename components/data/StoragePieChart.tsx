'use client'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

interface StorageChartProps {
  storageUsedGB: number;
  availableCapacityGB: number;
}

export function StorageChart({ storageUsedGB, availableCapacityGB }: StorageChartProps) {
  const totalStorageGB = storageUsedGB + availableCapacityGB;
  const usagePercentage = (storageUsedGB / totalStorageGB) * 100;

  const data = [
    { name: 'Used', value: storageUsedGB, color: '#3b82f6' },
    { name: 'Available', value: availableCapacityGB, color: '#e5e7eb' },
  ];

  return (
    <div className="relative w-24 h-24">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="80%"
            startAngle={90}
            endAngle={-270}
            paddingAngle={0}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Centered text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {usagePercentage.toFixed(1)}%
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          used
        </span>
      </div>
    </div>
  );
}
