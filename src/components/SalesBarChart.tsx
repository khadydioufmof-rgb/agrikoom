import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatFcfa } from '../i18n/translations';
import type { Locale } from '../types/agrikoom';

export interface DailySalesBarPoint {
  iso: string;
  label: string;
  totalFcfa: number;
  cashFcfa: number;
  mobileMoneyFcfa: number;
  creditFcfa: number;
  txCount: number;
}

interface SalesBarChartProps {
  data: DailySalesBarPoint[];
  locale: Locale;
}

interface TooltipPayloadItem {
  payload?: DailySalesBarPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  locale: Locale;
}

const CustomBarTooltip: React.FC<CustomTooltipProps> = ({ active, payload, locale }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-md text-xs space-y-1.5 min-w-[200px]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
        <p className="font-display font-bold text-[#1E293B]">
          {point.label} · <span className="font-mono-num font-normal text-slate-500">{point.iso}</span>
        </p>
        <span className="font-mono-num text-[11px] font-semibold text-slate-500">
          {point.txCount} {locale === 'fr' ? (point.txCount > 1 ? 'ventes' : 'vente') : point.txCount > 1 ? 'sales' : 'sale'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="font-semibold text-[#1E293B]">
          {locale === 'fr' ? 'Total ventes' : 'Total sales'}
        </span>
        <span className="font-mono-num font-bold text-[#1E293B]">{formatFcfa(point.totalFcfa)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2 w-2 rounded-sm bg-[#2E7D32]" />
          {locale === 'fr' ? 'Espèces' : 'Cash'}
        </span>
        <span className="font-mono-num font-semibold text-[#2E7D32]">{formatFcfa(point.cashFcfa)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2 w-2 rounded-sm bg-[#1A73E8]" />
          Mobile Money
        </span>
        <span className="font-mono-num font-semibold text-[#1A73E8]">{formatFcfa(point.mobileMoneyFcfa)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2 w-2 rounded-sm bg-[#FFB300]" />
          {locale === 'fr' ? 'À crédit' : 'Credit'}
        </span>
        <span className="font-mono-num font-semibold text-[#B45309]">{formatFcfa(point.creditFcfa)}</span>
      </div>
    </div>
  );
};

export const SalesBarChart: React.FC<SalesBarChartProps> = ({ data, locale }) => {
  const hasSales = data.some((d) => d.totalFcfa > 0);

  const formatYAxis = (value: number) => {
    if (value === 0) return '0';
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${Math.round(value / 1000)}k`;
    return String(value);
  };

  return (
    <div
      className="w-full min-w-0 space-y-2"
      aria-label={locale === 'fr' ? 'Graphique en barres des ventes sur 7 jours' : '7-day sales bar chart'}
    >
      {!hasSales && (
        <p className="text-xs text-slate-500">
          {locale === 'fr'
            ? 'Aucune vente enregistrée sur les 7 derniers jours.'
            : 'No sales recorded in the last 7 days.'}
        </p>
      )}
      <div className="w-full h-60 min-w-0">
        <ResponsiveContainer width="100%" height={240} minWidth={0}>
          <BarChart data={data} margin={{ top: 10, right: 14, left: 0, bottom: 4 }} barCategoryGap="24%">
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
            <Tooltip cursor={{ fill: '#F1F5F9' }} content={<CustomBarTooltip locale={locale} />} />
            <Bar
              dataKey="cashFcfa"
              stackId="sales"
              name={locale === 'fr' ? 'Espèces' : 'Cash'}
              fill="#2E7D32"
              radius={[0, 0, 0, 0]}
              maxBarSize={42}
            />
            <Bar
              dataKey="mobileMoneyFcfa"
              stackId="sales"
              name="Mobile Money"
              fill="#1A73E8"
              radius={[0, 0, 0, 0]}
              maxBarSize={42}
            />
            <Bar
              dataKey="creditFcfa"
              stackId="sales"
              name={locale === 'fr' ? 'À crédit' : 'Credit'}
              fill="#FFB300"
              radius={[6, 6, 0, 0]}
              maxBarSize={42}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
