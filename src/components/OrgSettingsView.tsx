import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  Globe,
  KeyRound,
  Lock,
  MessageSquare,
  PackageCheck,
  Save,
  Send,
  Shield,
  TrendingUp,
  Users,
  Wallet,
  WifiOff,
} from 'lucide-react';
import { formatFcfa } from '../i18n/translations';
import { getSubscriptionPlan, inferSubscriptionPlan, SUBSCRIPTION_PLANS } from '../lib/subscriptionPlans';
import { buildWhatsappReport, DEFAULT_WHATSAPP_PREFERENCES, openWhatsAppUrl, type ReportPeriod } from '../lib/whatsapp';
import type {
  ActiveTab,
  AttendanceRecord,
  Debtor,
  DebtPayment,
  Locale,
  Organization,
  OrgMember,
  PaymentChannel,
  Product,
  Sale,
  SubscriptionPlan,
  UserRole,
  WhatsappPreferences,
} from '../types/agrikoom';

interface OrgSettingsViewProps {
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
  effectiveOnline: boolean;
  simulatedOffline: boolean;
  onToggleSimulatedOffline: (val: boolean) => void;
  onUpdateOrgSettings: (updates: Partial<Organization>) => Promise<void>;
  onAddStaffMember: (input: { name: string; role: 'admin' | 'manager' | 'pointer'; pinCode: string; phone: string }) => Promise<void>;
  onNavigate: (tab: ActiveTab) => void;
  onOpenPinModal: () => void;
}

