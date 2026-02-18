import React, { useState, useMemo } from 'react';
import { AppState } from '../types';
import { generateCashFlowForecast, getDangerZones, DayForecast } from '../utils/cashflow';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CashFlowCalendarProps {
  state: AppState;
}

export const CashFlowCalendar: React.FC<CashFlowCalendarProps> = ({ state }) => {
  const [selectedDay, setSelectedDay] = useState<DayForecast | null>(null);

  const forecast = useMemo(() => generateCashFlowForecast(state), [state]);
  const dangerZones = useMemo(() => getDangerZones(forecast), [forecast]);
  const totalMonthlyIncome = (state.incomePerson1 || 0) + (state.incomePerson2 || 0);

  const chartData = forecast.map(f => ({
    date: f.dayOfMonth,
    balance: f.projectedBalance,
    type: f.type
  }));

  const getDayColor = (day: DayForecast) => {
    if (day.type === 'danger' || day.projectedBalance < 0) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    if (day.type === 'bill_day') return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
    if (day.type === 'income_day') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    if (day.projectedBalance < totalMonthlyIncome * 0.2) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
    return 'bg-gray-50 dark:bg-gray-900/50';
  };

  const calendarDays = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push({ type: 'empty' });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dayForecast = forecast.find(f => f.dayOfMonth === i);
      days.push({
        type: 'day',
        day: i,
        forecast: dayForecast
      });
    }

    return days;
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
          <span>📊</span> 30-Day Cash Flow Forecast
        </h3>

        <div className="h-48 w-full mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fontWeight: 'bold' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9 }}
                tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(val: number) => [`₹${val.toFixed(0)}`, 'Balance']}
                labelFormatter={(label) => `Day ${label}`}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="var(--primary)"
                fill="var(--primary)"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
          <div className="grid grid-cols-7 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
              <div key={d} className="text-center text-[9px] font-black text-text-light uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays().map((item: any, idx) => {
              if (item.type === 'empty') {
                return <div key={idx} className="aspect-square"></div>;
              }
              const dayForecast = item.forecast as DayForecast;
              const isToday = dayForecast?.date === new Date().toISOString().split('T')[0];
              const hasBill = dayForecast?.events.some(e => e.type === 'bill');

              return (
                <button
                  key={idx}
                  onClick={() => dayForecast && setSelectedDay(dayForecast)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all hover:scale-105 hover:shadow-md ${getDayColor(dayForecast)}`}
                >
                  <span className="text-[10px] font-bold relative z-10">{item.day}</span>
                  {dayForecast && (
                    <div className="text-[7px] font-black mt-0.5 z-10 mask-value">
                      ₹{(dayForecast.projectedBalance / 1000).toFixed(0)}k
                    </div>
                  )}
                  {hasBill && (
                    <span className="absolute top-0.5 right-0.5 text-[7px]">📅</span>
                  )}
                  {isToday && (
                    <div className="absolute inset-0 rounded-lg ring-2 ring-primary ring-inset"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {dangerZones.length > 0 && (
          <div className="mt-4 bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
            <h4 className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <span>⚠️</span> Danger Zones
            </h4>
            <div className="space-y-2">
              {dangerZones.slice(0, 5).map((zone, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="font-bold text-red-700 dark:text-red-400">
                    Day {zone.dayOfMonth}
                  </span>
                  <span className="font-black text-red-600 dark:text-red-300 mask-value">
                    -₹{Math.abs(zone.projectedBalance).toFixed(0)}
                  </span>
                </div>
              ))}
              {dangerZones.length > 5 && (
                <div className="text-[10px] text-red-600 dark:text-red-400 font-bold text-center">
                  +{dangerZones.length - 5} more days with negative balance
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedDay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDay(null)}>
          <div className="bg-surface rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-800 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-text">
                  {new Date(selectedDay.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                <p className="text-sm text-text-light">Day {selectedDay.dayOfMonth}</p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-text-light hover:text-text text-2xl"
              >
                ×
              </button>
            </div>

            <div className={`mb-4 p-4 rounded-xl ${selectedDay.projectedBalance < 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
              <div className="text-xs font-black uppercase tracking-widest mb-1 text-text-light">
                Projected Balance
              </div>
              <div className={`text-2xl font-black mask-value ${selectedDay.projectedBalance < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                ₹{selectedDay.projectedBalance.toFixed(0)}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-black text-text-light uppercase tracking-widest">
                Events
              </h4>
              {selectedDay.events.map((event, idx) => (
                <div key={idx} className={`flex justify-between items-center p-3 rounded-lg ${
                  event.type === 'income' ? 'bg-green-50 dark:bg-green-900/20' :
                  event.type === 'bill' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                  'bg-gray-50 dark:bg-gray-900/50'
                }`}>
                  <div>
                    <div className="text-sm font-bold text-text">{event.label}</div>
                    <div className="text-[10px] uppercase font-black text-text-light">
                      {event.type}
                    </div>
                  </div>
                  <div className={`font-bold mask-value ${
                    event.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {event.amount > 0 ? '+' : ''}₹{event.amount.toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
