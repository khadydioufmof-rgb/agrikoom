import React, { useMemo } from 'react';
import { BarChart3, Calendar, CheckCircle2, FileDown } from 'lucide-react';
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
import { formatMonthLabel } from '../lib/monthlyPdfReport';
import type { AttendanceRecord, DebtPayment, Locale, Product, Sale } from '../types/agrikoom';

interface MonthlyPerformanceCardProps {
  selectedMonth: string;
  onChangeMonth: (monthIso: string) => void;
  sales: Sale[];
  debtPayments: DebtPayment[];
  products: Product[];
  attendance: AttendanceRecord[];
  locale: Locale;
  pdfGenerating: boolean;
  pdfSuccessMsg: string | null;
  onDownloadPdf: () => void;
}

interface DailyPerfPoint {
  day: string;
  salesFcfa: number;
  collectionsFcfa: number;
  totalFcfa: number;
  checkins: number;
}

interface ChannelPoint {
  name: string;
  amount: number;
  color: string;
}

function getDaysInMonth(monthIso: string): number {
  const [yStr, mStr] = monthIso.split('-');
  const year = Number(yStr) || new Date().getFullYear();
  const month = Number(mStr) || new Date().getMonth() + 1;
  return new Date(year, month, 0).getDate();
}

export const MonthlyPerformanceCard: React.FC<MonthlyPerformanceCardProps> = ({
  selectedMonth,
  onChangeMonth,
  sales,
  debtPayments,
  products,
  attendance,
  locale,
  pdfGenerating,
  pdfSuccessMsg,
  onDownloadPdf,
}) => {
  const { dailyData, channelData, summary } = useMemo(() => {
    const days = getDaysInMonth(selectedMonth);
    const buckets: DailyPerfPoint[] = Array.from({ length: days }, (_, i) => ({
      day: String(i + 1).padStart(2, '0'),
      salesFcfa: 0,
      collectionsFcfa: 0,
      totalFcfa: 0,
      checkins: 0,
    }));

    let revenueFcfa = 0;
    let cashFcfa = 0;
    let momoFcfa = 0;
    let creditFcfa = 0;
    let salesCount = 0;

    for (const s of sales) {
      if (s.status !== 'completed') continue;
      const created = s.createdAt || '';
      if (created.slice(0, 7) !== selectedMonth) continue;
      salesCount += 1;
      revenueFcfa += s.totalFcfa || 0;
      cashFcfa += s.cashFcfa || 0;
      momoFcfa += s.mobileMoneyFcfa || 0;
      creditFcfa += s.creditFcfa || 0;

      const dayIdx = Number(created.slice(8, 10)) - 1;
      if (dayIdx >= 0 && dayIdx < days) {
        buckets[dayIdx].salesFcfa += s.totalFcfa || 0;
        buckets[dayIdx].totalFcfa += s.totalFcfa || 0;
      }
    }

    let collectionsFcfa = 0;
    for (const p of debtPayments) {
      const created = p.createdAt || '';
      if (created.slice(0, 7) !== selectedMonth) continue;
      collectionsFcfa += p.amountFcfa || 0;
      const dayIdx = Number(created.slice(8, 10)) - 1;
      if (dayIdx >= 0 && dayIdx < days) {
        buckets[dayIdx].collectionsFcfa += p.amountFcfa || 0;
        buckets[dayIdx].totalFcfa += p.amountFcfa || 0;
      }
    }

    let payrollFcfa = 0;
    let checkinsCount = 0;
    for (const a of attendance) {
      const wd = a.workDate || '';
      if (wd.slice(0, 7) !== selectedMonth) continue;
      payrollFcfa += a.earnedFcfa || 0;
      if (a.status !== 'absent') {
        checkinsCount += 1;
        const dayIdx = Number(wd.slice(8, 10)) - 1;
        if (dayIdx >= 0 && dayIdx < days) {
          buckets[dayIdx].checkins += 1;
        }
      }
    }

    const criticalCount = products.filter((p) => p.quantity <= p.minThreshold).length;

    const channels: ChannelPoint[] = [
      { name: 'Espèces', amount: cashFcfa, color: '#2E7D32' },
      { name: 'Mobile Money', amount: momoFcfa, color: '#1A73E8' },
      { name: 'Crédit', amount: creditFcfa, color: '#FFB300' },
      { name: 'Recouvr.', amount: collectionsFcfa, color: '#0D9488' },
    ];

    return {
      dailyData: buckets,
      channelData: channels,
      summary: {
        monthLabel: formatMonthLabel(selectedMonth, locale),
        revenueFcfa,
        treasuryFcfa: cashFcfa + momoFcfa + collectionsFcfa,
        collectionsFcfa,
        payrollFcfa,
        salesCount,
        checkinsCount,
        criticalCount,
      },
    };
  }, [selectedMonth, sales, debtPayments, products, attendance, locale]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#2E7D32]" />
            <h2 className="font-display text-base font-bold text-[#1E293B]">
              Visualisations de Performances Mensuelles · {summary.monthLabel}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Courbe des ventes &amp; recouvrements, répartition par canal et synthèse PDF prête pour la direction
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label
            htmlFor="perf-month-select"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-[#1E293B] min-h-[44px]"
          >
            <Calendar className="h-4 w-4 text-[#2E7D32]" />
            <input
              id="perf-month-select"
              type="month"
              value={selectedMonth}
              onChange={(e) => e.target.value && onChangeMonth(e.target.value)}
              className="bg-transparent font-mono-num text-xs font-bold text-[#1E293B] focus:outline-none"
            />
          </label>

          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={pdfGenerating}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2E7D32] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#256428] disabled:opacity-60 min-h-[44px] whitespace-nowrap"
          >
            <FileDown className="h-4 w-4 shrink-0" />
            <span>
              {pdfGenerating ? 'Génération du PDF…' : 'Télécharger Rapport PDF Mensuel'}
            </span>
          </button>
        </div>
      </div>

      {pdfSuccessMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-[#2E7D32] flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{pdfSuccessMsg}</span>
        </div>
      )}

      {/* 4 compact KPI summaries for the selected month */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            CA Mensuel ({summary.salesCount} ventes)
          </p>
          <p className="mt-1 font-mono-num text-lg font-bold text-[#1E293B]">
            {formatFcfa(summary.revenueFcfa)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Trésorerie Encaissée
          </p>
          <p className="mt-1 font-mono-num text-lg font-bold text-[#2E7D32]">
            {formatFcfa(summary.treasuryFcfa)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Recouvrements Dettes
          </p>
          <p className="mt-1 font-mono-num text-lg font-bold text-[#1A73E8]">
            {formatFcfa(summary.collectionsFcfa)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Paie &amp; Pointages ({summary.checkinsCount})
          </p>
          <p className="mt-1 font-mono-num text-lg font-bold text-[#B45309]">
            {formatFcfa(summary.payrollFcfa)}
          </p>
        </div>
      </div>

      {/* Live Recharts Visualisations included in the PDF */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 rounded-xl border border-slate-200 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Ventes POS &amp; Recouvrements Journaliers ({summary.monthLabel})
            </h3>
            <div className="flex items-center gap-3 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#2E7D32]" />
                Ventes POS
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#1A73E8]" />
                Recouvrements
              </span>
            </div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(1)}M`
                      : v >= 1_000
                        ? `${Math.round(v / 1_000)}k`
                        : String(v)
                  }
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    formatFcfa(Number(value) || 0),
                    name === 'salesFcfa' ? 'Ventes POS' : 'Recouvrements',
                  ]}
                  labelFormatter={(label) => `Jour ${label} · ${summary.monthLabel}`}
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: '#E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="salesFcfa" stackId="rev" fill="#2E7D32" radius={[0, 0, 0, 0]} />
                <Bar dataKey="collectionsFcfa" stackId="rev" fill="#1A73E8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 rounded-xl border border-slate-200 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Canaux de Paiement (FCFA)
            </h3>
            <span className="text-[11px] font-mono-num text-slate-500">
              {summary.criticalCount} alerte{summary.criticalCount > 1 ? 's' : ''} stock
            </span>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={channelData}
                layout="vertical"
                margin={{ top: 6, right: 16, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(1)}M`
                      : v >= 1_000
                        ? `${Math.round(v / 1_000)}k`
                        : String(v)
                  }
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  width={84}
                />
                <Tooltip
                  formatter={(value: unknown) => [formatFcfa(Number(value) || 0), 'Montant']}
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: '#E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={22}>
                  {channelData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
};
