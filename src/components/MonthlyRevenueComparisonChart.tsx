import React, { useMemo } from 'react';
import { ArrowUpRight, CalendarRange, TrendingDown, TrendingUp } from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatFcfa } from '../i18n/translations';
import type { DebtPayment, Locale, Sale } from '../types/agrikoom';

interface MonthlyRevenueComparisonChartProps {
  sales: Sale[];
  debtPayments: DebtPayment[];
  locale: Locale;
  onNavigateReports?: () => void;
}

interface MonthBucket {
  monthIso: string;
  shortLabel: string;
  fullLabel: string;
  revenueFcfa: number;
  cashAndMomoFcfa: number;
  creditFcfa: number;
  collectionsFcfa: number;
  trendFcfa: number;
  txCount: number;
  momDeltaPct: number | null;
  isCurrentMonth: boolean;
  isPeakMonth: boolean;
}

interface TooltipPayloadItem {
  payload?: MonthBucket;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  locale: Locale;
}

function toMonthIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const CustomMonthTooltip: React.FC<CustomTooltipProps> = ({ active, payload, locale }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  const deltaLabel =
    item.momDeltaPct === null
      ? '—'
      : `${item.momDeltaPct >= 0 ? '+' : ''}${item.momDeltaPct.toFixed(1)} %`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-md text-xs space-y-1.5 min-w-[245px]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
        <span className="font-display font-bold text-[#1E293B]">{item.fullLabel}</span>
        {item.isCurrentMonth ? (
          <span className="font-semibold text-[#1A73E8]">
            {locale === 'fr' ? 'Mois en cours' : 'Current month'}
          </span>
        ) : item.isPeakMonth ? (
          <span className="font-semibold text-[#2E7D32]">
            {locale === 'fr' ? 'Mois record' : 'Peak month'}
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#2E7D32] shrink-0" />
          {locale === 'fr' ? "Chiffre d'affaires" : 'Monthly revenue'}
        </span>
        <span className="font-mono-num font-bold text-[#1E293B]">{formatFcfa(item.revenueFcfa)}</span>
      </div>

      <div className="flex items-center justify-between gap-4 text-slate-500">
        <span>{locale === 'fr' ? 'Dont encaissé (Cash / MoMo)' : 'Collected (Cash / MoMo)'}</span>
        <span className="font-mono-num font-semibold text-[#1E293B]">
          {formatFcfa(item.cashAndMomoFcfa)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 text-slate-500">
        <span>{locale === 'fr' ? 'Ventes à crédit' : 'Credit sales'}</span>
        <span className="font-mono-num font-semibold text-[#B45309]">
          {formatFcfa(item.creditFcfa)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#1A73E8] shrink-0" />
          {locale === 'fr' ? 'Recouvrements dettes' : 'Debt collections'}
        </span>
        <span className="font-mono-num font-semibold text-[#1A73E8]">
          {formatFcfa(item.collectionsFcfa)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1.5">
        <span className="text-slate-600">
          {locale === 'fr' ? 'Évolution vs mois préc.' : 'MoM change'}
        </span>
        <span
          className={`font-mono-num font-bold ${
            item.momDeltaPct === null
              ? 'text-slate-400'
              : item.momDeltaPct >= 0
                ? 'text-[#2E7D32]'
                : 'text-[#D32F2F]'
          }`}
        >
          {deltaLabel}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 text-slate-500">
        <span>{locale === 'fr' ? 'Transactions POS' : 'POS transactions'}</span>
        <span className="font-mono-num font-semibold text-[#1E293B]">{item.txCount}</span>
      </div>
    </div>
  );
};

export const MonthlyRevenueComparisonChart: React.FC<MonthlyRevenueComparisonChartProps> = ({
  sales,
  debtPayments,
  locale,
  onNavigateReports,
}) => {
  const { months, total6Months, avgMonthly, peakMonth, currentVsPreviousPct } = useMemo(() => {
    const now = new Date();
    const currentIso = toMonthIso(now);
    const intlLocale = locale === 'fr' ? 'fr-FR' : 'en-US';

    const salesByMonth = new Map<
      string,
      { revenueFcfa: number; cashAndMomoFcfa: number; creditFcfa: number; txCount: number }
    >();
    for (const s of sales) {
      if (s.status !== 'completed') continue;
      const key = (s.createdAt || '').slice(0, 7);
      if (!key) continue;
      const existing = salesByMonth.get(key) || {
        revenueFcfa: 0,
        cashAndMomoFcfa: 0,
        creditFcfa: 0,
        txCount: 0,
      };
      existing.revenueFcfa += s.totalFcfa || 0;
      existing.cashAndMomoFcfa += (s.cashFcfa || 0) + (s.mobileMoneyFcfa || 0);
      existing.creditFcfa += s.creditFcfa || 0;
      existing.txCount += 1;
      salesByMonth.set(key, existing);
    }

    const collectionsByMonth = new Map<string, number>();
    for (const p of debtPayments) {
      const key = (p.createdAt || '').slice(0, 7);
      if (!key) continue;
      collectionsByMonth.set(key, (collectionsByMonth.get(key) || 0) + (p.amountFcfa || 0));
    }

    const rawBuckets: MonthBucket[] = Array.from({ length: 6 }, (_, idx) => {
      const refDate = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      const monthIso = toMonthIso(refDate);
      const shortLabel = capitalizeFirst(
        refDate.toLocaleDateString(intlLocale, { month: 'short', year: '2-digit' })
      );
      const fullLabel = capitalizeFirst(
        refDate.toLocaleDateString(intlLocale, { month: 'long', year: 'numeric' })
      );
      const sBucket = salesByMonth.get(monthIso);
      return {
        monthIso,
        shortLabel,
        fullLabel,
        revenueFcfa: sBucket?.revenueFcfa || 0,
        cashAndMomoFcfa: sBucket?.cashAndMomoFcfa || 0,
        creditFcfa: sBucket?.creditFcfa || 0,
        collectionsFcfa: collectionsByMonth.get(monthIso) || 0,
        trendFcfa: 0,
        txCount: sBucket?.txCount || 0,
        momDeltaPct: null,
        isCurrentMonth: monthIso === currentIso,
        isPeakMonth: false,
      };
    });

    // Compute linear regression trendline across the 6 months for long-term growth trajectory
    const n = rawBuckets.length;
    const meanX = (n - 1) / 2;
    const meanY = rawBuckets.reduce((sum, b) => sum + b.revenueFcfa, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      const dx = i - meanX;
      num += dx * (rawBuckets[i].revenueFcfa - meanY);
      den += dx * dx;
    }
    const slope = den > 0 ? num / den : 0;
    const intercept = meanY - slope * meanX;

    let maxRev = 0;
    let peak: MonthBucket | null = null;
    for (let i = 0; i < rawBuckets.length; i++) {
      const cur = rawBuckets[i];
      cur.trendFcfa = Math.max(0, Math.round(intercept + slope * i));
      if (i > 0) {
        const prevRev = rawBuckets[i - 1].revenueFcfa;
        if (prevRev > 0) {
          cur.momDeltaPct = ((cur.revenueFcfa - prevRev) / prevRev) * 100;
        } else if (cur.revenueFcfa > 0) {
          cur.momDeltaPct = 100;
        }
      }
      if (cur.revenueFcfa > maxRev) {
        maxRev = cur.revenueFcfa;
        peak = cur;
      }
    }

    if (peak && maxRev > 0) {
      peak.isPeakMonth = true;
    }

    const total = rawBuckets.reduce((sum, b) => sum + b.revenueFcfa, 0);
    const avg = Math.round(total / 6);
    const lastBucket = rawBuckets[rawBuckets.length - 1];

    return {
      months: rawBuckets,
      total6Months: total,
      avgMonthly: avg,
      peakMonth: maxRev > 0 ? peak : null,
      currentVsPreviousPct: lastBucket?.momDeltaPct ?? null,
    };
  }, [sales, debtPayments, locale]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-[#2E7D32] shrink-0" />
            <h2 className="font-display text-base font-bold text-[#1E293B]">
              {locale === 'fr'
                ? "Comparaison Mensuelle du Chiffre d'Affaires (6 derniers mois)"
                : 'Monthly Revenue Comparison (Last 6 Months)'}
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {locale === 'fr' ? 'Cumul 6 mois : ' : '6-month total: '}
            <span className="font-mono-num font-semibold text-[#2E7D32]">{formatFcfa(total6Months)}</span>
            {' · '}
            {locale === 'fr' ? 'Moyenne/mois : ' : 'Monthly avg: '}
            <span className="font-mono-num font-semibold text-[#1E293B]">{formatFcfa(avgMonthly)}</span>
            {peakMonth && (
              <>
                {' · '}
                {locale === 'fr' ? 'Meilleur mois : ' : 'Peak month: '}
                <span className="font-semibold text-[#1E293B]">{peakMonth.fullLabel}</span>{' '}
                <span className="font-mono-num font-semibold text-[#1A73E8]">
                  ({formatFcfa(peakMonth.revenueFcfa)})
                </span>
              </>
            )}
            {currentVsPreviousPct !== null && (
              <>
                {' · '}
                <span
                  className={`inline-flex items-center gap-0.5 font-mono-num font-semibold ${
                    currentVsPreviousPct >= 0 ? 'text-[#2E7D32]' : 'text-[#D32F2F]'
                  }`}
                >
                  {currentVsPreviousPct >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {currentVsPreviousPct >= 0 ? '+' : ''}
                  {currentVsPreviousPct.toFixed(1)} % vs M-1
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 shrink-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#2E7D32]" />
            {locale === 'fr' ? "Chiffre d'affaires" : 'Revenue'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#FFB300]" />
            {locale === 'fr' ? 'Mois record' : 'Peak month'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#1A73E8]" />
            {locale === 'fr' ? 'Recouvrements' : 'Collections'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-[#1E293B]" />
            {locale === 'fr' ? 'Tendance' : 'Growth trend'}
          </span>
          {onNavigateReports && (
            <button
              type="button"
              onClick={onNavigateReports}
              className="inline-flex items-center gap-1 font-semibold text-[#1A73E8] hover:underline whitespace-nowrap"
            >
              <span>{locale === 'fr' ? 'Rapports PDF' : 'PDF Reports'}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={months} margin={{ top: 10, right: 12, left: 4, bottom: 4 }} barGap={6}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="shortLabel"
              tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
              axisLine={{ stroke: '#CBD5E1' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748B' }}
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(v: number) =>
                v >= 1_000_000
                  ? `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
                  : v >= 1_000
                    ? `${Math.round(v / 1_000)}k`
                    : String(v)
              }
            />
            <Tooltip
              cursor={{ fill: 'rgba(226, 232, 240, 0.35)' }}
              content={<CustomMonthTooltip locale={locale} />}
            />
            {avgMonthly > 0 && (
              <ReferenceLine
                y={avgMonthly}
                stroke="#64748B"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: locale === 'fr' ? 'Moy. 6 mois' : '6m Avg',
                  position: 'insideTopRight',
                  fill: '#475569',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
            )}
            <Bar
              dataKey="revenueFcfa"
              name={locale === 'fr' ? "Chiffre d'affaires" : 'Revenue'}
              radius={[6, 6, 0, 0]}
              maxBarSize={42}
            >
              {months.map((entry) => (
                <Cell
                  key={entry.monthIso}
                  fill={entry.isPeakMonth ? '#FFB300' : '#2E7D32'}
                />
              ))}
            </Bar>
            <Bar
              dataKey="collectionsFcfa"
              name={locale === 'fr' ? 'Recouvrements' : 'Collections'}
              fill="#1A73E8"
              radius={[6, 6, 0, 0]}
              maxBarSize={24}
            />
            <Line
              type="monotone"
              dataKey="trendFcfa"
              name={locale === 'fr' ? 'Tendance croissance' : 'Growth trend'}
              stroke="#1E293B"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 3, fill: '#1E293B', strokeWidth: 0 }}
              activeDot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Compact 6-month numeric comparison strip */}
      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {months.map((m) => (
          <div
            key={m.monthIso}
            className={`rounded-xl border px-3 py-2 text-xs ${
              m.isCurrentMonth
                ? 'border-[#2E7D32]/40 bg-[#2E7D32]/5'
                : 'border-slate-200 bg-slate-50/60'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="font-semibold text-[#1E293B]">{m.shortLabel}</span>
              {m.momDeltaPct !== null && (
                <span
                  className={`font-mono-num text-[11px] font-bold ${
                    m.momDeltaPct >= 0 ? 'text-[#2E7D32]' : 'text-[#D32F2F]'
                  }`}
                >
                  {m.momDeltaPct >= 0 ? '+' : ''}
                  {m.momDeltaPct.toFixed(0)}%
                </span>
              )}
            </div>
            <p className="mt-0.5 font-mono-num font-bold text-[#1E293B] truncate">
              {formatFcfa(m.revenueFcfa)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
