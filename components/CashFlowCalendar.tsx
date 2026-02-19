import React, { useMemo } from 'react';
import { AppState } from '../types';
import { generateCashFlowForecast, DayForecast } from '../utils/cashflow';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface CashFlowCalendarProps {
    state: AppState;
}

export const CashFlowCalendar: React.FC<CashFlowCalendarProps> = ({ state }) => {
    const forecast = useMemo(() => generateCashFlowForecast(state), [state]);

    const dangerDays = forecast.filter(d => d.type === 'danger');

    // Custom Tooltip for Chart
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-surface p-3 border border-gray-100 dark:border-gray-800 rounded-xl shadow-xl text-xs">
                    <p className="font-bold mb-1">{new Date(label).toDateString()}</p>
                    <p className="text-primary font-black">
                        Balance: ₹{payload[0].value.toFixed(0)}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-surface rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span>📅</span> 30-Day Cash Flow Forecast
                </h3>

                {/* Chart Section */}
                <div className="h-48 w-full mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={forecast}>
                            <defs>
                                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 8 }}
                                tickFormatter={(val) => new Date(val).getDate().toString()}
                                minTickGap={10}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine y={0} stroke="red" strokeDasharray="3 3" />
                            <Area
                                type="monotone"
                                dataKey="projectedBalance"
                                stroke="var(--primary)"
                                fillOpacity={1}
                                fill="url(#colorBalance)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1 mb-4">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                        <div key={d} className="text-center text-[9px] font-black text-text-light opacity-50">{d}</div>
                    ))}
                    {forecast.map((day) => {
                        const isToday = new Date().toISOString().split('T')[0] === day.date;
                        let bgClass = "bg-gray-50 dark:bg-gray-900/50";
                        let textClass = "text-text-light";

                        if (day.type === 'danger') {
                            bgClass = "bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50";
                            textClass = "text-red-500";
                        } else if (day.type === 'bill_day') {
                            bgClass = "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/50";
                            textClass = "text-yellow-600";
                        } else if (day.projectedBalance > 0) {
                            bgClass = "bg-green-50 dark:bg-green-900/20";
                            textClass = "text-green-600";
                        }

                        return (
                            <div
                                key={day.date}
                                className={`aspect-square rounded-lg flex flex-col items-center justify-center relative group cursor-pointer transition-all hover:scale-105 ${bgClass} ${isToday ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                                title={`Date: ${day.date}\nBalance: ₹${day.projectedBalance.toFixed(0)}\nEvents: ${day.events.map(e => e.label).join(', ')}`}
                            >
                                <span className="text-[9px] font-bold opacity-70 mb-0.5">{day.dayOfMonth}</span>
                                <span className={`text-[8px] font-black ${textClass} mask-value`}>
                                    {Math.abs(day.projectedBalance) >= 1000
                                        ? (day.projectedBalance / 1000).toFixed(1) + 'k'
                                        : day.projectedBalance.toFixed(0)}
                                </span>

                                {day.events.length > 0 && (
                                    <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-primary/80 animate-pulse"></div>
                                )}

                                {/* Hover Popover */}
                                {day.events.length > 0 && (
                                    <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-32 bg-black/90 text-white p-2 rounded-lg z-20 pointer-events-none">
                                        <p className="text-[9px] font-bold border-b border-white/20 pb-1 mb-1 text-center">{day.date}</p>
                                        {day.events.map((e, idx) => (
                                            <div key={idx} className="flex justify-between text-[9px] mb-0.5">
                                                <span>{e.label}</span>
                                                <span className="font-bold text-red-300">-₹{e.amount}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Danger Zones */}
                {dangerDays.length > 0 && (
                    <div className="mt-4 bg-red-50 dark:bg-red-900/10 rounded-xl p-3 border border-red-100 dark:border-red-900/30">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">⚠️</span>
                            <h4 className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-wide">Cash Flow Warning</h4>
                        </div>
                        <p className="text-[10px] text-red-700 dark:text-red-300 mb-2">
                            Projected balance hits negative on <strong>{dangerDays.length} days</strong>.
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {dangerDays.slice(0, 5).map(d => (
                                <div key={d.date} className="bg-white dark:bg-black/20 px-2 py-1 rounded text-[9px] font-bold text-red-500 whitespace-nowrap border border-red-100 dark:border-red-900/50">
                                    {d.date} (₹{d.projectedBalance.toFixed(0)})
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
