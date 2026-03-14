/**
 * Lazy-loaded Bar Chart Component
 * Separated from main bundle to improve initial LCP
 */

import React from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ChartData {
  name: string;
  value: number;
}

interface RechartsBarChartProps {
  data: ChartData[];
  dataKey?: string;
  height?: number;
  highlightLast?: boolean;
  highlightColor?: string;
  defaultColor?: string;
}

const RechartsBarChart: React.FC<RechartsBarChartProps> = ({ 
  data, 
  dataKey = 'value',
  height = 160,
  highlightLast = true,
  highlightColor = '#3b82f6',
  defaultColor = '#3b82f640'
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <XAxis 
          dataKey="name" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 10, fill: '#888', fontWeight: 700 }} 
        />
        <Tooltip
          cursor={{ fill: 'transparent' }}
          contentStyle={{ 
            borderRadius: '16px', 
            background: 'rgba(0,0,0,0.8)', 
            border: 'none', 
            color: '#fff', 
            backdropFilter: 'blur(8px)' 
          }}
          itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
        />
        <Bar dataKey={dataKey} radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={highlightLast && index === data.length - 1 ? highlightColor : defaultColor} 
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default RechartsBarChart;
