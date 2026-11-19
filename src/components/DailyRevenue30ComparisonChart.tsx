import React, { useMemo, useState } from 'react';
import { ArrowUpRight, BarChart3, ShoppingCart, TrendingDown, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatFcfa } from '../i18n/translations';
import type { Locale, Sale } from '../types/agrikoom';

interface DailyRevenue30ComparisonChartProps {
  sales: Sale[];
  locale: Locale;
  onNavigatePos?: () => void;
}

type ComparisonMode = 'period' | 'channel';

interface DailyComparisonPoint {
  iso: string;
  prevIso: string;
  shortDate: string;
  fullDate: string;
  prevFullDate: string;
  currentRev: number;
  previousRev: number;
  cashFcfa: number;
  mobileMoneyFcfa: number;
  creditFcfa: number;
  txCount: number;
  prevTxCount: number;
  deltaFcfa: number;
  deltaPct: number | null;
  isPeak: boolean;
}

interface TooltipPayloadItem {
  payload?: DailyComparisonPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  locale: Locale;
  mode: ComparisonMode;
}

const CustomComparisonTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  locale,
  mode,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const deltaSign = point.deltaFcfa > 0 ? '+' : '';
  const deltaPctText =
    point.deltaPct === null
      ? ''
      : ` (${point.deltaPct >= 0 ? '+' : ''}${point.deltaPct.toFixed(1)} %)`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-md text-xs space-y-1.5 min-w-[245px]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
        <p className="font-display font-bold text-[#1E293B]">{point.fullDate}</p>
        <span className="font-mono-num text-[11px] font-semibold text-slate-500">
          {point.txCount}{' '}
          {locale === 'fr'
            ? point.txCount > 1
              ? 'ventes'
              : 'vente'
            : point.txCount > 1
              ? 'sales'
              : 'sale'}
        </span>
      </div>

      {mode === 'period' ? (
        <>
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span
                className="h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: point.isPeak ? '#FFB300' : '#2E7D32' }}
              />
              {locale === 'fr' ? '30 derniers jours' : 'Last 30 days'}
            </span>
            <span className="font-mono-num font-bold text-[#1E293B]">
              {formatFcfa(point.currentRev)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#CBD5E1] shrink-0" />
              {locale === 'fr'
                ? `J-30 (${point.prevFullDate})`
                : `Prior (${point.prevFullDate})`}
            </span>
            <span className="font-mono-num font-semibold text-slate-600">
              {formatFcfa(point.previousRev)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1.5">
            <span className="text-slate-600">
              {locale === 'fr' ? 'Écart journalier' : 'Daily variance'}
            </span>
            <span
              className={`font-mono-num font-bold ${
                point.deltaFcfa > 0
                  ? 'text-[#2E7D32]'
                  : point.deltaFcfa < 0
                    ? 'text-[#D32F2F]'
                    : 'text-slate-600'
              }`}
            >
              {deltaSign}
              {formatFcfa(point.deltaFcfa)}
              {deltaPctText}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <span className="font-semibold text-[#1E293B]">
              {locale === 'fr' ? 'Total des ventes' : 'Total sales'}
            </span>
            <span className="font-mono-num font-bold text-[#1E293B]">
              {formatFcfa(point.currentRev)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#2E7D32] shrink-0" />
              {locale === 'fr' ? 'Espèces' : 'Cash'}
            </span>
            <span className="font-mono-num font-semibold text-[#2E7D32]">
              {formatFcfa(point.cashFcfa)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#1A73E8] shrink-0" />
              Mobile Money
            </span>
            <span className="font-mono-num font-semibold text-[#1A73E8]">
              {formatFcfa(point.mobileMoneyFcfa)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#FFB300] shrink-0" />
              {locale === 'fr' ? 'À crédit' : 'Credit'}
            </span>
            <span className="font-mono-num font-semibold text-[#B45309]">
              {formatFcfa(point.creditFcfa)}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export const DailyRevenue30ComparisonChart: React.FC<DailyRevenue30ComparisonChartProps> = ({
  sales,
  locale,
  onNavigatePos,
}) => {
  const [mode, setMode] = useState<ComparisonMode>('period');

  const {
    series,
    totalCurrent,
    totalPrevious,
    totalCurrentTx,
    avgDailyCurrent,
    avgTicketCurrent,
    peakPoint,
    overallDeltaFcfa,
    overallDeltaPct,
    cashSharePct,
    momoSharePct,
    creditSharePct,
    hasAnySalesIn60Days,
  } = useMemo(() => {
    const intlLocale = locale === 'fr' ? 'fr-FR' : 'en-US';
    const dayBuckets = new Map<
      string,
      { rev: number; cash: number; momo: number; credit: number; txCount: number }
    >();

    for (const sale of sales) {
      if (sale.status !== 'completed') continue;
      const iso = (sale.createdAt || '').slice(0, 10);
      if (!iso) continue;
      const existing = dayBuckets.get(iso) || {
        rev: 0,
        cash: 0,
        momo: 0,
        credit: 0,
        txCount: 0,
      };
      existing.rev += sale.totalFcfa || 0;
      existing.cash += sale.cashFcfa || 0;
      existing.momo += sale.mobileMoneyFcfa || 0;
      existing.credit += sale.creditFcfa || 0;
      existing.txCount += 1;
      dayBuckets.set(iso, existing);
    }

    const nowMs = Date.now();
    const rawPoints: DailyComparisonPoint[] = Array.from({ length: 30 }, (_, idx) => {
      const currDate = new Date(nowMs - (29 - idx) * 86400000);
      const prevDate = new Date(nowMs - (59 - idx) * 86400000);

      const iso = currDate.toISOString().slice(0, 10);
      const prevIso = prevDate.toISOString().slice(0, 10);

      const shortDate = currDate.toLocaleDateString(intlLocale, {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'UTC',
      });
      const fullDate = currDate.toLocaleDateString(intlLocale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      });
      const prevFullDate = prevDate.toLocaleDateString(intlLocale, {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'UTC',
      });

      const currBucket = dayBuckets.get(iso);
      const prevBucket = dayBuckets.get(prevIso);

      const currentRev = currBucket?.rev || 0;
      const previousRev = prevBucket?.rev || 0;
      const deltaFcfa = currentRev - previousRev;
      const deltaPct =
        previousRev > 0
          ? ((currentRev - previousRev) / previousRev) * 100
          : currentRev > 0
            ? 100
            : null;

      return {
        iso,
        prevIso,
        shortDate,
        fullDate,
        prevFullDate,
        currentRev,
        previousRev,
        cashFcfa: currBucket?.cash || 0,
        mobileMoneyFcfa: currBucket?.momo || 0,
        creditFcfa: currBucket?.credit || 0,
        txCount: currBucket?.txCount || 0,
        prevTxCount: prevBucket?.txCount || 0,
        deltaFcfa,
        deltaPct,
        isPeak: false,
      };
    });

    const maxRev = rawPoints.reduce(
      (max, pt) => (pt.currentRev > max ? pt.currentRev : max),
      0
    );

    const points = rawPoints.map((pt) => ({
      ...pt,
      isPeak: maxRev > 0 && pt.currentRev === maxRev,
    }));

    const currSum = points.reduce((sum, pt) => sum + pt.currentRev, 0);
    const prevSum = points.reduce((sum, pt) => sum + pt.previousRev, 0);
    const currTx = points.reduce((sum, pt) => sum + pt.txCount, 0);
    const cashSum = points.reduce((sum, pt) => sum + pt.cashFcfa, 0);
    const momoSum = points.reduce((sum, pt) => sum + pt.mobileMoneyFcfa, 0);
    const creditSum = points.reduce((sum, pt) => sum + pt.creditFcfa, 0);

    const diff = currSum - prevSum;
    const diffPct =
      prevSum > 0 ? ((currSum - prevSum) / prevSum) * 100 : currSum > 0 ? 100 : null;

    const totalBase = Math.max(1, cashSum + momoSum + creditSum);
    const cashPct = currSum > 0 ? Math.round((cashSum / totalBase) * 100) : 0;
    const momoPct = currSum > 0 ? Math.round((momoSum / totalBase) * 100) : 0;
    const creditPct = currSum > 0 ? Math.max(0, 100 - cashPct - momoPct) : 0;

    return {
      series: points,
      totalCurrent: currSum,
      totalPrevious: prevSum,
      totalCurrentTx: currTx,
      avgDailyCurrent: Math.round(currSum / 30),
      avgTicketCurrent: currTx > 0 ? Math.round(currSum / currTx) : 0,
      peakPoint: points.find((pt) => pt.isPeak) || null,
      overallDeltaFcfa: diff,
      overallDeltaPct: diffPct,
      cashSharePct: cashPct,
      momoSharePct: momoPct,
      creditSharePct: creditPct,
      hasAnySalesIn60Days: currSum > 0 || prevSum > 0,
    };
  }, [sales, locale]);

  const formatYAxis = (value: number) => {
    if (value === 0) return '0';
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
    return String(value);
  };

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4"
      aria-label={
        locale === 'fr'
          ? "Comparaison du chiffre d'affaires quotidien sur les 30 derniers jours"
          : 'Daily revenue comparison over the last 30 days'
      }
    >
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#2E7D32] shrink-0" />
            <h2 className="font-display text-base font-bold text-[#1E293B]">
              {locale === 'fr'
                ? "Comparaison du Chiffre d'Affaires Quotidien (30 derniers jours)"
                : 'Daily Revenue Comparison (Last 30 Days)'}
            </h2>
          </div>

          <p className="mt-1 text-xs text-slate-500">
            {locale === 'fr' ? '30 derniers jours : ' : 'Last 30 days: '}
            <span className="font-mono-num font-semibold text-[#2E7D32]">
              {formatFcfa(totalCurrent)}
            </span>
            <span aria-hidden="true"> · </span>
            {locale === 'fr' ? '30 j précédents : ' : 'Prior 30 days: '}
            <span className="font-mono-num font-semibold text-slate-700">
              {formatFcfa(totalPrevious)}
            </span>
            {overallDeltaPct !== null && (
              <>
                <span aria-hidden="true"> · </span>
                <span
                  className={`inline-flex items-center gap-0.5 font-mono-num font-semibold ${
                    overallDeltaFcfa >= 0 ? 'text-[#2E7D32]' : 'text-[#D32F2F]'
                  }`}
                >
                  {overallDeltaFcfa >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {overallDeltaPct >= 0 ? '+' : ''}
                  {overallDeltaPct.toFixed(1)} %
                </span>
              </>
            )}
            {peakPoint && (
              <>
                <span aria-hidden="true"> · </span>
                {locale === 'fr' ? 'Pic : ' : 'Peak: '}
                <span className="font-semibold text-[#1E293B]">{peakPoint.fullDate}</span>{' '}
                <span className="font-mono-num font-semibold text-[#B45309]">
                  ({formatFcfa(peakPoint.currentRev)})
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Interactive Comparison Mode Switcher */}
          <div
            role="group"
            aria-label={locale === 'fr' ? 'Mode de comparaison' : 'Comparison mode'}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1"
          >
            <button
              type="button"
              onClick={() => setMode('period')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                mode === 'period'
                  ? 'bg-white text-[#1E293B] shadow-sm'
                  : 'text-slate-600 hover:text-[#1E293B]'
              }`}
            >
              {locale === 'fr' ? 'vs 30 j précédents' : 'vs Prior 30 days'}
            </button>
            <button
              type="button"
              onClick={() => setMode('channel')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                mode === 'channel'
                  ? 'bg-white text-[#1E293B] shadow-sm'
                  : 'text-slate-600 hover:text-[#1E293B]'
              }`}
            >
              {locale === 'fr' ? 'Par canal (30 j)' : 'By channel (30d)'}
            </button>
          </div>

          {onNavigatePos && (
            <button
              type="button"
              onClick={onNavigatePos}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A73E8] hover:underline whitespace-nowrap shrink-0"
            >
              <span>{locale === 'fr' ? 'Caisse POS' : 'POS Register'}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
        {mode === 'period' ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#2E7D32]" />
              {locale === 'fr' ? '30 derniers jours' : 'Last 30 days'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#FFB300]" />
              {locale === 'fr' ? 'Meilleur jour' : 'Peak day'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#CBD5E1]" />
              {locale === 'fr' ? '30 jours précédents (J-60 à J-31)' : 'Prior 30 days'}
            </span>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#2E7D32]" />
              {locale === 'fr' ? 'Espèces' : 'Cash'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#1A73E8]" />
              Mobile Money
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#FFB300]" />
              {locale === 'fr' ? 'À crédit' : 'Credit'}
            </span>
          </>
        )}
      </div>

      {!hasAnySalesIn60Days ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#1E293B]">
              {locale === 'fr'
                ? 'Aucune vente validée sur les 60 derniers jours'
                : 'No completed sales in the last 60 days'}
            </p>
            <p className="text-xs text-slate-500">
              {locale === 'fr'
                ? 'Enregistrez une vente en Caisse POS pour comparer automatiquement le chiffre d’affaires quotidien.'
                : 'Record a sale in the POS Register to automatically compare daily revenue totals.'}
            </p>
          </div>
          {onNavigatePos && (
            <button
              type="button"
              onClick={onNavigatePos}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2E7D32] px-4 py-2 text-xs font-semibold text-white hover:bg-[#256428] transition-colors min-h-[40px] whitespace-nowrap shrink-0"
            >
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <span>{locale === 'fr' ? 'Nouvelle vente POS' : 'New POS Sale'}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="w-full h-64 min-w-0">
          <ResponsiveContainer width="100%" height={256} minWidth={0}>
            <BarChart
              data={series}
              margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
              barGap={2}
              barCategoryGap="18%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="shortDate"
                axisLine={{ stroke: '#CBD5E1' }}
                tickLine={false}
                minTickGap={22}
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
              <Tooltip
                cursor={{ fill: 'rgba(226, 232, 240, 0.35)' }}
                content={<CustomComparisonTooltip locale={locale} mode={mode} />}
              />
              {avgDailyCurrent > 0 && (
                <ReferenceLine
                  y={avgDailyCurrent}
                  stroke="#94A3B8"
                  strokeDasharray="4 4"
                  strokeWidth={1.25}
                />
              )}

              {mode === 'period' ? (
                <>
                  <Bar
                    dataKey="previousRev"
                    name={locale === 'fr' ? '30 jours précédents' : 'Prior 30 days'}
                    fill="#CBD5E1"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={14}
                  />
                  <Bar
                    dataKey="currentRev"
                    name={locale === 'fr' ? '30 derniers jours' : 'Last 30 days'}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={14}
                  >
                    {series.map((entry) => (
                      <Cell
                        key={entry.iso}
                        fill={entry.isPeak ? '#FFB300' : '#2E7D32'}
                      />
                    ))}
                  </Bar>
                </>
              ) : (
                <>
                  <Bar
                    dataKey="cashFcfa"
                    stackId="channel30"
                    name={locale === 'fr' ? 'Espèces' : 'Cash'}
                    fill="#2E7D32"
                    radius={[0, 0, 0, 0]}
                    maxBarSize={18}
                  />
                  <Bar
                    dataKey="mobileMoneyFcfa"
                    stackId="channel30"
                    name="Mobile Money"
                    fill="#1A73E8"
                    radius={[0, 0, 0, 0]}
                    maxBarSize={18}
                  />
                  <Bar
                    dataKey="creditFcfa"
                    stackId="channel30"
                    name={locale === 'fr' ? 'À crédit' : 'Credit'}
                    fill="#FFB300"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={18}
                  />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Dynamic 30-Day Totals Breakdown */}
      <div className="pt-4 border-t border-slate-100 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-slate-500">
            {locale === 'fr' ? 'Total ventes (30 j)' : 'Total sales (30d)'}
          </span>
          <p className="mt-0.5 font-mono-num text-sm font-bold text-[#1E293B]">
            {formatFcfa(totalCurrent)}
          </p>
          <p className="text-[11px] text-slate-500 font-mono-num">
            {totalCurrentTx}{' '}
            {locale === 'fr'
              ? totalCurrentTx > 1
                ? 'transactions validées'
                : 'transaction validée'
              : totalCurrentTx > 1
                ? 'completed sales'
                : 'completed sale'}
          </p>
        </div>

        <div>
          <span className="text-slate-500">
            {locale === 'fr' ? 'Écart vs période préc.' : 'Change vs prior period'}
          </span>
          <p
            className={`mt-0.5 font-mono-num text-sm font-bold ${
              overallDeltaFcfa > 0
                ? 'text-[#2E7D32]'
                : overallDeltaFcfa < 0
                  ? 'text-[#D32F2F]'
                  : 'text-[#1E293B]'
            }`}
          >
            {overallDeltaFcfa >= 0 ? '+' : ''}
            {formatFcfa(overallDeltaFcfa)}
          </p>
          <p className="text-[11px] text-slate-500 font-mono-num">
            {locale === 'fr' ? 'Base J-60 à J-31 :' : 'Prior 30d base:'}{' '}
            {formatFcfa(totalPrevious)}
          </p>
        </div>

        <div>
          <span className="text-slate-500">
            {locale === 'fr' ? 'Moyenne quotidienne' : 'Daily average'}
          </span>
          <p className="mt-0.5 font-mono-num text-sm font-bold text-[#1E293B]">
            {formatFcfa(avgDailyCurrent)}
          </p>
          <p className="text-[11px] text-slate-500 font-mono-num">
            {locale === 'fr' ? 'Panier moyen :' : 'Avg ticket:'} {formatFcfa(avgTicketCurrent)}
          </p>
        </div>

        <div>
          <span className="text-slate-500">
            {locale === 'fr' ? 'Mix encaissement (30 j)' : 'Payment mix (30d)'}
          </span>
          <p className="mt-0.5 font-mono-num text-sm font-bold text-[#1E293B]">
            Cash {cashSharePct}% · MoMo {momoSharePct}%
          </p>
          <p className="text-[11px] text-slate-500 font-mono-num">
            {locale === 'fr' ? 'Part à crédit :' : 'Credit share:'} {creditSharePct}%
          </p>
        </div>
      </div>
    </section>
  );
};
