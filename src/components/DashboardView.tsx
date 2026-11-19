import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  ClipboardCheck,
  MessageSquare,
  PackagePlus,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';
import { formatFcfa, translations } from '../i18n/translations';
import { AttendanceBarChart } from './AttendanceBarChart';
import { CashClosingVarianceChart } from './CashClosingVarianceChart';
import { CriticalStockTable } from './CriticalStockTable';
import { DailyRevenue30ComparisonChart } from './DailyRevenue30ComparisonChart';
import { MonthlyRevenueComparisonChart } from './MonthlyRevenueComparisonChart';
import { Revenue30DaysChart } from './Revenue30DaysChart';
import { RevenueLineChart } from './RevenueLineChart';
import { SalesBarChart } from './SalesBarChart';
import type {
  ActiveTab,
  AttendanceRecord,
  CashClosing,
  Debtor,
  DebtorStatus,
  DebtPayment,
  Locale,
  Organization,
  Product,
  Sale,
  UserRole,
} from '../types/agrikoom';

interface DashboardViewProps {
  org: Organization;
  role: UserRole;
  locale: Locale;
  products: Product[];
  sales: Sale[];
  debtors: Debtor[];
  debtPayments: DebtPayment[];
  attendance: AttendanceRecord[];
  cashClosings?: CashClosing[];
  onNavigate: (tab: ActiveTab) => void;
  onNavigateDebts?: (status: 'all' | DebtorStatus) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  org,
  role,
  locale,
  products,
  sales,
  debtors,
  debtPayments,
  attendance,
  cashClosings = [],
  onNavigate,
  onNavigateDebts,
}) => {
  const t = translations[locale];
  const today = new Date().toISOString().slice(0, 10);

  const completedSales = sales.filter((s) => s.status === 'completed');
  const todaySales = completedSales.filter((s) => s.createdAt.slice(0, 10) === today);

  const todayRevenue = todaySales.reduce((sum, s) => sum + s.totalFcfa, 0);
  const todayCash = todaySales.reduce((sum, s) => sum + s.cashFcfa, 0);
  const todayMomo = todaySales.reduce((sum, s) => sum + s.mobileMoneyFcfa, 0);
  const todayCredit = todaySales.reduce((sum, s) => sum + s.creditFcfa, 0);

  const todayRecovered = debtPayments
    .filter((p) => p.createdAt.slice(0, 10) === today)
    .reduce((sum, p) => sum + p.amountFcfa, 0);
  const availableTreasuryToday = todayCash + todayMomo + todayRecovered;

  const totalDebtRemaining = debtors.reduce((sum, d) => sum + d.remainingFcfa, 0);
  const overdueDebtors = debtors.filter((d) => d.status === 'en_retard' && d.remainingFcfa > 0);
  const openOverdueDebts = () => {
    if (onNavigateDebts) {
      onNavigateDebts('en_retard');
    } else {
      onNavigate('debts');
    }
  };

  const todayAttendance = attendance.filter((a) => a.workDate === today);
  const todayPayroll = todayAttendance.reduce((sum, a) => sum + a.earnedFcfa, 0);

  const lowStockItems = products.filter((p) => p.quantity <= p.minThreshold);

  // Build 7-day Recharts daily revenue, collections & sales breakdown series
  const last7Days = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(Date.now() - (6 - idx) * 86400000);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short' });
    const daySales = completedSales.filter((s) => s.createdAt.slice(0, 10) === iso);
    const dayRev = daySales.reduce((sum, s) => sum + s.totalFcfa, 0);
    const dayCash = daySales.reduce((sum, s) => sum + s.cashFcfa, 0);
    const dayMomo = daySales.reduce((sum, s) => sum + s.mobileMoneyFcfa, 0);
    const dayCredit = daySales.reduce((sum, s) => sum + s.creditFcfa, 0);
    const dayRec = debtPayments
      .filter((p) => p.createdAt.slice(0, 10) === iso)
      .reduce((sum, p) => sum + p.amountFcfa, 0);
    return {
      iso,
      label,
      dayRev,
      dayRec,
      totalFcfa: dayRev,
      cashFcfa: dayCash,
      mobileMoneyFcfa: dayMomo,
      creditFcfa: dayCredit,
      txCount: daySales.length,
    };
  });

  const total7DayRevenue = last7Days.reduce((sum, d) => sum + d.dayRev, 0);
  const total7DaySalesCount = last7Days.reduce((sum, d) => sum + d.txCount, 0);

  const totalChannelBase = Math.max(1, todayCash + todayMomo + todayCredit);
  const cashPct = Math.round((todayCash / totalChannelBase) * 100);
  const momoPct = Math.round((todayMomo / totalChannelBase) * 100);
  const creditPct = Math.max(0, 100 - cashPct - momoPct);

  return (
    <div className="space-y-6">
      {/* Organization Header & 3-Click Quick Actions */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {org.region} · {org.orgType === 'cooperative' ? 'Coopérative Agricole' : org.orgType.toUpperCase()}
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold text-[#1E293B] tracking-tight">
            {org.name}
          </h1>
        </div>

        {/* Règle des 3 Clics: Compact single-line quick actions */}
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5">
          {role !== 'pointer' && (
            <button
              type="button"
              onClick={() => onNavigate('pos')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#256428] transition-colors min-h-[36px] whitespace-nowrap shrink-0"
            >
              <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
              <span>{t.newSale}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('stocks')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#1E293B] hover:bg-slate-50 transition-colors min-h-[36px] whitespace-nowrap shrink-0"
          >
            <PackagePlus className="h-3.5 w-3.5 text-[#2E7D32] shrink-0" />
            <span>{t.stockEntry}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('workers')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#1E293B] hover:bg-slate-50 transition-colors min-h-[36px] whitespace-nowrap shrink-0"
          >
            <ClipboardCheck className="h-3.5 w-3.5 text-[#1A73E8] shrink-0" />
            <span>{t.markAttendance}</span>
          </button>
          {role !== 'pointer' && (
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#FFB300]/50 bg-[#FFB300]/15 px-3 py-1.5 text-xs font-semibold text-[#1E293B] hover:bg-[#FFB300]/25 transition-colors min-h-[36px] whitespace-nowrap shrink-0"
            >
              <MessageSquare className="h-3.5 w-3.5 text-[#B45309] shrink-0" />
              <span>{t.sendWhatsapp}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Row (Single Horizontal Line) */}
      <div className="grid grid-flow-col auto-cols-[minmax(195px,1fr)] md:grid-flow-row md:grid-cols-4 gap-3 overflow-x-auto pb-1 md:pb-0">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-500 truncate">{t.todayRevenue}</span>
            <TrendingUp className="h-4 w-4 text-[#2E7D32] shrink-0" />
          </div>
          <p className="mt-1.5 font-mono-num text-lg sm:text-xl font-bold text-[#1E293B] truncate">
            {formatFcfa(todayRevenue)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 leading-snug">
            {todaySales.length} transactions · Trésorerie :{' '}
            <span className="font-mono-num font-semibold text-[#2E7D32]">{formatFcfa(availableTreasuryToday)}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-500 truncate">{t.outstandingDebts}</span>
            {overdueDebtors.length > 0 ? (
              <span
                role="status"
                aria-label={
                  locale === 'fr'
                    ? `${overdueDebtors.length} débiteur(s) en retard`
                    : `${overdueDebtors.length} overdue debtor(s)`
                }
                className="inline-flex items-center gap-1 rounded-full bg-[#D32F2F] px-2 py-0.5 text-[10px] font-bold text-white whitespace-nowrap shrink-0"
              >
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span className="font-mono-num">{overdueDebtors.length}</span>
                <span>{locale === 'fr' ? 'en retard' : 'overdue'}</span>
              </span>
            ) : (
              <Banknote className="h-4 w-4 text-[#FFB300] shrink-0" />
            )}
          </div>
          <p className="mt-1.5 font-mono-num text-lg sm:text-xl font-bold text-[#1E293B] truncate">
            {formatFcfa(totalDebtRemaining)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 leading-snug">
            {overdueDebtors.length > 0 ? (
              <span className="font-semibold text-[#D32F2F]">
                {overdueDebtors.length}{' '}
                {locale === 'fr'
                  ? `débiteur${overdueDebtors.length > 1 ? 's' : ''} en retard`
                  : `overdue debtor${overdueDebtors.length > 1 ? 's' : ''}`}
              </span>
            ) : locale === 'fr' ? (
              'Toutes les échéances à jour'
            ) : (
              'All accounts on schedule'
            )}{' '}
            · {locale === 'fr' ? 'Recouvré ajd :' : 'Recovered today:'}{' '}
            <span className="font-mono-num">{formatFcfa(todayRecovered)}</span>
          </p>
          {overdueDebtors.length > 0 && role !== 'pointer' && (
            <button
              type="button"
              onClick={openOverdueDebts}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#D32F2F] hover:text-[#B71C1C] hover:underline"
            >
              <span>
                {locale === 'fr' ? 'Voir les dettes en retard' : 'View overdue debts'}
              </span>
              <ArrowUpRight className="h-3 w-3 shrink-0" />
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-500 truncate">{t.lowStockAlerts}</span>
            <AlertTriangle className={`h-4 w-4 shrink-0 ${lowStockItems.length > 0 ? 'text-[#D32F2F]' : 'text-[#2E7D32]'}`} />
          </div>
          <p className="mt-1.5 font-mono-num text-lg sm:text-xl font-bold text-[#1E293B] truncate">
            {lowStockItems.length} <span className="text-xs font-normal text-slate-500">/ {products.length} articles</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500 truncate">
            {lowStockItems.length > 0
              ? `Critique : ${lowStockItems.map((p) => p.name).join(', ')}`
              : 'Niveaux de stock nominaux'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-500 truncate">{t.dailyPayroll}</span>
            <Users className="h-4 w-4 text-[#1A73E8] shrink-0" />
          </div>
          <p className="mt-1.5 font-mono-num text-lg sm:text-xl font-bold text-[#1E293B] truncate">
            {formatFcfa(todayPayroll)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 leading-snug">
            {todayAttendance.length} pointages enregistrés aujourd&apos;hui
          </p>
        </div>
      </div>

      {/* Main Analytics + Operational Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* 7-Day Revenue & Collections Recharts Line Chart */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-[#1E293B]">
                {locale === 'fr' ? 'Évolution du Chiffre d\'Affaires (7 derniers jours)' : 'Revenue Trend (Last 7 Days)'}
              </h2>
              <p className="text-xs text-slate-500">
                {locale === 'fr' ? 'Cumul 7 jours : ' : '7-day total: '}
                <span className="font-mono-num font-semibold text-[#2E7D32]">{formatFcfa(total7DayRevenue)}</span>
                {' · '}
                {locale === 'fr' ? 'Comparatif ventes POS & recouvrements' : 'POS sales vs debt collections'}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#2E7D32]" />
                {locale === 'fr' ? 'Chiffre d\'affaires' : 'Revenue'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#1A73E8]" />
                {locale === 'fr' ? 'Recouvrements' : 'Collections'}
              </span>
            </div>
          </div>

          <div className="mt-5">
            <RevenueLineChart data={last7Days} locale={locale} />
          </div>

          {/* Channel Ventilation Bar */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#1E293B]">Ventilation des encaissements du jour</span>
              <span className="text-slate-500 font-mono-num">
                Cash {cashPct}% · Mobile Money {momoPct}% · Crédit {creditPct}%
              </span>
            </div>
            <div className="mt-2.5 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div style={{ width: `${cashPct}%` }} className="bg-[#2E7D32] transition-all" />
              <div style={{ width: `${momoPct}%` }} className="bg-[#1A73E8] transition-all" />
              <div style={{ width: `${creditPct}%` }} className="bg-[#FFB300] transition-all" />
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Espèces : </span>
                <span className="font-mono-num font-semibold text-[#1E293B]">{formatFcfa(todayCash)}</span>
              </div>
              <div>
                <span className="text-slate-500">Wave / OM : </span>
                <span className="font-mono-num font-semibold text-[#1A73E8]">{formatFcfa(todayMomo)}</span>
              </div>
              <div>
                <span className="text-slate-500">À crédit : </span>
                <span className="font-mono-num font-semibold text-[#B45309]">{formatFcfa(todayCredit)}</span>
              </div>
            </div>
          </div>
          </div>

          {/* 7-Day Sales Evolution Recharts Bar Chart */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-bold text-[#1E293B]">
                  {locale === 'fr' ? 'Évolution des Ventes (7 derniers jours)' : 'Sales Evolution (Last 7 Days)'}
                </h2>
                <p className="text-xs text-slate-500">
                  <span className="font-mono-num font-semibold text-[#1E293B]">{total7DaySalesCount}</span>{' '}
                  {locale === 'fr' ? 'ventes validées · ' : 'completed sales · '}
                  <span className="font-mono-num font-semibold text-[#2E7D32]">{formatFcfa(total7DayRevenue)}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3.5 text-xs text-slate-600">
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
              </div>
            </div>

            <div className="mt-5">
              <SalesBarChart data={last7Days} locale={locale} />
            </div>
          </div>
        </div>

        {/* Right Column: Actionable Alerts + Warehouse Snapshot */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-[#1E293B]">Vigilance Terrain</h2>
              <button
                type="button"
                onClick={() => onNavigate('stocks')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A73E8] hover:underline"
              >
                <span>Stocks</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {lowStockItems.length === 0 && overdueDebtors.length === 0 ? (
                <p className="py-4 text-xs text-slate-500">
                  Aucune urgence opérationnelle : les stocks et échéances sont sous contrôle.
                </p>
              ) : (
                <>
                  {lowStockItems.slice(0, 3).map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1E293B] truncate">{item.name}</p>
                        <p className="text-xs text-[#D32F2F] font-medium">
                          {item.quantity === 0 ? 'Rupture de stock' : 'Seuil critique atteint'} (min {item.minThreshold})
                        </p>
                      </div>
                      <span className="font-mono-num text-sm font-bold text-[#D32F2F] whitespace-nowrap">
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                  ))}
                  {overdueDebtors.slice(0, 2).map((deb) => (
                    <div key={deb.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1E293B] truncate">{deb.fullName}</p>
                        <p className="text-xs text-[#D32F2F] font-medium">
                          Dette échue ({deb.dueDate}) · {deb.zone}
                        </p>
                      </div>
                      {role !== 'pointer' ? (
                        <button
                          type="button"
                          onClick={openOverdueDebts}
                          className="font-mono-num text-xs font-bold text-[#D32F2F] hover:underline whitespace-nowrap"
                        >
                          {formatFcfa(deb.remainingFcfa)}
                        </button>
                      ) : (
                        <span className="font-mono-num text-xs font-bold text-[#D32F2F] whitespace-nowrap">
                          {formatFcfa(deb.remainingFcfa)}
                        </span>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="h-36 w-full overflow-hidden bg-slate-100">
              <img
                src="/src/assets/images/agrikoom_coop_storage_1795042837665.jpg"
                alt="Entrepôt de stockage coopératif AgriKoom"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">Magasin Coopératif</p>
                <p className="text-sm font-bold text-[#1E293B]">{products.length} références suivies</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('stocks')}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#1E293B] hover:bg-slate-50 min-h-[40px]"
              >
                Inventaire
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 30-Day Daily Revenue Line Chart (Computed Dynamically from Sales) */}
      <Revenue30DaysChart sales={sales} debtPayments={debtPayments} locale={locale} />

      {/* 30-Day Daily Revenue Comparison Bar Chart (vs Prior 30 Days & By Channel) */}
      <DailyRevenue30ComparisonChart
        sales={sales}
        locale={locale}
        onNavigatePos={role !== 'pointer' ? () => onNavigate('pos') : undefined}
      />

      {/* 6-Month Monthly Revenue Comparison (Long-term Cooperative View) */}
      <MonthlyRevenueComparisonChart
        sales={sales}
        debtPayments={debtPayments}
        locale={locale}
        onNavigateReports={role !== 'pointer' ? () => onNavigate('reports') : undefined}
      />

      {/* Worker Attendance 7-Day vs Previous 7-Day Bar Chart */}
      <AttendanceBarChart
        attendance={attendance}
        locale={locale}
        onNavigateWorkers={() => onNavigate('workers')}
      />

      {/* Daily Cash Closing Variance Bar Chart */}
      <CashClosingVarianceChart
        cashClosings={cashClosings}
        locale={locale}
        onNavigatePos={role !== 'pointer' ? () => onNavigate('pos') : undefined}
        onNavigateReports={role !== 'pointer' ? () => onNavigate('reports') : undefined}
      />

      {/* Critical Stock Products Table */}
      <CriticalStockTable
        products={products}
        locale={locale}
        onNavigateStocks={() => onNavigate('stocks')}
      />
    </div>
  );
};
