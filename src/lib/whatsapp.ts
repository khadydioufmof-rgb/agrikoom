import { formatFcfa } from '../i18n/translations';
import type {
  AttendanceRecord,
  CashClosing,
  Debtor,
  DebtPayment,
  Organization,
  Product,
  Sale,
  WhatsappPreferences,
} from '../types/agrikoom';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export const DEFAULT_WHATSAPP_PREFERENCES: WhatsappPreferences = {
  includeRevenue: true,
  includeTreasury: true,
  includeDebts: true,
  includeStockAlerts: true,
  includePayroll: true,
  weeklySummary: true,
  monthlySummary: true,
};

export function buildWhatsappReport(params: {
  org: Organization;
  period: ReportPeriod;
  sales: Sale[];
  debtPayments: DebtPayment[];
  debtors: Debtor[];
  products: Product[];
  attendance: AttendanceRecord[];
  locale: 'fr' | 'en';
  preferencesOverride?: WhatsappPreferences;
  sendTimeOverride?: string;
}): string {
  const { org, period, sales, debtPayments, debtors, products, attendance, locale, preferencesOverride, sendTimeOverride } = params;
  const prefs: WhatsappPreferences = preferencesOverride || org.whatsappPreferences || DEFAULT_WHATSAPP_PREFERENCES;
  const sendTime = sendTimeOverride || org.whatsappReportTime || '18:00';
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  const periodDays = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
  const cutoff = new Date(now.getTime() - (periodDays - 1) * 86400000).toISOString().slice(0, 10);

  const activeSales = sales.filter((s) => s.status === 'completed' && s.createdAt.slice(0, 10) >= cutoff);
  const totalSales = activeSales.reduce((sum, s) => sum + s.totalFcfa, 0);
  const cashTotal = activeSales.reduce((sum, s) => sum + s.cashFcfa, 0);
  const momoTotal = activeSales.reduce((sum, s) => sum + s.mobileMoneyFcfa, 0);
  const creditTotal = activeSales.reduce((sum, s) => sum + s.creditFcfa, 0);

  const periodPayments = debtPayments.filter((p) => p.createdAt.slice(0, 10) >= cutoff);
  const recoveredTotal = periodPayments.reduce((sum, p) => sum + p.amountFcfa, 0);
  const totalOutstandingDebt = debtors.reduce((sum, d) => sum + d.remainingFcfa, 0);
  const overdueCount = debtors.filter((d) => d.status === 'en_retard').length;

  const treasuryAvailable = cashTotal + momoTotal + recoveredTotal;
  const lowStockProducts = products.filter((p) => p.quantity <= p.minThreshold);

  const periodAttendance = attendance.filter((a) => a.workDate >= cutoff);
  const payrollEngaged = periodAttendance.reduce((sum, a) => sum + a.earnedFcfa, 0);

  const periodLabelFr =
    period === 'daily' ? `Bilan Quotidien (${todayIso})` : period === 'weekly' ? 'Synthèse Hebdomadaire (7j)' : 'Bilan Mensuel (30j)';
  const periodLabelEn =
    period === 'daily' ? `Daily Summary (${todayIso})` : period === 'weekly' ? 'Weekly Summary (7d)' : 'Monthly Summary (30d)';

  const lines: string[] = [
    `*AGRIKOOM — ${org.name.toUpperCase()}*`,
    `${locale === 'en' ? periodLabelEn : periodLabelFr} · ${org.region}`,
  ];

  let sectionIdx = 1;

  if (prefs.includeRevenue) {
    lines.push('');
    if (locale === 'en') {
      lines.push(`*${sectionIdx++}. Revenue (${activeSales.length} sales)*`);
      lines.push(`Total Revenue: *${formatFcfa(totalSales)}*`);
      lines.push(`- Cash: ${formatFcfa(cashTotal)}`);
      lines.push(`- Mobile Money: ${formatFcfa(momoTotal)}`);
      lines.push(`- Credit Sales: ${formatFcfa(creditTotal)}`);
    } else {
      lines.push(`*${sectionIdx++}. Chiffre d'affaires (${activeSales.length} ventes)*`);
      lines.push(`Total CA : *${formatFcfa(totalSales)}*`);
      lines.push(`- Espèces (Cash) : ${formatFcfa(cashTotal)}`);
      lines.push(`- Mobile Money (Wave/OM) : ${formatFcfa(momoTotal)}`);
      lines.push(`- Ventes à Crédit : ${formatFcfa(creditTotal)}`);
    }
  }

  if (prefs.includeTreasury || prefs.includeDebts) {
    lines.push('');
    if (locale === 'en') {
      lines.push(`*${sectionIdx++}. ${prefs.includeTreasury && prefs.includeDebts ? 'Cash & Receivables' : prefs.includeTreasury ? 'Available Treasury' : 'Receivables & Collections'}*`);
      if (prefs.includeTreasury) {
        lines.push(`Available Treasury: *${formatFcfa(treasuryAvailable)}*`);
      }
      if (prefs.includeDebts) {
        lines.push(`Debt Collections: ${formatFcfa(recoveredTotal)}`);
        lines.push(`Total Outstanding Debt: ${formatFcfa(totalOutstandingDebt)} (${overdueCount} overdue)`);
      }
    } else {
      lines.push(`*${sectionIdx++}. ${prefs.includeTreasury && prefs.includeDebts ? 'Trésorerie & Recouvrements' : prefs.includeTreasury ? 'Trésorerie Disponible' : 'Recouvrements & Dettes'}*`);
      if (prefs.includeTreasury) {
        lines.push(`Trésorerie disponible : *${formatFcfa(treasuryAvailable)}*`);
      }
      if (prefs.includeDebts) {
        lines.push(`Recouvrements dettes : ${formatFcfa(recoveredTotal)}`);
        lines.push(`Encours global dettes : ${formatFcfa(totalOutstandingDebt)} (${overdueCount} en retard)`);
      }
    }
  }

  if (prefs.includeStockAlerts) {
    lines.push('');
    if (locale === 'en') {
      lines.push(`*${sectionIdx++}. Critical Stock Alerts (${lowStockProducts.length})*`);
      if (lowStockProducts.length > 0) {
        lowStockProducts.forEach((p) => lines.push(`- ${p.name}: ${p.quantity} ${p.unit} (min ${p.minThreshold})`));
      } else {
        lines.push('- No critical stock alerts');
      }
    } else {
      lines.push(`*${sectionIdx++}. Alertes Stock Critique (${lowStockProducts.length})*`);
      if (lowStockProducts.length > 0) {
        lowStockProducts.forEach((p) => lines.push(`- ${p.name} : ${p.quantity} ${p.unit} (seuil ${p.minThreshold})`));
      } else {
        lines.push('- Aucun produit en seuil critique');
      }
    }
  }

  if (prefs.includePayroll) {
    lines.push('');
    if (locale === 'en') {
      lines.push(`*${sectionIdx++}. Workforce Payroll Accrued*`);
      lines.push(`Total Accrued: ${formatFcfa(payrollEngaged)} (${periodAttendance.length} logs)`);
    } else {
      lines.push(`*${sectionIdx++}. Masse Salariale Engagée*`);
      lines.push(`Total engagé : ${formatFcfa(payrollEngaged)} (${periodAttendance.length} pointages)`);
    }
  }

  if (sectionIdx === 1) {
    lines.push('');
    lines.push(locale === 'en' ? '_No report sections selected in organization settings._' : '_Aucune rubrique activée dans les paramètres de rapport._');
  }

  lines.push('');
  lines.push(locale === 'en' ? `_AgriKoom automated dispatch (${sendTime})_` : `_Rapport automatique AgriKoom (${sendTime})_`);

  return lines.join('\n');
}

