import React, { useMemo } from 'react';
import { ArrowUpRight, Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatFcfa } from '../i18n/translations';
import type { AttendanceRecord, Locale } from '../types/agrikoom';

interface AttendanceBarChartProps {
  attendance: AttendanceRecord[];
  locale: Locale;
  onNavigateWorkers: () => void;
}

interface AttendanceDayPoint {
  iso: string;
  prevIso: string;
  label: string;
  fullDate: string;
  prevFullDate: string;
  currentCount: number;
  previousCount: number;
  currentPayroll: number;
  previousPayroll: number;
  presentFull: number;
  halfDay: number;
  taskBased: number;
  absentCount: number;
  delta: number;
  isPeak: boolean;
}

interface TooltipPayloadItem {
  payload?: AttendanceDayPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  locale: Locale;
}

const CustomAttendanceTooltip: React.FC<CustomTooltipProps> = ({ active, payload, locale }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const deltaSign = point.delta > 0 ? `+${point.delta}` : String(point.delta);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-md text-xs space-y-1.5 min-w-[230px]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
        <p className="font-display font-bold text-[#1E293B]">{point.fullDate}</p>
        {point.isPeak && (
          <span className="font-semibold text-[#2E7D32]">
            {locale === 'fr' ? "Pic d'activité" : 'Activity peak'}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span
            className="h-2 w-2 rounded-sm shrink-0"
            style={{ backgroundColor: point.isPeak ? '#2E7D32' : '#1A73E8' }}
          />
          {locale === 'fr' ? '7 derniers jours' : 'Last 7 days'}
        </span>
        <span className="font-mono-num font-bold text-[#1E293B]">
          {point.currentCount}{' '}
          {locale === 'fr'
            ? point.currentCount > 1
              ? 'ouvriers'
              : 'ouvrier'
            : point.currentCount > 1
            ? 'workers'
            : 'worker'}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 text-slate-500">
          <span className="h-2 w-2 rounded-sm bg-[#CBD5E1] shrink-0" />
          {locale === 'fr' ? `Sem. préc. (${point.prevFullDate})` : `Prev. week (${point.prevFullDate})`}
        </span>
        <span className="font-mono-num font-semibold text-slate-600">
          {point.previousCount}{' '}
          {locale === 'fr'
            ? point.previousCount > 1
              ? 'ouvriers'
              : 'ouvrier'
            : point.previousCount > 1
            ? 'workers'
            : 'worker'}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1.5">
        <span className="text-slate-600">{locale === 'fr' ? 'Écart vs sem. préc.' : 'Change vs prev.'}</span>
        <span
          className={`font-mono-num font-bold ${
            point.delta > 0
              ? 'text-[#2E7D32]'
              : point.delta < 0
              ? 'text-[#D32F2F]'
              : 'text-slate-600'
          }`}
        >
          {deltaSign}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-600">
          {locale === 'fr' ? 'Masse salariale jour' : 'Day payroll'}
        </span>
        <span className="font-mono-num font-semibold text-[#1E293B]">
          {formatFcfa(point.currentPayroll)}
        </span>
      </div>

      {(point.presentFull > 0 || point.halfDay > 0 || point.taskBased > 0 || point.absentCount > 0) && (
        <div className="border-t border-slate-100 pt-1.5 text-[11px] text-slate-500 font-mono-num">
          {locale === 'fr'
            ? `Plein : ${point.presentFull} · ½ j : ${point.halfDay} · Tâche : ${point.taskBased} · Abs : ${point.absentCount}`
            : `Full: ${point.presentFull} · Half: ${point.halfDay} · Task: ${point.taskBased} · Abs: ${point.absentCount}`}
        </div>
      )}
    </div>
  );
};

export const AttendanceBarChart: React.FC<AttendanceBarChartProps> = ({
  attendance,
  locale,
  onNavigateWorkers,
}) => {
  const {
    series,
    totalCurrent,
    totalPrevious,
    peakDay,
    hasAnyData,
  } = useMemo(() => {
    const byDate = new Map<string, AttendanceRecord[]>();
    for (const rec of attendance) {
      const dateKey = rec.workDate.slice(0, 10);
      const list = byDate.get(dateKey);
      if (list) {
        list.push(rec);
      } else {
        byDate.set(dateKey, [rec]);
      }
    }

    const summarizeDay = (iso: string) => {
      const records = byDate.get(iso) || [];
      const activeWorkers = new Set<string>();
      let presentFull = 0;
      let halfDay = 0;
      let taskBased = 0;
      let absentCount = 0;
      let payroll = 0;

      for (const r of records) {
        payroll += Number(r.earnedFcfa || 0);
        if (r.status === 'absent') {
          absentCount += 1;
        } else {
          activeWorkers.add(r.workerId || r.id);
          if (r.status === 'present') presentFull += 1;
          else if (r.status === 'demi_journee') halfDay += 1;
          else if (r.status === 'tache') taskBased += 1;
        }
      }

      return {
        activeCount: activeWorkers.size,
        payroll,
        presentFull,
        halfDay,
        taskBased,
        absentCount,
      };
    };

    const rawPoints = Array.from({ length: 7 }, (_, idx) => {
      const currDate = new Date(Date.now() - (6 - idx) * 86400000);
      const prevDate = new Date(Date.now() - (13 - idx) * 86400000);
      const iso = currDate.toISOString().slice(0, 10);
      const prevIso = prevDate.toISOString().slice(0, 10);
      const weekday = currDate.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
        weekday: 'short',
      });
      const dayNum = currDate.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
      });
      const fullDate = currDate.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
      const prevFullDate = prevDate.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
      });

      const curr = summarizeDay(iso);
      const prev = summarizeDay(prevIso);

      return {
        iso,
        prevIso,
        label: `${weekday} ${dayNum}`,
        fullDate,
        prevFullDate,
        currentCount: curr.activeCount,
        previousCount: prev.activeCount,
        currentPayroll: curr.payroll,
        previousPayroll: prev.payroll,
        presentFull: curr.presentFull,
        halfDay: curr.halfDay,
        taskBased: curr.taskBased,
        absentCount: curr.absentCount,
        delta: curr.activeCount - prev.activeCount,
        isPeak: false,
      };
    });

    const maxCurr = rawPoints.reduce(
      (max, pt) => (pt.currentCount > max ? pt.currentCount : max),
      0
    );

    const points: AttendanceDayPoint[] = rawPoints.map((pt) => ({
      ...pt,
      isPeak: maxCurr > 0 && pt.currentCount === maxCurr,
    }));

    const currSum = points.reduce((s, p) => s + p.currentCount, 0);
    const prevSum = points.reduce((s, p) => s + p.previousCount, 0);
    const best = points.find((p) => p.isPeak) || null;

    return {
      series: points,
      totalCurrent: currSum,
      totalPrevious: prevSum,
      peakDay: best,
      hasAnyData: currSum > 0 || prevSum > 0,
    };
  }, [attendance, locale]);

  const diffTotal = totalCurrent - totalPrevious;
  const diffLabel =
    totalPrevious > 0
      ? `${diffTotal >= 0 ? '+' : ''}${Math.round((diffTotal / totalPrevious) * 100)} %`
      : diffTotal > 0
      ? `+${diffTotal}`
      : '0';

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4"
      aria-label={
        locale === 'fr'
          ? 'Graphique de fréquentation des ouvriers sur 7 jours comparé aux 7 jours précédents'
          : 'Worker attendance bar chart over last 7 days vs previous 7 days'
      }
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#1A73E8] shrink-0" />
            <h2 className="font-display text-base font-bold text-[#1E293B]">
              {locale === 'fr'
                ? 'Fréquentation des ouvriers (7 derniers jours vs 7 jours précédents)'
                : 'Worker Attendance (Last 7 Days vs Previous 7 Days)'}
            </h2>
          </div>

          <p className="mt-0.5 text-xs text-slate-500">
            {locale === 'fr' ? '7 derniers jours : ' : 'Last 7 days: '}
            <span className="font-mono-num font-semibold text-[#1E293B]">
              {totalCurrent} {locale === 'fr' ? 'présences' : 'check-ins'}
            </span>
            <span aria-hidden="true"> · </span>
            {locale === 'fr' ? '7 jours précédents : ' : 'Previous 7 days: '}
            <span className="font-mono-num font-semibold text-slate-700">{totalPrevious}</span>
            <span aria-hidden="true"> · </span>
            <span
              className={`font-mono-num font-semibold ${
                diffTotal > 0
                  ? 'text-[#2E7D32]'
                  : diffTotal < 0
                  ? 'text-[#D32F2F]'
                  : 'text-slate-600'
              }`}
            >
              {diffLabel}
            </span>
            {peakDay && (
              <>
                <span aria-hidden="true"> · </span>
                {locale === 'fr' ? "Pic d'activité : " : 'Peak: '}
                <span className="font-semibold text-[#2E7D32]">
                  {peakDay.fullDate} ({peakDay.currentCount}{' '}
                  {locale === 'fr'
                    ? peakDay.currentCount > 1
                      ? 'ouvriers'
                      : 'ouvrier'
                    : peakDay.currentCount > 1
                    ? 'workers'
                    : 'worker'}
                  )
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-3.5 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#1A73E8]" />
              {locale === 'fr' ? '7 derniers jours' : 'Last 7 days'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#2E7D32]" />
              {locale === 'fr' ? "Pic d'activité" : 'Peak day'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#CBD5E1]" />
              {locale === 'fr' ? '7 jours précédents' : 'Previous 7 days'}
            </span>
          </div>

          <button
            type="button"
            onClick={onNavigateWorkers}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A73E8] hover:underline whitespace-nowrap shrink-0"
          >
            <span>{locale === 'fr' ? 'Pointage ouvriers' : 'Worker attendance'}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!hasAnyData && (
        <p className="text-xs text-slate-500">
          {locale === 'fr'
            ? 'Aucun pointage enregistré sur les 14 derniers jours.'
            : 'No attendance records logged over the last 14 days.'}
        </p>
      )}

      <div className="w-full h-60 min-w-0">
        <ResponsiveContainer width="100%" height={240} minWidth={0}>
          <BarChart
            data={series}
            margin={{ top: 10, right: 14, left: 0, bottom: 4 }}
            barGap={4}
            barCategoryGap="22%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 11, fontWeight: 500 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={36}
              tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            />
            <Tooltip
              cursor={{ fill: '#F8FAFC' }}
              content={<CustomAttendanceTooltip locale={locale} />}
            />
            <Bar
              dataKey="previousCount"
              name={locale === 'fr' ? '7 jours précédents' : 'Previous 7 days'}
              fill="#CBD5E1"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
            <Bar
              dataKey="currentCount"
              name={locale === 'fr' ? '7 derniers jours' : 'Last 7 days'}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            >
              {series.map((entry) => (
                <Cell
                  key={entry.iso}
                  fill={entry.isPeak ? '#2E7D32' : '#1A73E8'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
