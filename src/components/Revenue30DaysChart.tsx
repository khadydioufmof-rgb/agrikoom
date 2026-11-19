import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatFcfa } from '../i18n/translations';
import type { DebtPayment, Locale, Sale } from '../types/agrikoom';

export interface DailyRevenue30Point {
  iso: string;
  shortDate: string;
  fullDate: string;
  dayRev: number;
  dayCash: number;
  dayMomo: number;
  dayCredit: number;
  dayRec: number;
  txCount: number;
}

interface Revenue30DaysChartProps {
  sales: Sale[];
  debtPayments?: DebtPayment[];
  locale: Locale;
}

interface TooltipPayloadItem {
  payload?: DailyRevenue30Point;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  locale: Locale;
}

const Custom30DayTooltip: React.FC<CustomTooltipProps> = ({ active, payload, locale }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-md text-xs space-y-1.5 min-w-[225px]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
        <p className="font-display font-bold text-[#1E293B]">{point.fullDate}</p>
        <span className="font-mono-num text-[11px] font-semibold text-slate-500">
          {point.txCount}{' '}
          {locale === 'fr' ? (point.txCount > 1 ? 'ventes' : 'vente') : point.txCount > 1 ? 'sales' : 'sale'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-[#2E7D32] shrink-0" />
          {locale === 'fr' ? "Chiffre d'affaires" : 'Daily revenue'}
        </span>
        <span className="font-mono-num font-bold text-[#2E7D32]">{formatFcfa(point.dayRev)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-slate-500">
        <span>{locale === 'fr' ? 'Espèces / Mobile Money' : 'Cash / Mobile Money'}</span>
        <span className="font-mono-num font-semibold text-[#1E293B]">
          {formatFcfa(point.dayCash + point.dayMomo)}
        </span>
      </div>
      {point.dayCredit > 0 && (
        <div className="flex items-center justify-between gap-4 text-slate-500">
          <span>{locale === 'fr' ? 'Ventes à crédit' : 'Credit sales'}</span>
          <span className="font-mono-num font-semibold text-[#B45309]">
            {formatFcfa(point.dayCredit)}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1.5">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1A73E8] shrink-0" />
          {locale === 'fr' ? 'Recouvrements' : 'Collections'}
        </span>
        <span className="font-mono-num font-semibold text-[#1A73E8]">{formatFcfa(point.dayRec)}</span>
      </div>
    </div>
  );
};

export const Revenue30DaysChart: React.FC<Revenue30DaysChartProps> = ({
  sales,
  debtPayments = [],
  locale,
}) => {
  const { series, total30Revenue, avgDailyRevenue, bestDayPeak, activeDaysCount } = useMemo(() => {
    const intlLocale = locale === 'fr' ? 'fr-FR' : 'en-US';
    const salesByDay = new Map<
      string,
      { rev: number; cash: number; momo: number; credit: number; count: number }
    >();

    for (const s of sales) {
      if (s.status !== 'completed') continue;
      const iso = (s.createdAt || '').slice(0, 10);
      if (!iso) continue;
      const bucket = salesByDay.get(iso) || { rev: 0, cash: 0, momo: 0, credit: 0, count: 0 };
      bucket.rev += s.totalFcfa || 0;
      bucket.cash += s.cashFcfa || 0;
      bucket.momo += s.mobileMoneyFcfa || 0;
      bucket.credit += s.creditFcfa || 0;
      bucket.count += 1;
      salesByDay.set(iso, bucket);
    }

    const recByDay = new Map<string, number>();
    for (const p of debtPayments) {
      const iso = (p.createdAt || '').slice(0, 10);
      if (!iso) continue;
      recByDay.set(iso, (recByDay.get(iso) || 0) + (p.amountFcfa || 0));
    }

    const nowMs = Date.now();
    const points: DailyRevenue30Point[] = Array.from({ length: 30 }, (_, idx) => {
      const d = new Date(nowMs - (29 - idx) * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const shortDate = d.toLocaleDateString(intlLocale, {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'UTC',
      });
      const fullDate = d.toLocaleDateString(intlLocale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
      const daySales = salesByDay.get(iso);
      return {
        iso,
        shortDate,
        fullDate,
        dayRev: daySales?.rev || 0,
        dayCash: daySales?.cash || 0,
        dayMomo: daySales?.momo || 0,
        dayCredit: daySales?.credit || 0,
        dayRec: recByDay.get(iso) || 0,
        txCount: daySales?.count || 0,
      };
    });

    const total = points.reduce((sum, pt) => sum + pt.dayRev, 0);
    const avg = Math.round(total / 30);
    const peak = points.reduce((max, pt) => (pt.dayRev > max ? pt.dayRev : max), 0);
    const activeDays = points.filter((pt) => pt.dayRev > 0).length;

    return {
      series: points,
      total30Revenue: total,
      avgDailyRevenue: avg,
      bestDayPeak: peak,
      activeDaysCount: activeDays,
    };
  }, [sales, debtPayments, locale]);

  const hasAnyActivity = series.some((d) => d.dayRev > 0 || d.dayRec > 0);

  const formatYAxis = (value: number) => {
    if (value === 0) return '0';
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
    return String(value);
  };

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
      aria-label={
        locale === 'fr' ? "Courbe d'évolution du chiffre d'affaires sur 30 jours" : '30-day revenue trend curve'
      }
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#2E7D32] shrink-0" />
            <h2 className="font-display text-base font-bold text-[#1E293B]">
              {locale === 'fr'
                ? "Évolution du Chiffre d'Affaires Quotidien (30 derniers jours)"
                : 'Daily Revenue Evolution (Last 30 Days)'}
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {locale === 'fr' ? 'Cumul 30 jours : ' : '30-day total: '}
            <span className="font-mono-num font-semibold text-[#2E7D32]">{formatFcfa(total30Revenue)}</span>
            {' · '}
            {locale === 'fr' ? 'Moyenne/jour : ' : 'Daily avg: '}
            <span className="font-mono-num font-semibold text-[#1E293B]">{formatFcfa(avgDailyRevenue)}</span>
            {' · '}
            {locale === 'fr' ? 'Pic journalier : ' : 'Peak day: '}
            <span className="font-mono-num font-semibold text-[#1A73E8]">{formatFcfa(bestDayPeak)}</span>
            {' · '}
            <span className="font-mono-num font-semibold text-slate-700">{activeDaysCount}/30</span>{' '}
            {locale === 'fr' ? 'jours actifs' : 'active days'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 shrink-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#2E7D32]" />
            {locale === 'fr' ? "Chiffre d'affaires" : 'Daily revenue'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1A73E8]" />
            {locale === 'fr' ? 'Recouvrements' : 'Collections'}
          </span>
        </div>
      </div>

      {!hasAnyActivity && (
        <p className="mt-3 text-xs text-slate-500">
          {locale === 'fr'
            ? 'Aucune transaction enregistrée sur les 30 derniers jours.'
            : 'No transactions recorded in the last 30 days.'}
        </p>
      )}

      <div className="mt-5 w-full h-64 min-w-0">
        <ResponsiveContainer width="100%" height={256} minWidth={0}>
          <LineChart data={series} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="shortDate"
              axisLine={{ stroke: '#CBD5E1' }}
              tickLine={false}
              minTickGap={24}
              tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={formatYAxis}
              width={52}
              tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            />
            <Tooltip content={<Custom30DayTooltip locale={locale} />} />
            {avgDailyRevenue > 0 && (
              <ReferenceLine
                y={avgDailyRevenue}
                stroke="#94A3B8"
                strokeDasharray="4 4"
                strokeWidth={1.25}
              />
            )}
            <Line
              type="monotone"
              dataKey="dayRev"
              name={locale === 'fr' ? "Chiffre d'affaires" : 'Revenue'}
              stroke="#2E7D32"
              strokeWidth={2.5}
              dot={{ r: 2, fill: '#2E7D32', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#2E7D32', stroke: '#FFFFFF', strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="dayRec"
              name={locale === 'fr' ? 'Recouvrements' : 'Collections'}
              stroke="#1A73E8"
              strokeWidth={1.75}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4, fill: '#1A73E8', stroke: '#FFFFFF', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
