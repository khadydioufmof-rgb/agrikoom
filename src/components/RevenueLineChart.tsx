import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatFcfa } from '../i18n/translations';
import type { Locale } from '../types/agrikoom';

export interface DailyRevenuePoint {
  iso: string;
  label: string;
  dayRev: number;
  dayRec: number;
}

interface RevenueLineChartProps {
  data: DailyRevenuePoint[];
  locale: Locale;
}

interface TooltipPayloadItem {
  dataKey?: string;
  value?: number;
  color?: string;
  payload?: DailyRevenuePoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  locale: Locale;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, locale }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-md text-xs space-y-1.5">
      <p className="font-display font-bold text-[#1E293B]">
        {point.label} · <span className="font-mono-num font-normal text-slate-500">{point.iso}</span>
      </p>
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2 w-2 rounded-full bg-[#2E7D32]" />
          {locale === 'fr' ? 'Chiffre d\'affaires' : 'POS Revenue'}
        </span>
        <span className="font-mono-num font-bold text-[#2E7D32]">{formatFcfa(point.dayRev)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2 w-2 rounded-full bg-[#1A73E8]" />
          {locale === 'fr' ? 'Recouvrements' : 'Collections'}
        </span>
        <span className="font-mono-num font-semibold text-[#1A73E8]">{formatFcfa(point.dayRec)}</span>
      </div>
    </div>
  );
};

export const RevenueLineChart: React.FC<RevenueLineChartProps> = ({ data, locale }) => {
  const hasAnyActivity = data.some((d) => d.dayRev > 0 || d.dayRec > 0);

  const formatYAxis = (value: number) => {
    if (value === 0) return '0';
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${Math.round(value / 1000)}k`;
    return String(value);
  };

  return (
    <div className="w-full min-w-0 space-y-2" aria-label={locale === 'fr' ? 'Évolution du chiffre d\'affaires sur 7 jours' : '7-day revenue trend'}>
      {!hasAnyActivity && (
        <p className="text-xs text-slate-500">
          {locale === 'fr'
            ? 'Aucune vente ou recouvrement enregistré sur les 7 derniers jours.'
            : 'No sales or collections recorded in the last 7 days.'}
        </p>
      )}
      <div className="w-full h-60 min-w-0">
        <ResponsiveContainer width="100%" height={240} minWidth={0}>
          <LineChart data={data} margin={{ top: 10, right: 14, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={formatYAxis}
            width={48}
            tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
          />
          <Tooltip content={<CustomTooltip locale={locale} />} />
          <Line
            type="monotone"
            dataKey="dayRev"
            name={locale === 'fr' ? 'Chiffre d\'affaires' : 'POS Revenue'}
            stroke="#2E7D32"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#2E7D32', strokeWidth: 2, stroke: '#FFFFFF' }}
            activeDot={{ r: 6, fill: '#2E7D32', stroke: '#FFFFFF', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="dayRec"
            name={locale === 'fr' ? 'Recouvrements' : 'Collections'}
            stroke="#1A73E8"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 3, fill: '#1A73E8', strokeWidth: 1.5, stroke: '#FFFFFF' }}
            activeDot={{ r: 5, fill: '#1A73E8', stroke: '#FFFFFF', strokeWidth: 2 }}
          />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
