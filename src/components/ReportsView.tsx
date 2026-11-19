import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Globe,
  MessageSquare,
  Send,
  Settings,
  Share2,
  Shield,
  WifiOff,
} from 'lucide-react';
import { formatFcfa } from '../i18n/translations';
import { formatMonthLabel, generateMonthlyPerformancePdf } from '../lib/monthlyPdfReport';
import { getSubscriptionPlan, inferSubscriptionPlan } from '../lib/subscriptionPlans';
import {
  buildWhatsappReport,
  DEFAULT_WHATSAPP_PREFERENCES,
  downloadAccountingCsv,
  openWhatsAppUrl,
  type ReportPeriod,
} from '../lib/whatsapp';
import { MonthlyPerformanceCard } from './MonthlyPerformanceCard';
import type {
  AttendanceRecord,
  AuditLog,
  CashClosing,
  Debtor,
  DebtPayment,
  Locale,
  Organization,
  OrgMember,
  PaymentChannel,
  Product,
  Sale,
  UserRole,
} from '../types/agrikoom';

interface ReportsViewProps {
  org: Organization;
  role: UserRole;
  locale: Locale;
  onChangeLocale: (loc: Locale) => void;
  members: Array<OrgMember & { id: string; orgId: string }>;
  products: Product[];
  sales: Sale[];
  debtors: Debtor[];
  debtPayments: DebtPayment[];
  attendance: AttendanceRecord[];
  cashClosings: CashClosing[];
  auditLogs: AuditLog[];
  simulatedOffline: boolean;
  onToggleSimulatedOffline: (val: boolean) => void;
  onUpdateOrgSettings: (updates: Partial<Organization>) => Promise<void>;
  onAddStaffMember: (input: { name: string; role: 'admin' | 'manager' | 'pointer'; pinCode: string; phone: string }) => Promise<void>;
  onOpenSettings?: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  org,
  role,
  locale,
  onChangeLocale,
  members,
  products,
  sales,
  debtors,
  debtPayments,
  attendance,
  cashClosings,
  auditLogs,
  simulatedOffline,
  onToggleSimulatedOffline,
  onUpdateOrgSettings,
  onAddStaffMember,
  onOpenSettings,
}) => {
  const [period, setPeriod] = useState<ReportPeriod>('daily');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [copied, setCopied] = useState(false);
  const [csvExported, setCsvExported] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfSuccessMsg, setPdfSuccessMsg] = useState<string | null>(null);
  const [whatsappNum, setWhatsappNum] = useState(org.whatsappNumber || org.phone || '');
  const [cronTime, setCronTime] = useState<string>(org.whatsappReportTime || '18:00');
  const [payChannel, setPayChannel] = useState<PaymentChannel>(org.paymentChannel || 'wave');
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Add staff form
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<'manager' | 'pointer' | 'admin'>('manager');
  const [staffPin, setStaffPin] = useState('4444');
  const [staffPhone, setStaffPhone] = useState('+221 77 ');

  const reportText = useMemo(
    () =>
      buildWhatsappReport({
        org,
        period,
        sales,
        debtPayments,
        debtors,
        products,
        attendance,
        locale,
      }),
    [org, period, sales, debtPayments, debtors, products, attendance, locale]
  );

  const payrollTransactionsCount = useMemo(
    () => attendance.filter((a) => a.earnedFcfa > 0 || a.advanceGivenFcfa > 0).length,
    [attendance]
  );

  const totalAccountingRows =
    sales.length + debtPayments.length + payrollTransactionsCount + cashClosings.length;

  const monthlySummary = useMemo(() => {
    const mSales = sales.filter((s) => s.status === 'completed' && s.createdAt.slice(0, 7) === selectedMonth);
    const mPayments = debtPayments.filter((p) => p.createdAt.slice(0, 7) === selectedMonth);
    const mAttendance = attendance.filter((a) => a.workDate.slice(0, 7) === selectedMonth);
    return {
      monthLabel: formatMonthLabel(selectedMonth, locale),
      salesCount: mSales.length,
      revenueFcfa: mSales.reduce((sum, s) => sum + s.totalFcfa, 0),
      collectionsFcfa: mPayments.reduce((sum, p) => sum + p.amountFcfa, 0),
      payrollFcfa: mAttendance.reduce((sum, a) => sum + a.earnedFcfa, 0),
    };
  }, [sales, debtPayments, attendance, selectedMonth, locale]);

  const handleExportCsv = () => {
    downloadAccountingCsv(org, sales, debtPayments, attendance, cashClosings);
    setCsvExported(true);
    setTimeout(() => setCsvExported(false), 3000);
  };

  const handleExportMonthlyPdf = async () => {
    setPdfGenerating(true);
    try {
      const result = await generateMonthlyPerformancePdf({
        org,
        monthIso: selectedMonth,
        sales,
        debtPayments,
        debtors,
        products,
        attendance,
        cashClosings,
        locale,
      });
      setPdfSuccessMsg(
        `Rapport PDF mensuel (${result.monthLabel}) téléchargé avec 4 graphiques de performance.`
      );
      setTimeout(() => setPdfSuccessMsg(null), 4000);
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `AgriKoom — ${org.name}`,
          text: reportText,
        });
      } catch {
        // user cancelled share sheet
      }
    } else {
      await handleCopy();
    }
  };

  const handleSaveOrgConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateOrgSettings({
      whatsappNumber: whatsappNum.trim(),
      whatsappReportTime: cronTime,
      paymentChannel: payChannel,
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !/^[0-9]{4}$/.test(staffPin)) return;
    await onAddStaffMember({
      name: staffName.trim(),
      role: staffRole,
      pinCode: staffPin,
      phone: staffPhone.trim(),
    });
    setStaffName('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1E293B]">Rapports WhatsApp, Audit &amp; Paramètres</h1>
          <p className="text-xs text-slate-500">
            Synthèse automatique 18h/20h, export bancaire CSV (LBA/BNDE), journal d&apos;audit et gestion équipe PIN
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {(role === 'admin' || role === 'super_admin') && onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-2 rounded-xl border border-[#2E7D32] bg-white px-4 py-2.5 text-sm font-semibold text-[#2E7D32] hover:bg-[#2E7D32]/5 min-h-[48px] whitespace-nowrap shrink-0"
            >
              <Settings className="h-4 w-4" />
              <span>Préférences WhatsApp</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportMonthlyPdf}
            disabled={pdfGenerating}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2E7D32] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#256428] disabled:opacity-60 min-h-[48px] whitespace-nowrap shrink-0"
          >
            <FileText className="h-4 w-4" />
            <span>{pdfGenerating ? 'Génération PDF…' : 'Rapport PDF Mensuel'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1A73E8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1557B0] min-h-[48px] whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            <span>Export Historique CSV</span>
          </button>
        </div>
      </div>

      <MonthlyPerformanceCard
        selectedMonth={selectedMonth}
        onChangeMonth={setSelectedMonth}
        sales={sales}
        debtPayments={debtPayments}
        products={products}
        attendance={attendance}
        locale={locale}
        pdfGenerating={pdfGenerating}
        pdfSuccessMsg={pdfSuccessMsg}
        onDownloadPdf={handleExportMonthlyPdf}
      />

      {/* Module 5: WhatsApp Automated Report Preview & Dispatch */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#2E7D32]" />
              <h2 className="font-display text-base font-bold text-[#1E293B]">Aperçu du Bilan WhatsApp</h2>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  ['daily', 'Quotidien'],
                  ['weekly', 'Hebdo'],
                  ['monthly', 'Mensuel'],
                ] as const
              ).map(([p, lbl]) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    period === p ? 'bg-white text-[#1E293B] shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-[#F4F6F8] p-4 font-mono text-xs leading-relaxed text-[#1E293B]">
            {reportText}
          </pre>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => openWhatsAppUrl(whatsappNum, reportText)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2E7D32] px-5 py-3 text-sm font-semibold text-white hover:bg-[#256428] min-h-[48px]"
            >
              <Send className="h-4 w-4" />
              <span>Envoyer sur WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={handleNativeShare}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-[#1E293B] hover:bg-slate-50 min-h-[48px]"
            >
              <Share2 className="h-4 w-4 text-[#1A73E8]" />
              <span>Partager</span>
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-[#1E293B] hover:bg-slate-50 min-h-[48px]"
            >
              <Copy className="h-4 w-4" />
              <span>{copied ? 'Copié' : 'Copier'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Automation Cron, Language, Offline Test & Subscription */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleSaveOrgConfig} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="font-display text-base font-bold text-[#1E293B]">Planification WhatsApp &amp; Abonnement</h2>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Numéro WhatsApp Président</label>
              <input
                type="text"
                value={whatsappNum}
                onChange={(e) => setWhatsappNum(e.target.value)}
                placeholder="+221 77 450 28 19"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Heure Envoi Quotidien</label>
                <input
                  type="time"
                  value={cronTime}
                  onChange={(e) => setCronTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono-num text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Canal de facturation SaaS</label>
                <select
                  value={payChannel}
                  onChange={(e) => setPayChannel(e.target.value as PaymentChannel)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                >
                  <option value="wave">Wave Business</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="free_money">Free Money</option>
                </select>
              </div>
            </div>

            {(() => {
              const activePrefs = org.whatsappPreferences || DEFAULT_WHATSAPP_PREFERENCES;
              const enabledLabels = [
                activePrefs.includeRevenue && 'CA',
                activePrefs.includeTreasury && 'Trésorerie',
                activePrefs.includeDebts && 'Dettes',
                activePrefs.includeStockAlerts && 'Stocks',
                activePrefs.includePayroll && 'Paie',
              ].filter(Boolean);
              return (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">Données incluses :</span>
                    {(role === 'admin' || role === 'super_admin') && onOpenSettings && (
                      <button
                        type="button"
                        onClick={onOpenSettings}
                        className="font-semibold text-[#1A73E8] hover:underline whitespace-nowrap"
                      >
                        Personnaliser →
                      </button>
                    )}
                  </div>
                  <p className="text-slate-600">
                    {enabledLabels.length > 0 ? enabledLabels.join(' · ') : 'Aucune rubrique active'}
                  </p>
                </div>
              );
            })()}

            <div className="rounded-xl bg-slate-50 p-3 text-xs flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <CreditCard className="h-4 w-4 text-[#2E7D32]" />
                Abonnement :{' '}
                <strong className="text-[#1E293B] font-mono-num">
                  {getSubscriptionPlan(inferSubscriptionPlan(org.subscriptionPlan, org.planAmountUsd)).labelFr} (
                  {formatFcfa(
                    getSubscriptionPlan(inferSubscriptionPlan(org.subscriptionPlan, org.planAmountUsd)).amountFcfa
                  )}
                  )
                </strong>
              </span>
              <span className="font-semibold text-[#2E7D32] uppercase">{org.subscriptionStatus}</span>
            </div>

            {(role === 'admin' || role === 'super_admin') && (
              <button
                type="submit"
                className="w-full rounded-xl bg-[#2E7D32] py-2.5 text-sm font-semibold text-white hover:bg-[#256428] min-h-[44px]"
              >
                Enregistrer la configuration
              </button>
            )}

            {settingsSaved && (
              <p className="text-xs font-semibold text-[#2E7D32] flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Configuration sauvegardée.
              </p>
            )}
          </form>

          {/* Language & Offline Resilience Controls */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E293B]">
                <Globe className="h-4 w-4 text-[#1A73E8]" />
                Langue de l&apos;interface
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => onChangeLocale('fr')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md ${locale === 'fr' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
                >
                  Français
                </button>
                <button
                  type="button"
                  onClick={() => onChangeLocale('en')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md ${locale === 'en' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
                >
                  English
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E293B]">
                  <WifiOff className="h-4 w-4 text-[#FFB300]" />
                  Test Mode Hors-Ligne Terrain
                </p>
                <p className="text-xs text-slate-500">
                  Simule une perte de réseau 3G pour vérifier la file IndexedDB.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onToggleSimulatedOffline(!simulatedOffline)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold min-h-[38px] ${
                  simulatedOffline
                    ? 'bg-[#FFB300] text-[#1E293B]'
                    : 'border border-slate-300 text-slate-700'
                }`}
              >
                {simulatedOffline ? 'Désactiver test' : 'Simuler coupure'}
              </button>
            </div>
          </div>

          {/* Dedicated Monthly PDF & Accounting CSV Export Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-[#1A73E8] shrink-0" />
                <div>
                  <h2 className="font-display text-sm font-bold text-[#1E293B]">
                    Rapports Mensuels PDF &amp; Export Comptable CSV
                  </h2>
                  <p className="text-xs text-slate-500">
                    Bilan PDF avec graphiques de performance + journal comptable CSV (LBA/BNDE)
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="pdf-report-month"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                >
                  <Calendar className="h-3.5 w-3.5 text-[#2E7D32]" />
                  <span>Période du rapport PDF</span>
                </label>
                <input
                  id="pdf-report-month"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono-num text-xs font-semibold text-[#1E293B]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-slate-200/80">
                <div>
                  <span className="text-slate-500">CA ({monthlySummary.salesCount})</span>
                  <p className="font-mono-num font-bold text-[#1E293B]">
                    {formatFcfa(monthlySummary.revenueFcfa)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Recouvré</span>
                  <p className="font-mono-num font-bold text-[#2E7D32]">
                    {formatFcfa(monthlySummary.collectionsFcfa)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Paie mois</span>
                  <p className="font-mono-num font-bold text-[#1A73E8]">
                    {formatFcfa(monthlySummary.payrollFcfa)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
              <div>
                <span className="text-slate-500">Ventes POS</span>
                <p className="font-mono-num text-sm font-bold text-[#1E293B]">{sales.length}</p>
              </div>
              <div>
                <span className="text-slate-500">Recouvrements</span>
                <p className="font-mono-num text-sm font-bold text-[#2E7D32]">{debtPayments.length}</p>
              </div>
              <div>
                <span className="text-slate-500">Paies ouvriers</span>
                <p className="font-mono-num text-sm font-bold text-[#1A73E8]">{payrollTransactionsCount}</p>
              </div>
              <div>
                <span className="text-slate-500">Clôtures</span>
                <p className="font-mono-num text-sm font-bold text-[#B45309]">{cashClosings.length}</p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleExportMonthlyPdf}
                disabled={pdfGenerating}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2E7D32] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#256428] disabled:opacity-60 min-h-[48px]"
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span>
                  {pdfGenerating
                    ? 'Génération du PDF…'
                    : `Générer Rapport PDF Mensuel (${monthlySummary.monthLabel})`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1A73E8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1557B0] min-h-[48px]"
              >
                <Download className="h-4 w-4 shrink-0" />
                <span>Exporter l&apos;historique complet ({totalAccountingRows} écritures · CSV)</span>
              </button>
            </div>

            {pdfSuccessMsg && (
              <p className="text-xs font-semibold text-[#2E7D32] flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{pdfSuccessMsg}</span>
              </p>
            )}

            {csvExported && (
              <p className="text-xs font-semibold text-[#2E7D32] flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Historique comptable CSV téléchargé ({totalAccountingRows} transactions exportées).
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Team PIN Management + Immutable Audit Trail + Cash Closings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#1A73E8]" />
            <h2 className="font-display text-base font-bold text-[#1E293B]">Équipe Terrain &amp; Codes PIN</h2>
          </div>

          <div className="divide-y divide-slate-100">
            {members.map((m) => (
              <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-[#1E293B]">{m.name}</p>
                  <p className="text-slate-500">{m.role.toUpperCase()} · {m.phone || 'Sans téléphone'}</p>
                </div>
                <span className="font-mono-num font-bold text-slate-700">PIN: {m.pinCode}</span>
              </div>
            ))}
          </div>

          {(role === 'admin' || role === 'super_admin') && (
            <form onSubmit={handleAddMember} className="pt-3 border-t border-slate-100 space-y-2.5">
              <p className="text-xs font-semibold text-slate-700">Ajouter un opérateur PIN</p>
              <input
                required
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Nom complet"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[42px]"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value as 'manager' | 'pointer' | 'admin')}
                  className="rounded-xl border border-slate-300 px-2 py-2 text-xs min-h-[42px]"
                >
                  <option value="manager">Gérant / Caissier</option>
                  <option value="pointer">Pointeur</option>
                  <option value="admin">Président</option>
                </select>
                <input
                  required
                  maxLength={4}
                  pattern="[0-9]{4}"
                  value={staffPin}
                  onChange={(e) => setStaffPin(e.target.value)}
                  placeholder="PIN 4 chiffres"
                  className="rounded-xl border border-slate-300 px-2.5 py-2 font-mono-num text-xs min-h-[42px]"
                />
                <input
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  placeholder="Téléphone"
                  className="rounded-xl border border-slate-300 px-2.5 py-2 text-xs min-h-[42px]"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl border border-[#2E7D32] text-[#2E7D32] py-2 text-xs font-semibold hover:bg-[#2E7D32]/5 min-h-[42px]"
              >
                Ajouter à l&apos;équipe
              </button>
            </form>
          )}
        </div>

        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-[#1E293B]">Journal d&apos;Audit Immuable &amp; Clôtures</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">{auditLogs.length} traces · {cashClosings.length} clôtures</span>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1A73E8] hover:bg-slate-50 min-h-[34px]"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Exporter CSV</span>
              </button>
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {cashClosings.map((c) => (
              <div key={c.id} className="px-5 py-3 bg-slate-50/50 text-xs flex items-center justify-between gap-3">
                <div>
                  <span className="font-semibold text-[#1A73E8]">CLÔTURE CAISSE ({c.closingDate})</span>
                  <p className="text-slate-600 mt-0.5">
                    Théorique : {formatFcfa(c.theoreticalCashFcfa)} · Compté : {formatFcfa(c.countedCashFcfa)} · Écart :{' '}
                    <span className={c.varianceFcfa === 0 ? 'text-[#2E7D32] font-semibold' : 'text-[#D32F2F] font-semibold'}>
                      {formatFcfa(c.varianceFcfa)}
                    </span>
                  </p>
                </div>
                <span className="text-slate-500">{c.closedByName}</span>
              </div>
            ))}
            {auditLogs.slice(0, 20).map((log) => (
              <div key={log.id} className="px-5 py-3 text-xs flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono-num font-semibold text-[#1E293B]">{log.action}</span>
                  <p className="text-slate-600 mt-0.5">{log.summary}</p>
                </div>
                <div className="text-right text-slate-400 whitespace-nowrap">
                  <div>{log.actorName}</div>
                  <div className="font-mono-num">{log.createdAt.slice(0, 16).replace('T', ' ')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