export function buildDebtReminderMessage(org: Organization, debtor: Debtor, locale: 'fr' | 'en'): string {
  if (locale === 'en') {
    return `Hello ${debtor.fullName}, ${org.name} kindly reminds you of your remaining balance of ${formatFcfa(debtor.remainingFcfa)} (due date: ${debtor.dueDate}). Thank you for settling via Wave, Orange Money, or at the cooperative counter.`;
  }
  return `Bonjour ${debtor.fullName}, la coopérative ${org.name} vous rappelle aimablement votre solde restant de ${formatFcfa(debtor.remainingFcfa)} (échéance : ${debtor.dueDate}). Vous pouvez régler par Wave, Orange Money ou à la caisse de la coopérative. Merci pour votre confiance.`;
}

export function openWhatsAppUrl(phone: string | undefined, message: string): void {
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function csvCell(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadAccountingCsv(
  org: Organization,
  sales: Sale[],
  debtPayments: DebtPayment[],
  attendance: AttendanceRecord[] = [],
  cashClosings: CashClosing[] = []
): void {
  const header = [
    'Date',
    'Type',
    'Reference',
    'Libelle',
    'Operateur',
    'Cash_FCFA',
    'MobileMoney_FCFA',
    'Credit_FCFA',
    'Total_FCFA',
    'Statut',
  ];

  interface AccountingRow {
    sortKey: string;
    cells: string[];
  }

  const entries: AccountingRow[] = [];

  for (const s of sales) {
    entries.push({
      sortKey: s.createdAt,
      cells: [
        s.createdAt.slice(0, 19).replace('T', ' '),
        'VENTE_POS',
        s.id,
        s.debtorName ? `${s.itemsSummary} (Client: ${s.debtorName})` : s.itemsSummary,
        s.cashierName,
        String(s.cashFcfa),
        String(s.mobileMoneyFcfa),
        String(s.creditFcfa),
        String(s.totalFcfa),
        s.status === 'completed' ? 'validee' : 'annulee',
      ],
    });
  }

  for (const p of debtPayments) {
    entries.push({
      sortKey: p.createdAt,
      cells: [
        p.createdAt.slice(0, 19).replace('T', ' '),
        'RECOUVREMENT_DETTE',
        p.receiptRef,
        `Règlement ${p.debtorName} (${p.channel})`,
        p.recordedByName,
        p.channel === 'cash' ? String(p.amountFcfa) : '0',
        p.channel !== 'cash' ? String(p.amountFcfa) : '0',
        '0',
        String(p.amountFcfa),
        'validee',
      ],
    });
  }

  for (const a of attendance) {
    if (a.earnedFcfa <= 0 && a.advanceGivenFcfa <= 0) continue;
    const netPayroll = Math.max(0, a.earnedFcfa - a.advanceGivenFcfa);
    entries.push({
      sortKey: a.updatedAt || `${a.workDate}T18:00:00.000Z`,
      cells: [
        `${a.workDate} (${a.status})`,
        'PAIE_OUVRIER',
        a.id,
        `Pointage ${a.workerName} · Brut ${a.earnedFcfa} FCFA · Avance ${a.advanceGivenFcfa} FCFA`,
        a.recordedByUid,
        String(-a.earnedFcfa),
        '0',
        '0',
        String(-netPayroll),
        a.paidOut ? 'payee' : 'en_attente',
      ],
    });
  }

  for (const c of cashClosings) {
    entries.push({
      sortKey: c.createdAt,
      cells: [
        c.createdAt.slice(0, 19).replace('T', ' '),
        'CLOTURE_CAISSE',
        c.id,
        `Clôture ${c.closingDate} (Théorique ${c.theoreticalCashFcfa} · Compté ${c.countedCashFcfa} · Écart ${c.varianceFcfa})${c.note ? ` · ${c.note}` : ''}`,
        c.closedByName,
        String(c.countedCashFcfa),
        String(c.mobileMoneyTotalFcfa),
        String(c.creditTotalFcfa),
        String(c.countedCashFcfa + c.mobileMoneyTotalFcfa),
        c.varianceFcfa === 0 ? 'conforme' : 'ecart',
      ],
    });
  }

  entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const csvContent = [
    header.join(';'),
    ...entries.map((entry) => entry.cells.map(csvCell).join(';')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AgriKoom_${org.name.replace(/[^a-zA-Z0-9]/g, '_')}_Historique_Comptable.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
