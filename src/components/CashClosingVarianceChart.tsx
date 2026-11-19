import React, { useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Scale } from 'lucide-react';
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
import type { CashClosing, Locale } from '../types/agrikoom';

interface CashClosingVarianceChartProps {
  cashClosings: CashClosing[];
  locale: Locale;
  onNavigatePos?: () => void;
  onNavigateReports?: () => void;
}

type ViewMode = 'variance' | 'comparison';

interface ClosingDayPoint {
  closingDate: string;
  shortDate: string;
  fullDate: string;
  theoreticalCashFcfa: number;
  countedCashFcfa: number;
  varianceFcfa: number;
  closingCount: number;
  operators: string;
  note?: string;
}

interface TooltipPayloadItem {
  payload?: ClosingDayPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  locale: Locale;
}

function formatShortDate(isoDate: string, locale: Locale): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatFullDate(isoDate: string, locale: Locale): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatCompactAxisFcfa(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)}k`;
  }
  return String(val);
}

const CustomClosingTooltip: React.FC<CustomTooltipProps> = ({ active, payload, locale }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  const isExact = item.varianceFcfa === 0;
  const isShortage = item.varianceFcfa < 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-md text-xs space-y-1.5 min-w-[245px]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
        <span className="font-display font-bold text-[#1E293B]">{item.fullDate}</span>
        <span
          className={`font-semibold ${
            isExact ? 'text-[#2E7D32]' : isShortage ? 'text-[#D32F2F]' : 'text-[#B45309]'
          }`}
        >
          {isExact
            ? locale === 'fr'
              ? 'Conforme'
              : 'Balanced'
            : isShortage
              ? locale === 'fr'
                ? 'Manquant'
                : 'Shortage'
              : locale === 'fr'
                ? 'Excédent'
                : 'Surplus'}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#64748B] shrink-0" />
          {locale === 'fr' ? 'Cash théorique' : 'Theoretical cash'}
        </span>
        <span className="font-mono-num font-semibold text-[#1E293B]">
          {formatFcfa(item.theoreticalCashFcfa)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#1A73E8] shrink-0" />
          {locale === 'fr' ? 'Cash compté' : 'Counted cash'}
        </span>
        <span className="font-mono-num font-semibold text-[#1A73E8]">
          {formatFcfa(item.countedCashFcfa)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1.5">
        <span className="font-semibold text-[#1E293B]">
          {locale === 'fr' ? 'Écart constaté' : 'Cash variance'}
        </span>
        <span
          className={`font-mono-num font-bold ${
            isExact ? 'text-[#2E7D32]' : isShortage ? 'text-[#D32F2F]' : 'text-[#B45309]'
          }`}
        >
          {item.varianceFcfa > 0 ? `+${formatFcfa(item.varianceFcfa)}` : formatFcfa(item.varianceFcfa)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 text-slate-500 pt-0.5">
        <span>{locale === 'fr' ? 'Clôturé par' : 'Closed by'}</span>
        <span className="font-medium text-[#1E293B] truncate max-w-[140px]">{item.operators}</span>
      </div>

      {item.note && (
        <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-1 italic">
          {item.note}
        </p>
      )}
    </div>
  );
};

export const CashClosingVarianceChart: React.FC<CashClosingVarianceChartProps> = ({
  cashClosings,
  locale,
  onNavigatePos,
  onNavigateReports,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('variance');

  const { dailySeries, totalClosings, conformCount, netVariance, worstShortage } = useMemo(() => {
    const byDate = new Map<
      string,
      {
        theoretical: number;
        counted: number;
        variance: number;
        count: number;
        actors: Set<string>;
        note?: string;
      }
    >();

    for (const c of cashClosings) {
      const dateKey = (c.closingDate || c.createdAt || '').slice(0, 10);
      if (!dateKey) continue;
      const bucket = byDate.get(dateKey) || {
        theoretical: 0,
        counted: 0,
        variance: 0,
        count: 0,
        actors: new Set<string>(),
        note: undefined,
      };
      bucket.theoretical += c.theoreticalCashFcfa || 0;
      bucket.counted += c.countedCashFcfa || 0;
      bucket.variance += c.varianceFcfa ?? (c.countedCashFcfa || 0) - (c.theoreticalCashFcfa || 0);
      bucket.count += 1;
      if (c.closedByName) bucket.actors.add(c.closedByName);
      if (c.note) bucket.note = c.note;
      byDate.set(dateKey, bucket);
    }

    const sortedDates = Array.from(byDate.keys()).sort().slice(-14);

    const series: ClosingDayPoint[] = sortedDates.map((dateKey) => {
      const b = byDate.get(dateKey)!;
      return {
        closingDate: dateKey,
        shortDate: formatShortDate(dateKey, locale),
        fullDate: formatFullDate(dateKey, locale),
        theoreticalCashFcfa: b.theoretical,
        countedCashFcfa: b.counted,
        varianceFcfa: b.variance,
        closingCount: b.count,
        operators: Array.from(b.actors).join(', ') || 'Opérateur',
        note: b.note,
      };
    });

    const net = cashClosings.reduce((sum, c) => sum + (c.varianceFcfa || 0), 0);
    const exact = cashClosings.filter((c) => (c.varianceFcfa || 0) === 0).length;
    const minVar = cashClosings.reduce(
      (min, c) => ((c.varianceFcfa || 0) < min ? c.varianceFcfa || 0 : min),
      0
    );

    return {
      dailySeries: series,
      totalClosings: cashClosings.length,
      conformCount: exact,
      netVariance: net,
      worstShortage: minVar,
    };
  }, [cashClosings, locale]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-[#1A73E8] shrink-0" />
            <h2 className="font-display text-base font-bold text-[#1E293B]">
              {locale === 'fr'
                ? 'Écart Quotidien des Clôtures de Caisse (Théorique vs Compté)'
                : 'Daily Cash Closing Variance (Theoretical vs Counted)'}
            </h2>
          </div>

          <p className="mt-1 text-xs text-slate-500">
            {totalClosings === 0 ? (
              locale === 'fr' ? (
                'Aucune clôture de caisse enregistrée pour le moment'
              ) : (
                'No cash register closings recorded yet'
              )
            ) : (
              <>
                <span className="font-mono-num font-semibold text-[#1E293B]">
                  {totalClosings}
                </span>{' '}
                {locale === 'fr'
                  ? totalClosings > 1
                    ? 'clôtures'
                    : 'clôture'
                  : totalClosings > 1
                    ? 'closings'
                    : 'closing'}
                {' · '}
                {locale === 'fr' ? 'Conformes : ' : 'Balanced: '}
                <span className="font-mono-num font-semibold text-[#2E7D32]">
                  {conformCount}/{totalClosings}
                </span>
                {' · '}
                {locale === 'fr' ? 'Écart cumulé : ' : 'Net variance: '}
                <span
                  className={`font-mono-num font-semibold ${
                    netVariance === 0
                      ? 'text-[#2E7D32]'
                      : netVariance < 0
                        ? 'text-[#D32F2F]'
                        : 'text-[#B45309]'
                  }`}
                >
                  {netVariance > 0 ? `+${formatFcfa(netVariance)}` : formatFcfa(netVariance)}
                </span>
                {worstShortage < 0 && (
                  <>
                    {' · '}
                    {locale === 'fr' ? 'Plus fort déficit : ' : 'Max shortage: '}
                    <span className="font-mono-num font-semibold text-[#D32F2F]">
                      {formatFcfa(worstShortage)}
                    </span>
                  </>
                )}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {dailySeries.length > 0 && (
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setViewMode('variance')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === 'variance'
                    ? 'bg-white text-[#1E293B] shadow-sm'
                    : 'text-slate-600 hover:text-[#1E293B]'
                }`}
              >
                {locale === 'fr' ? 'Écart (+/- FCFA)' : 'Variance (+/-)'}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('comparison')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === 'comparison'
                    ? 'bg-white text-[#1E293B] shadow-sm'
                    : 'text-slate-600 hover:text-[#1E293B]'
                }`}
              >
                {locale === 'fr' ? 'Théorique vs Compté' : 'Expected vs Counted'}
              </button>
            </div>
          )}

          {onNavigateReports && (
            <button
              type="button"
              onClick={onNavigateReports}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A73E8] hover:underline whitespace-nowrap"
            >
              <span>{locale === 'fr' ? 'Journal clôtures' : 'Closing log'}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {dailySeries.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center space-y-2.5">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-emerald-50 text-[#2E7D32]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-[#1E293B]">
            {locale === 'fr'
              ? 'Aucune clôture de caisse enregistrée'
              : 'No cash closing entries yet'}
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {locale === 'fr'
              ? 'Effectuez une clôture de caisse en fin de journée depuis la Caisse POS pour suivre ici les écarts quotidiens entre le cash théorique et le cash compté.'
              : 'Record an end-of-day cash closing from the POS register to track daily discrepancies between expected and counted cash.'}
          </p>
          {onNavigatePos && (
            <button
              type="button"
              onClick={onNavigatePos}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2E7D32] bg-white px-3.5 py-2 text-xs font-semibold text-[#2E7D32] hover:bg-[#2E7D32]/5 min-h-[38px]"
            >
              <span>{locale === 'fr' ? 'Ouvrir la Caisse POS' : 'Open POS Register'}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            {viewMode === 'variance' ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#D32F2F]" />
                  {locale === 'fr' ? 'Manquant (< 0)' : 'Shortage (< 0)'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#FFB300]" />
                  {locale === 'fr' ? 'Excédent (> 0)' : 'Surplus (> 0)'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#2E7D32]" />
                  {locale === 'fr' ? 'Conforme (0 FCFA)' : 'Exact match (0 FCFA)'}
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#64748B]" />
                  {locale === 'fr' ? 'Cash théorique' : 'Theoretical cash'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#1A73E8]" />
                  {locale === 'fr' ? 'Cash compté' : 'Counted cash'}
                </span>
              </>
            )}
          </div>

          <div className="mt-3 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={dailySeries}
                margin={{ top: 10, right: 12, left: 4, bottom: 4 }}
                barGap={6}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="shortDate"
                  tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={formatCompactAxisFcfa}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(226, 232, 240, 0.35)' }}
                  content={<CustomClosingTooltip locale={locale} />}
                />
                <ReferenceLine y={0} stroke="#64748B" strokeWidth={1.5} />

                {viewMode === 'variance' ? (
                  <Bar
                    dataKey="varianceFcfa"
                    name={locale === 'fr' ? 'Écart (FCFA)' : 'Variance (FCFA)'}
                    radius={[5, 5, 5, 5]}
                    maxBarSize={38}
                  >
                    {dailySeries.map((entry) => (
                      <Cell
                        key={entry.closingDate}
                        fill={
                          entry.varianceFcfa < 0
                            ? '#D32F2F'
                            : entry.varianceFcfa > 0
                              ? '#FFB300'
                              : '#2E7D32'
                        }
                      />
                    ))}
                  </Bar>
                ) : (
                  <>
                    <Bar
                      dataKey="theoreticalCashFcfa"
                      name={locale === 'fr' ? 'Cash théorique' : 'Theoretical cash'}
                      fill="#64748B"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="countedCashFcfa"
                      name={locale === 'fr' ? 'Cash compté' : 'Counted cash'}
                      fill="#1A73E8"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={28}
                    />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};