const TIME_PRESETS = ['18:00', '19:00', '20:00', '21:00'] as const;
const TIME_REGEX = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export const OrgSettingsView: React.FC<OrgSettingsViewProps> = ({
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
  effectiveOnline,
  simulatedOffline,
  onToggleSimulatedOffline,
  onUpdateOrgSettings,
  onAddStaffMember,
  onNavigate,
  onOpenPinModal,
}) => {
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isFr = locale === 'fr';

  // WhatsApp preferences state
  const [whatsappNumber, setWhatsappNumber] = useState(org.whatsappNumber || org.phone || '');
  const [sendTime, setSendTime] = useState(
    TIME_REGEX.test(org.whatsappReportTime || '') ? org.whatsappReportTime : '18:00'
  );
  const [prefs, setPrefs] = useState<WhatsappPreferences>({
    ...DEFAULT_WHATSAPP_PREFERENCES,
    ...(org.whatsappPreferences || {}),
  });
  const [previewPeriod, setPreviewPeriod] = useState<ReportPeriod>('daily');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [whatsappSavedMsg, setWhatsappSavedMsg] = useState<string | null>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);

  // Organization identity & billing state
  const [orgName, setOrgName] = useState(org.name);
  const [orgRegion, setOrgRegion] = useState(org.region);
  const [orgPhone, setOrgPhone] = useState(org.phone || '');
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>(org.paymentChannel || 'wave');
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>(
    inferSubscriptionPlan(org.subscriptionPlan, org.planAmountUsd)
  );
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgSavedMsg, setOrgSavedMsg] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);

  // Team PIN add form
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<'manager' | 'pointer' | 'admin'>('manager');
  const [staffPin, setStaffPin] = useState('4444');
  const [staffPhone, setStaffPhone] = useState('+221 77 ');
  const [staffSaved, setStaffSaved] = useState(false);

  // Re-sync local state when active organization switches
  useEffect(() => {
    setWhatsappNumber(org.whatsappNumber || org.phone || '');
    setSendTime(TIME_REGEX.test(org.whatsappReportTime || '') ? org.whatsappReportTime : '18:00');
    setPrefs({
      ...DEFAULT_WHATSAPP_PREFERENCES,
      ...(org.whatsappPreferences || {}),
    });
    setOrgName(org.name);
    setOrgRegion(org.region);
    setOrgPhone(org.phone || '');
    setPaymentChannel(org.paymentChannel || 'wave');
    setSubscriptionPlan(inferSubscriptionPlan(org.subscriptionPlan, org.planAmountUsd));
    setWhatsappSavedMsg(null);
    setWhatsappError(null);
    setOrgSavedMsg(null);
    setOrgError(null);
  }, [org]);

  const previewReport = useMemo(
    () =>
      buildWhatsappReport({
        org: {
          ...org,
          name: orgName.trim() || org.name,
          region: orgRegion.trim() || org.region,
        },
        period: previewPeriod,
        sales,
        debtPayments,
        debtors,
        products,
        attendance,
        locale,
        preferencesOverride: prefs,
        sendTimeOverride: TIME_REGEX.test(sendTime) ? sendTime : '18:00',
      }),
    [org, orgName, orgRegion, previewPeriod, sales, debtPayments, debtors, products, attendance, locale, prefs, sendTime]
  );

  const selectedDataCount = [
    prefs.includeRevenue,
    prefs.includeTreasury,
    prefs.includeDebts,
    prefs.includeStockAlerts,
    prefs.includePayroll,
  ].filter(Boolean).length;

  const togglePref = (key: keyof WhatsappPreferences) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    setWhatsappSavedMsg(null);
  };

  const applyPresetSelection = (mode: 'all' | 'essential') => {
    if (mode === 'all') {
      setPrefs((prev) => ({
        ...prev,
        includeRevenue: true,
        includeTreasury: true,
        includeDebts: true,
        includeStockAlerts: true,
        includePayroll: true,
      }));
    } else {
      setPrefs((prev) => ({
        ...prev,
        includeRevenue: true,
        includeTreasury: true,
        includeDebts: false,
        includeStockAlerts: true,
        includePayroll: false,
      }));
    }
    setWhatsappSavedMsg(null);
  };

  const handleSaveWhatsappPreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setWhatsappError(null);
    setWhatsappSavedMsg(null);

    if (!TIME_REGEX.test(sendTime)) {
      setWhatsappError(
        isFr ? 'Veuillez saisir une heure valide au format HH:MM (ex: 18:00).' : 'Please enter a valid HH:MM time (e.g. 18:00).'
      );
      return;
    }
    if (whatsappNumber.trim().length > 30) {
      setWhatsappError(
        isFr ? 'Le numéro WhatsApp ne doit pas dépasser 30 caractères.' : 'WhatsApp number must be 30 characters or less.'
      );
      return;
    }

    setSavingWhatsapp(true);
    try {
      await onUpdateOrgSettings({
        whatsappNumber: whatsappNumber.trim(),
        whatsappReportTime: sendTime,
        whatsappPreferences: prefs,
      });
      setWhatsappSavedMsg(
        effectiveOnline
          ? isFr
            ? `Préférences WhatsApp enregistrées (envoi quotidien à ${sendTime}).`
            : `WhatsApp preferences saved (daily dispatch at ${sendTime}).`
          : isFr
          ? `Préférences enregistrées localement (file hors-ligne · envoi à ${sendTime}).`
          : `Preferences saved offline (queued for sync · dispatch at ${sendTime}).`
      );
    } catch (err) {
      setWhatsappError(
        err instanceof Error
          ? err.message
          : isFr
          ? 'Impossible d\'enregistrer les préférences WhatsApp.'
          : 'Unable to save WhatsApp preferences.'
      );
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const handleSaveOrgIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgError(null);
    setOrgSavedMsg(null);

    const trimmedName = orgName.trim();
    const trimmedRegion = orgRegion.trim();
    const trimmedPhone = orgPhone.trim();

    if (trimmedName.length < 2 || trimmedName.length > 120) {
      setOrgError(isFr ? 'Le nom doit contenir entre 2 et 120 caractères.' : 'Name must be between 2 and 120 characters.');
      return;
    }
    if (trimmedRegion.length < 2 || trimmedRegion.length > 100) {
      setOrgError(isFr ? 'La région doit contenir entre 2 et 100 caractères.' : 'Region must be between 2 and 100 characters.');
      return;
    }

    setSavingOrg(true);
    try {
      const selectedPlanInfo = getSubscriptionPlan(subscriptionPlan);
      await onUpdateOrgSettings({
        name: trimmedName,
        region: trimmedRegion,
        phone: trimmedPhone,
        paymentChannel,
        subscriptionPlan: selectedPlanInfo.id,
        planAmountUsd: selectedPlanInfo.amountUsd,
      });
      setOrgSavedMsg(
        effectiveOnline
          ? isFr
            ? 'Paramètres de l\'organisation mis à jour.'
            : 'Organization settings updated.'
          : isFr
          ? 'Paramètres mis à jour localement (synchronisation en attente).'
          : 'Settings updated locally (sync pending).'
      );
    } catch (err) {
      setOrgError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSavingOrg(false);
    }
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
    setStaffSaved(true);
    setTimeout(() => setStaffSaved(false), 2500);
  };

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="font-display text-xl font-bold text-[#1E293B]">
          {isFr ? 'Accès réservé au Président / Admin' : 'Admin Access Required'}
        </h1>
        <p className="text-sm text-slate-600">
          {isFr
            ? 'La configuration des rapports automatiques WhatsApp et des paramètres de l\'organisation est réservée au profil Président / Admin.'
            : 'WhatsApp automated report scheduling and organization settings are restricted to President / Admin accounts.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onOpenPinModal}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1A73E8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1557B0] min-h-[48px]"
          >
            <KeyRound className="h-4 w-4" />
            <span>{isFr ? 'Déverrouiller poste Admin (PIN)' : 'Switch to Admin (PIN)'}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E293B] hover:bg-slate-50 min-h-[48px]"
          >
            <span>{isFr ? 'Retour au tableau de bord' : 'Back to Dashboard'}</span>
          </button>
        </div>
      </div>
    );
  }

  const dataTypeOptions: Array<{
    key: keyof WhatsappPreferences;
    title: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'includeRevenue',
      title: isFr ? 'Chiffre d\'affaires & Ventilation POS' : 'Revenue & POS Channel Split',
      desc: isFr
        ? 'Total des ventes, montants Espèces, Mobile Money (Wave/OM) et Crédit.'
        : 'Total sales plus Cash, Mobile Money, and Credit split.',
      icon: <TrendingUp className="h-4 w-4 text-[#2E7D32]" />,
    },
    {
      key: 'includeTreasury',
      title: isFr ? 'Trésorerie disponible encaissée' : 'Available Collected Treasury',
      desc: isFr
        ? 'Cash net en caisse et paiements Mobile Money disponibles sur la période.'
        : 'Net cash in register plus Mobile Money collections.',
      icon: <Wallet className="h-4 w-4 text-[#1A73E8]" />,
    },
    {
      key: 'includeDebts',
      title: isFr ? 'Dettes clients & Recouvrements' : 'Client Debts & Collections',
      desc: isFr
        ? 'Acomptes recouvrés, encours total des crédits et dossiers en retard.'
        : 'Recovered installments, total outstanding credit, and overdue count.',
      icon: <CreditCard className="h-4 w-4 text-[#B45309]" />,
    },
    {
      key: 'includeStockAlerts',
      title: isFr ? 'Alertes de stock critique' : 'Critical Stock Alerts',
      desc: isFr
        ? 'Liste des intrants, provende et produits finis sous le seuil minimum.'
        : 'Products below critical threshold or out of stock.',
      icon: <PackageCheck className="h-4 w-4 text-[#D32F2F]" />,
    },
    {
      key: 'includePayroll',
      title: isFr ? 'Masse salariale & Pointages ouvriers' : 'Workforce Payroll & Attendance',
      desc: isFr
        ? 'Montant journalier engagé pour les journaliers et nombre de pointages.'
        : 'Accrued daily labor cost and recorded worker attendance logs.',
      icon: <Users className="h-4 w-4 text-[#1A73E8]" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {org.name} · {org.region}
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold text-[#1E293B] tracking-tight">
            {isFr ? 'Paramètres de l\'Organisation' : 'Organization Settings'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isFr
              ? 'Planification des bilans WhatsApp, choix des indicateurs inclus, identité et codes PIN équipe.'
              : 'Configure WhatsApp report schedule, included data sections, organization profile, and team PINs.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('reports')}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E293B] hover:bg-slate-50 min-h-[48px] whitespace-nowrap shrink-0"
        >
          <BarChart3 className="h-4 w-4 text-[#1A73E8]" />
          <span>{isFr ? 'Voir Rapports & Audit' : 'Open Reports & Audit'}</span>
        </button>
      </div>

      {/* Primary Section: WhatsApp Report Preferences + Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Configuration Form */}
        <form
          onSubmit={handleSaveWhatsappPreferences}
          className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2E7D32]/10 text-[#2E7D32] shrink-0">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-[#1E293B]">
                  {isFr ? 'Préférences des Rapports WhatsApp' : 'WhatsApp Report Preferences'}
                </h2>
                <p className="text-xs text-slate-500">
                  {isFr
                    ? 'Définissez l\'heure d\'envoi automatique et les données envoyées au Président.'
                    : 'Set automated dispatch time and select which operational metrics are included.'}
                </p>
              </div>
            </div>
            <span className="font-mono-num text-xs font-semibold text-[#2E7D32] whitespace-nowrap">
              {selectedDataCount}/5 {isFr ? 'actifs' : 'active'}
            </span>
          </div>

          {/* Recipient & Schedule */}
          <div className="space-y-4">
            <div>
              <label htmlFor="wa-recipient" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {isFr ? 'Numéro WhatsApp destinataire (Président / Gérant)' : 'Recipient WhatsApp Number'}
              </label>
              <input
                id="wa-recipient"
                type="tel"
                maxLength={30}
                value={whatsappNumber}
                onChange={(e) => {
                  setWhatsappNumber(e.target.value);
                  setWhatsappSavedMsg(null);
                }}
                placeholder="+221 77 450 28 19"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono-num text-sm text-[#1E293B] focus:border-[#2E7D32] focus:outline-none min-h-[44px]"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {isFr
                  ? 'Incluez l\'indicatif pays (ex: +221 pour le Sénégal, +225 pour la Côte d\'Ivoire).'
                  : 'Include country code (e.g. +221 for Senegal, +225 for Ivory Coast).'}
              </p>
            </div>

            {/* Dispatch Time */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="wa-send-time" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Clock className="h-3.5 w-3.5 text-[#1A73E8]" />
                  <span>{isFr ? 'Heure d\'envoi quotidien automatique' : 'Daily Automated Send Time'}</span>
                </label>
                <span className="font-mono-num text-xs font-bold text-[#1E293B]">{sendTime}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {TIME_PRESETS.map((preset) => {
                  const selected = sendTime === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setSendTime(preset);
                        setWhatsappSavedMsg(null);
                      }}
                      className={`rounded-xl border px-3 py-2.5 font-mono-num text-sm font-semibold transition-colors min-h-[44px] ${
                        selected
                          ? 'border-[#2E7D32] bg-[#2E7D32]/10 text-[#2E7D32]'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}
                <input
                  id="wa-send-time"
                  type="time"
                  value={sendTime}
                  onChange={(e) => {
                    setSendTime(e.target.value);
                    setWhatsappSavedMsg(null);
                  }}
                  aria-label={isFr ? 'Heure personnalisée d\'envoi WhatsApp' : 'Custom WhatsApp dispatch time'}
                  className="rounded-xl border border-slate-300 px-3 py-2 font-mono-num text-sm font-semibold text-[#1E293B] focus:border-[#2E7D32] focus:outline-none min-h-[44px]"
                />
              </div>
            </div>

            {/* Recurring Weekly & Monthly Summaries */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                role="switch"
                aria-checked={prefs.weeklySummary}
                onClick={() => togglePref('weeklySummary')}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors min-h-[56px] ${
                  prefs.weeklySummary
                    ? 'border-[#2E7D32]/40 bg-[#2E7D32]/5'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E293B]">
                    <CalendarClock className="h-3.5 w-3.5 text-[#2E7D32]" />
                    <span>{isFr ? 'Synthèse hebdomadaire' : 'Weekly Summary'}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isFr ? 'Chaque dimanche soir' : 'Every Sunday evening'}
                  </p>
                </div>
                <span
                  className={`text-[11px] font-bold whitespace-nowrap ${
                    prefs.weeklySummary ? 'text-[#2E7D32]' : 'text-slate-400'
                  }`}
                >
                  {prefs.weeklySummary ? (isFr ? 'Activé' : 'Enabled') : isFr ? 'Désactivé' : 'Off'}
                </span>
              </button>

              <button
                type="button"
                role="switch"
                aria-checked={prefs.monthlySummary}
                onClick={() => togglePref('monthlySummary')}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors min-h-[56px] ${
                  prefs.monthlySummary
                    ? 'border-[#2E7D32]/40 bg-[#2E7D32]/5'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E293B]">
                    <CalendarClock className="h-3.5 w-3.5 text-[#1A73E8]" />
                    <span>{isFr ? 'Bilan mensuel consolidé' : 'Monthly Consolidated Report'}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isFr ? 'Clôture fin de mois' : 'End of month closing'}
                  </p>
                </div>
                <span
                  className={`text-[11px] font-bold whitespace-nowrap ${
                    prefs.monthlySummary ? 'text-[#2E7D32]' : 'text-slate-400'
                  }`}
                >
                  {prefs.monthlySummary ? (isFr ? 'Activé' : 'Enabled') : isFr ? 'Désactivé' : 'Off'}
                </span>
              </button>
            </div>
          </div>

          {/* Data Types Included */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  {isFr ? 'Types de données incluses dans le rapport' : 'Data Types Included in Report'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isFr
                    ? 'Cochez les indicateurs que vous souhaitez recevoir dans chaque message.'
                    : 'Choose which operational blocks appear in each dispatched message.'}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => applyPresetSelection('all')}
                  className="font-semibold text-[#2E7D32] hover:underline whitespace-nowrap"
                >
                  {isFr ? 'Tout inclure' : 'Select all'}
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => applyPresetSelection('essential')}
                  className="font-semibold text-[#1A73E8] hover:underline whitespace-nowrap"
                >
                  {isFr ? 'Essentiel' : 'Essentials'}
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {dataTypeOptions.map((item) => {
                const enabled = prefs[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => togglePref(item.key)}
                    className={`w-full flex items-center justify-between gap-4 rounded-xl border p-3.5 text-left transition-colors min-h-[56px] ${
                      enabled
                        ? 'border-[#2E7D32]/50 bg-[#2E7D32]/5'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 shrink-0">{item.icon}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1E293B]">{item.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-bold ${
                          enabled ? 'text-[#2E7D32]' : 'text-slate-400'
                        }`}
                      >
                        {enabled ? (isFr ? 'Inclus' : 'Included') : isFr ? 'Exclus' : 'Excluded'}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          enabled ? 'bg-[#2E7D32]' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedDataCount === 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-[#FFB300]/50 bg-[#FFB300]/15 px-3.5 py-2.5 text-xs font-medium text-[#92400E]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {isFr
                    ? 'Aucune rubrique sélectionnée : activez au moins un type de données pour recevoir un bilan utile.'
                    : 'No sections selected: enable at least one data type to generate an informative report.'}
                </span>
              </div>
            )}
          </div>

          {/* Feedback & Save Button */}
          {whatsappError && (
            <p className="rounded-xl border border-[#D32F2F]/30 bg-[#D32F2F]/10 px-3.5 py-2.5 text-xs font-semibold text-[#D32F2F]">
              {whatsappError}
            </p>
          )}
          {whatsappSavedMsg && (
            <p className="flex items-center gap-2 rounded-xl border border-[#2E7D32]/30 bg-[#2E7D32]/10 px-3.5 py-2.5 text-xs font-semibold text-[#2E7D32]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{whatsappSavedMsg}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={savingWhatsapp}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2E7D32] px-5 py-3 text-sm font-semibold text-white hover:bg-[#256428] disabled:opacity-60 min-h-[48px]"
          >
            <Save className="h-4 w-4" />
            <span>
              {savingWhatsapp
                ? isFr
                  ? 'Enregistrement...'
                  : 'Saving...'
                : isFr
                ? 'Enregistrer les préférences WhatsApp'
                : 'Save WhatsApp Preferences'}
            </span>
          </button>
        </form>

        {/* Right: Live Preview of the Generated WhatsApp Message */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-bold text-[#1E293B]">
                  {isFr ? 'Aperçu en Direct du Bilan' : 'Live Dispatch Preview'}
                </h2>
                <p className="text-xs text-slate-500">
                  {isFr ? 'Destinataire' : 'Recipient'} :{' '}
                  <span className="font-mono-num font-semibold text-[#1E293B]">
                    {whatsappNumber.trim() || (isFr ? 'Non défini' : 'Not set')}
                  </span>{' '}
                  · <span className="font-mono-num">{sendTime}</span>
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {(
                  [
                    ['daily', isFr ? 'Jour' : 'Daily'],
                    ['weekly', isFr ? 'Hebdo' : 'Weekly'],
                    ['monthly', isFr ? 'Mois' : 'Monthly'],
                  ] as const
                ).map(([p, lbl]) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPreviewPeriod(p)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      previewPeriod === p ? 'bg-white text-[#1E293B] shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-[#F4F6F8] p-4 font-mono text-xs leading-relaxed text-[#1E293B] max-h-[430px] overflow-y-auto">
              {previewReport}
            </pre>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => openWhatsAppUrl(whatsappNumber, previewReport)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#2E7D32] bg-white px-4 py-2.5 text-sm font-semibold text-[#2E7D32] hover:bg-[#2E7D32]/5 min-h-[48px]"
            >
              <Send className="h-4 w-4" />
              <span>{isFr ? 'Tester cet aperçu sur WhatsApp' : 'Test Preview on WhatsApp'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Section: Organization Profile + Team PINs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Organization Identity, Language & Offline Testing */}
        <div className="lg:col-span-6 space-y-6">
          <form onSubmit={handleSaveOrgIdentity} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#1A73E8]" />
              <h2 className="font-display text-base font-bold text-[#1E293B]">
                {isFr ? 'Identité de la Coopérative & Facturation' : 'Cooperative Profile & Billing'}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="org-name" className="block text-xs font-semibold text-slate-600 mb-1">
                  {isFr ? 'Nom de l\'organisation' : 'Organization Name'}
                </label>
                <input
                  id="org-name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label htmlFor="org-region" className="block text-xs font-semibold text-slate-600 mb-1">
                  {isFr ? 'Région / Zone' : 'Region / Zone'}
                </label>
                <input
                  id="org-region"
                  required
                  minLength={2}
                  maxLength={100}
                  value={orgRegion}
                  onChange={(e) => setOrgRegion(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="org-phone" className="block text-xs font-semibold text-slate-600 mb-1">
                  {isFr ? 'Téléphone bureau / magasin' : 'Office Phone'}
                </label>
                <input
                  id="org-phone"
                  type="tel"
                  maxLength={30}
                  value={orgPhone}
                  onChange={(e) => setOrgPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono-num text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label htmlFor="org-pay-channel" className="block text-xs font-semibold text-slate-600 mb-1">
                  {isFr ? 'Canal de paiement SaaS' : 'SaaS Billing Channel'}
                </label>
                <select
                  id="org-pay-channel"
                  value={paymentChannel}
                  onChange={(e) => setPaymentChannel(e.target.value as PaymentChannel)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                >
                  <option value="wave">Wave Business</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="free_money">Free Money</option>
                  <option value="cash">Espèces</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="org-sub-plan" className="block text-xs font-semibold text-slate-600 mb-1">
                {isFr ? 'Formule d’abonnement' : 'Subscription Plan'}
              </label>
              <select
                id="org-sub-plan"
                value={subscriptionPlan}
                onChange={(e) => setSubscriptionPlan(e.target.value as SubscriptionPlan)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
              >
                {SUBSCRIPTION_PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {isFr
                      ? `${p.labelFr} — ${formatFcfa(p.amountFcfa)} ${p.periodFr}`
                      : `${p.labelEn} — ${formatFcfa(p.amountFcfa)} ${p.periodEn}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <CreditCard className="h-4 w-4 text-[#2E7D32]" />
                {isFr ? 'Forfait actif' : 'Active plan'} :{' '}
                <strong className="text-[#1E293B] font-mono-num">
                  {getSubscriptionPlan(subscriptionPlan).labelFr} ({formatFcfa(getSubscriptionPlan(subscriptionPlan).amountFcfa)})
                </strong>
              </span>
              <span className="font-semibold text-[#2E7D32] uppercase">{org.subscriptionStatus}</span>
            </div>

            {orgError && <p className="text-xs font-semibold text-[#D32F2F]">{orgError}</p>}
            {orgSavedMsg && (
              <p className="text-xs font-semibold text-[#2E7D32] flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>{orgSavedMsg}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={savingOrg}
              className="w-full rounded-xl border border-[#2E7D32] bg-white py-2.5 text-sm font-semibold text-[#2E7D32] hover:bg-[#2E7D32]/5 min-h-[44px]"
            >
              {savingOrg
                ? isFr
                  ? 'Mise à jour...'
                  : 'Updating...'
                : isFr
                ? 'Mettre à jour les informations'
                : 'Update Cooperative Profile'}
            </button>
          </form>

          {/* Language & Offline Simulation */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E293B]">
                <Globe className="h-4 w-4 text-[#1A73E8]" />
                {isFr ? 'Langue de l\'interface' : 'Interface Language'}
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => onChangeLocale('fr')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md ${
                    locale === 'fr' ? 'bg-white shadow-sm text-[#1E293B]' : 'text-slate-600'
                  }`}
                >
                  Français
                </button>
                <button
                  type="button"
                  onClick={() => onChangeLocale('en')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md ${
                    locale === 'en' ? 'bg-white shadow-sm text-[#1E293B]' : 'text-slate-600'
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E293B]">
                  <WifiOff className="h-4 w-4 text-[#FFB300]" />
                  {isFr ? 'Test Mode Hors-Ligne Terrain' : 'Field Offline Test Mode'}
                </p>
                <p className="text-xs text-slate-500">
                  {isFr
                    ? 'Simule une perte de réseau 3G pour vérifier la file IndexedDB.'
                    : 'Simulate 3G network outage to verify IndexedDB sync queue.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onToggleSimulatedOffline(!simulatedOffline)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold min-h-[40px] whitespace-nowrap shrink-0 ${
                  simulatedOffline ? 'bg-[#FFB300] text-[#1E293B]' : 'border border-slate-300 text-slate-700'
                }`}
              >
                {simulatedOffline
                  ? isFr
                    ? 'Désactiver test'
                    : 'Disable test'
                  : isFr
                  ? 'Simuler coupure'
                  : 'Simulate offline'}
              </button>
            </div>
          </div>
        </div>

        {/* Team PIN Access Management */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#1A73E8]" />
              <h2 className="font-display text-base font-bold text-[#1E293B]">
                {isFr ? 'Équipe Terrain & Codes PIN' : 'Field Team & PIN Access'}
              </h2>
            </div>
            <span className="font-mono-num text-xs text-slate-500">
              {members.length} {isFr ? 'opérateurs' : 'operators'}
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {members.map((m) => (
              <div key={m.id} className="py-3 flex items-center justify-between text-xs gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[#1E293B] truncate">{m.name}</p>
                  <p className="text-slate-500">
                    {m.role.toUpperCase()} · {m.phone || (isFr ? 'Sans téléphone' : 'No phone')}
                  </p>
                </div>
                <span className="font-mono-num font-bold text-slate-700 whitespace-nowrap">PIN: {m.pinCode}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddMember} className="pt-4 border-t border-slate-100 space-y-3">
            <p className="text-xs font-semibold text-slate-700">
              {isFr ? 'Ajouter un opérateur PIN' : 'Add PIN Operator'}
            </p>
            <input
              required
              minLength={2}
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder={isFr ? 'Nom complet' : 'Full name'}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value as 'manager' | 'pointer' | 'admin')}
                className="rounded-xl border border-slate-300 px-2.5 py-2 text-xs min-h-[44px]"
              >
                <option value="manager">{isFr ? 'Gérant / Caissier' : 'Manager / Cashier'}</option>
                <option value="pointer">{isFr ? 'Pointeur' : 'Field Pointer'}</option>
                <option value="admin">{isFr ? 'Président' : 'President / Admin'}</option>
              </select>
              <input
                required
                maxLength={4}
                pattern="[0-9]{4}"
                value={staffPin}
                onChange={(e) => setStaffPin(e.target.value)}
                placeholder="PIN 4 chiffres"
                className="rounded-xl border border-slate-300 px-3 py-2 font-mono-num text-xs min-h-[44px]"
              />
              <input
                value={staffPhone}
                onChange={(e) => setStaffPhone(e.target.value)}
                placeholder={isFr ? 'Téléphone' : 'Phone'}
                className="rounded-xl border border-slate-300 px-3 py-2 font-mono-num text-xs min-h-[44px]"
              />
            </div>
            {staffSaved && (
              <p className="text-xs font-semibold text-[#2E7D32] flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>{isFr ? 'Opérateur ajouté à l\'équipe.' : 'Operator added to team.'}</span>
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-xl border border-[#2E7D32] text-[#2E7D32] py-2.5 text-xs font-semibold hover:bg-[#2E7D32]/5 min-h-[44px]"
            >
              {isFr ? 'Ajouter à l\'équipe' : 'Add to Team'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
