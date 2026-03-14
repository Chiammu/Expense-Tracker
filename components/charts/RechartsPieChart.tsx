/**
 * Lazy-loaded Pie Chart Component
 * Separated from main bundle to improve initial LCP
 */

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ChartData {
  name: string;
  value: number;
  color?: string;
}

interface RechartsPieChartProps {
  data: ChartData[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
}

const COLORS = ['#e91e63', '#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4'];

const RechartsPieChart: React.FC<RechartsPieChartProps> = ({ 
  data, 
  height = 200,
  innerRadius = 50,
  outerRadius = 80,
  showLegend = false
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry.color || COLORS[index % COLORS.length]} 
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ 
            borderRadius: '12px', 
            background: 'rgba(0,0,0,0.85)', 
            border: 'none', 
            color: '#fff' 
          }}
          itemStyle={{ color: '#fff', fontSize: '12px' }}
        />
        {showLegend && (
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value) => <span className="text-xs text-gray-600 dark:text-gray-300">{value}</span>}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
};

export default RechartsPieChart;
