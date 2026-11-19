import type {
  AttendanceRecord,
  CashClosing,
  Debtor,
  DebtPayment,
  Locale,
  Organization,
  Product,
  ProductCategory,
  Sale,
} from '../types/agrikoom';

export interface MonthlyPdfInput {
  org: Organization;
  monthIso: string; // YYYY-MM
  sales: Sale[];
  debtPayments: DebtPayment[];
  debtors: Debtor[];
  products: Product[];
  attendance: AttendanceRecord[];
  cashClosings: CashClosing[];
  locale: Locale;
}

const MONTH_NAMES_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const MONTH_NAMES_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function pdfText(value: string): string {
  return String(value ?? '')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...');
}

function fmtFcfa(amount: number): string {
  const rounded = Math.round(amount || 0);
  const abs = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${rounded < 0 ? '-' : ''}${abs} FCFA`;
}

function fmtShortFcfa(amount: number): string {
  const val = Math.round(amount || 0);
  if (Math.abs(val) >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (Math.abs(val) >= 1_000) {
    return `${Math.round(val / 1_000)}k`;
  }
  return String(val);
}

export function formatMonthLabel(monthIso: string, locale: Locale): string {
  const [yStr, mStr] = monthIso.split('-');
  const year = Number(yStr);
  const monthIdx = Number(mStr) - 1;
  if (!Number.isFinite(year) || monthIdx < 0 || monthIdx > 11) return monthIso;
  const names = locale === 'en' ? MONTH_NAMES_EN : MONTH_NAMES_FR;
  return `${names[monthIdx]} ${year}`;
}

function getDaysInMonth(monthIso: string): number {
  const [yStr, mStr] = monthIso.split('-');
  const year = Number(yStr) || new Date().getFullYear();
  const month = Number(mStr) || new Date().getMonth() + 1;
  return new Date(year, month, 0).getDate();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function renderDailyRevenueChartPng(params: {
  daysInMonth: number;
  dailySales: number[];
  dailyCollections: number[];
  locale: Locale;
}): string {
  const { daysInMonth, dailySales, dailyCollections, locale } = params;
  const width = 1360;
  const height = 460;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Outer subtle border
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 2, 2, width - 4, height - 4, 16);
  ctx.stroke();

  // Header & Legend
  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(
    locale === 'en'
      ? 'Daily Revenue & Debt Collections (FCFA)'
      : 'Évolution Journalière : Ventes POS & Recouvrements (FCFA)',
    32,
    46
  );

  // Legend
  const legendX = width - 450;
  ctx.fillStyle = '#2E7D32';
  ctx.fillRect(legendX, 28, 18, 18);
  ctx.fillStyle = '#334155';
  ctx.font = '600 18px sans-serif';
  ctx.fillText(locale === 'en' ? 'POS Sales' : 'Ventes POS', legendX + 26, 44);

  ctx.fillStyle = '#1A73E8';
  ctx.fillRect(legendX + 160, 28, 18, 18);
  ctx.fillStyle = '#334155';
  ctx.fillText(locale === 'en' ? 'Collections' : 'Recouvrements', legendX + 186, 44);

  const padL = 96;
  const padR = 32;
  const padT = 82;
  const padB = 58;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const combined = dailySales.map((v, i) => v + dailyCollections[i]);
  const rawMax = Math.max(...combined, 10000);
  const maxY = Math.ceil(rawMax / 5000) * 5000 || 10000;

  // Gridlines & Y labels
  const steps = 4;
  ctx.font = '500 16px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= steps; i++) {
    const val = (maxY / steps) * i;
    const y = padT + chartH - (val / maxY) * chartH;
    ctx.strokeStyle = i === 0 ? '#CBD5E1' : '#F1F5F9';
    ctx.lineWidth = i === 0 ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + chartW, y);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.fillText(fmtShortFcfa(val), padL - 12, y + 6);
  }

  // Stacked bars per day
  const slotW = chartW / daysInMonth;
  const barW = Math.max(10, Math.min(26, slotW * 0.62));
  ctx.textAlign = 'center';

  for (let d = 0; d < daysInMonth; d++) {
    const sVal = dailySales[d] || 0;
    const cVal = dailyCollections[d] || 0;
    const x = padL + d * slotW + (slotW - barW) / 2;

    const sH = (sVal / maxY) * chartH;
    const cH = (cVal / maxY) * chartH;

    if (sH > 0) {
      ctx.fillStyle = '#2E7D32';
      drawRoundedRect(ctx, x, padT + chartH - sH, barW, sH, cH > 0 ? 0 : 4);
      ctx.fill();
    }
    if (cH > 0) {
      ctx.fillStyle = '#1A73E8';
      drawRoundedRect(ctx, x, padT + chartH - sH - cH, barW, cH, 4);
      ctx.fill();
    }

    const dayNum = d + 1;
    if (dayNum === 1 || dayNum % 5 === 0 || dayNum === daysInMonth) {
      ctx.fillStyle = '#64748B';
      ctx.font = '500 16px sans-serif';
      ctx.fillText(String(dayNum).padStart(2, '0'), x + barW / 2, padT + chartH + 26);
    }
  }

  // Daily average line across active days
  const totalCombined = combined.reduce((sum, v) => sum + v, 0);
  const avg = totalCombined / daysInMonth;
  if (avg > 0) {
    const avgY = padT + chartH - (avg / maxY) * chartH;
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = '#FFB300';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(padL, avgY);
    ctx.lineTo(padL + chartW, avgY);
    ctx.stroke();
    ctx.restore();
  }

  return canvas.toDataURL('image/png');
}

function renderPaymentMixChartPng(params: {
  cashTotal: number;
  mobileMoneyTotal: number;
  creditTotal: number;
  collectionsTotal: number;
  locale: Locale;
}): string {
  const { cashTotal, mobileMoneyTotal, creditTotal, collectionsTotal, locale } = params;
  const width = 660;
  const height = 380;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 2, 2, width - 4, height - 4, 16);
  ctx.stroke();

  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(
    locale === 'en' ? 'Revenue & Collections by Channel' : 'Répartition par Canal de Paiement',
    26,
    42
  );

  const items = [
    {
      label: locale === 'en' ? 'Cash (POS)' : 'Espèces (POS)',
      value: cashTotal,
      color: '#2E7D32',
    },
    {
      label: 'Mobile Money (Wave / OM)',
      value: mobileMoneyTotal,
      color: '#1A73E8',
    },
    {
      label: locale === 'en' ? 'Credit Granted' : 'Crédit Accordé',
      value: creditTotal,
      color: '#FFB300',
    },
    {
      label: locale === 'en' ? 'Debt Collections' : 'Recouvrements Dettes',
      value: collectionsTotal,
      color: '#0D9488',
    },
  ];

  const maxVal = Math.max(...items.map((i) => i.value), 1);
  const startY = 82;
  const rowH = 70;
  const barMaxW = width - 56;

  items.forEach((item, idx) => {
    const y = startY + idx * rowH;
    ctx.fillStyle = '#334155';
    ctx.font = '600 17px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.label, 28, y + 18);

    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(fmtFcfa(item.value), width - 28, y + 18);

    // Track
    ctx.fillStyle = '#F1F5F9';
    drawRoundedRect(ctx, 28, y + 28, barMaxW, 20, 8);
    ctx.fill();

    // Fill
    const w = Math.max(item.value > 0 ? 12 : 0, (item.value / maxVal) * barMaxW);
    if (w > 0) {
      ctx.fillStyle = item.color;
      drawRoundedRect(ctx, 28, y + 28, w, 20, 8);
      ctx.fill();
    }
  });

  return canvas.toDataURL('image/png');
}

function renderStockCategoryChartPng(params: {
  products: Product[];
  locale: Locale;
}): string {
  const { products, locale } = params;
  const width = 660;
  const height = 380;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 2, 2, width - 4, height - 4, 16);
  ctx.stroke();

  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(
    locale === 'en' ? 'Stock Volume & Value by Category' : 'Volume de Stock par Catégorie',
    26,
    42
  );

  const categories: Array<{ key: ProductCategory; label: string; color: string }> = [
    { key: 'intrants', label: locale === 'en' ? 'Inputs (Intrants)' : 'Intrants agricoles', color: '#2E7D32' },
    { key: 'provende', label: locale === 'en' ? 'Feed (Provende)' : 'Provende & Aliments', color: '#1A73E8' },
    { key: 'recoltes', label: locale === 'en' ? 'Harvests (Récoltes)' : 'Récoltes & Productions', color: '#D97706' },
    { key: 'emballages', label: locale === 'en' ? 'Packaging' : 'Emballages & Sacs', color: '#64748B' },
  ];

  const rows = categories.map((c) => {
    const matching = products.filter((p) => p.category === c.key);
    const totalQty = matching.reduce((s, p) => s + p.quantity, 0);
    const totalValue = matching.reduce((s, p) => s + p.quantity * p.unitPriceFcfa, 0);
    const critical = matching.filter((p) => p.quantity <= p.minThreshold).length;
    return { ...c, totalQty, totalValue, count: matching.length, critical };
  });

  const maxQty = Math.max(...rows.map((r) => r.totalQty), 1);
  const startY = 82;
  const rowH = 70;
  const barMaxW = width - 56;

  rows.forEach((row, idx) => {
    const y = startY + idx * rowH;
    ctx.fillStyle = '#334155';
    ctx.font = '600 17px sans-serif';
    ctx.textAlign = 'left';
    const critBadge = row.critical > 0 ? ` (${row.critical} alerte)` : '';
    ctx.fillText(`${row.label}${critBadge}`, 28, y + 18);

    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(row.totalQty)} u · ${fmtShortFcfa(row.totalValue)} FCFA`, width - 28, y + 18);

    ctx.fillStyle = '#F1F5F9';
    drawRoundedRect(ctx, 28, y + 28, barMaxW, 20, 8);
    ctx.fill();

    const w = Math.max(row.totalQty > 0 ? 12 : 0, (row.totalQty / maxQty) * barMaxW);
    if (w > 0) {
      ctx.fillStyle = row.color;
      drawRoundedRect(ctx, 28, y + 28, w, 20, 8);
      ctx.fill();
    }
  });

  return canvas.toDataURL('image/png');
}

function renderAttendanceChartPng(params: {
  daysInMonth: number;
  dailyCheckins: number[];
  locale: Locale;
}): string {
  const { daysInMonth, dailyCheckins, locale } = params;
  const width = 1360;
  const height = 360;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 2, 2, width - 4, height - 4, 16);
  ctx.stroke();

  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    locale === 'en'
      ? 'Monthly Workforce Attendance (Daily Check-ins)'
      : 'Fréquentation Journalière des Ouvriers (Pointages actifs)',
    32,
    42
  );

  const maxCount = Math.max(...dailyCheckins, 4);
  const peakVal = Math.max(...dailyCheckins, 0);

  const padL = 72;
  const padR = 32;
  const padT = 72;
  const padB = 52;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const ySteps = Math.min(4, maxCount);
  ctx.font = '500 15px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= ySteps; i++) {
    const val = Math.round((maxCount / ySteps) * i);
    const y = padT + chartH - (val / maxCount) * chartH;
    ctx.strokeStyle = i === 0 ? '#CBD5E1' : '#F1F5F9';
    ctx.lineWidth = i === 0 ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + chartW, y);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.fillText(String(val), padL - 12, y + 5);
  }

  const slotW = chartW / daysInMonth;
  const barW = Math.max(10, Math.min(26, slotW * 0.6));
  ctx.textAlign = 'center';

  for (let d = 0; d < daysInMonth; d++) {
    const count = dailyCheckins[d] || 0;
    const x = padL + d * slotW + (slotW - barW) / 2;
    const h = (count / maxCount) * chartH;

    if (h > 0) {
      ctx.fillStyle = count === peakVal && peakVal > 0 ? '#FFB300' : '#1A73E8';
      drawRoundedRect(ctx, x, padT + chartH - h, barW, h, 4);
      ctx.fill();
    }

    const dayNum = d + 1;
    if (dayNum === 1 || dayNum % 5 === 0 || dayNum === daysInMonth) {
      ctx.fillStyle = '#64748B';
      ctx.font = '500 15px sans-serif';
      ctx.fillText(String(dayNum).padStart(2, '0'), x + barW / 2, padT + chartH + 24);
    }
  }

  // Peak legend on right
  ctx.textAlign = 'right';
  ctx.font = '600 16px sans-serif';
  ctx.fillStyle = '#B45309';
  ctx.fillText(
    peakVal > 0
      ? `${locale === 'en' ? 'Peak day' : 'Pic journalier'} : ${peakVal} ${locale === 'en' ? 'workers' : 'ouvriers'}`
      : locale === 'en'
        ? 'No attendance recorded'
        : 'Aucun pointage ce mois',
    width - 32,
    42
  );

  return canvas.toDataURL('image/png');
}

export async function generateMonthlyPerformancePdf(input: MonthlyPdfInput): Promise<{
  fileName: string;
  monthLabel: string;
  salesCount: number;
  revenueFcfa: number;
}> {
  const { jsPDF } = await import('jspdf');
  const { org, monthIso, sales, debtPayments, debtors, products, attendance, cashClosings, locale } = input;
  const daysInMonth = getDaysInMonth(monthIso);
  const monthLabel = formatMonthLabel(monthIso, locale);

  // Filter month-scoped records
  const monthSales = sales.filter(
    (s) => s.status === 'completed' && s.createdAt.slice(0, 7) === monthIso
  );
  const monthPayments = debtPayments.filter((p) => p.createdAt.slice(0, 7) === monthIso);
  const monthAttendance = attendance.filter((a) => a.workDate.slice(0, 7) === monthIso);
  const monthClosings = cashClosings.filter((c) => c.closingDate.slice(0, 7) === monthIso);

  // KPIs
  const totalRevenue = monthSales.reduce((s, item) => s + item.totalFcfa, 0);
  const cashTotal = monthSales.reduce((s, item) => s + item.cashFcfa, 0);
  const mobileMoneyTotal = monthSales.reduce((s, item) => s + item.mobileMoneyFcfa, 0);
  const creditTotal = monthSales.reduce((s, item) => s + item.creditFcfa, 0);
  const collectionsTotal = monthPayments.reduce((s, item) => s + item.amountFcfa, 0);
  const treasuryTotal = cashTotal + mobileMoneyTotal + collectionsTotal;

  const totalOutstandingDebt = debtors.reduce((s, d) => s + d.remainingFcfa, 0);
  const overdueDebtors = debtors.filter((d) => d.status === 'en_retard');
  const activeDebtors = debtors
    .filter((d) => d.remainingFcfa > 0)
    .sort((a, b) => b.remainingFcfa - a.remainingFcfa);

  const criticalProducts = products
    .filter((p) => p.quantity <= p.minThreshold)
    .sort((a, b) => a.quantity - a.minThreshold - (b.quantity - b.minThreshold));
  const stockValuation = products.reduce((s, p) => s + p.quantity * p.unitPriceFcfa, 0);

  const totalPayroll = monthAttendance.reduce((s, a) => s + a.earnedFcfa, 0);
  const totalAdvances = monthAttendance.reduce((s, a) => s + a.advanceGivenFcfa, 0);
  const activeAttendanceLogs = monthAttendance.filter((a) => a.status !== 'absent');

  // Daily arrays (1..daysInMonth)
  const dailySales = new Array<number>(daysInMonth).fill(0);
  const dailyCollections = new Array<number>(daysInMonth).fill(0);
  const dailyCheckins = new Array<number>(daysInMonth).fill(0);

  for (const s of monthSales) {
    const day = Number(s.createdAt.slice(8, 10));
    if (day >= 1 && day <= daysInMonth) dailySales[day - 1] += s.totalFcfa;
  }
  for (const p of monthPayments) {
    const day = Number(p.createdAt.slice(8, 10));
    if (day >= 1 && day <= daysInMonth) dailyCollections[day - 1] += p.amountFcfa;
  }
  for (const a of activeAttendanceLogs) {
    const day = Number(a.workDate.slice(8, 10));
    if (day >= 1 && day <= daysInMonth) dailyCheckins[day - 1] += 1;
  }

  // Render high-DPI PNG charts
  const dailyRevenuePng = renderDailyRevenueChartPng({
    daysInMonth,
    dailySales,
    dailyCollections,
    locale,
  });
  const paymentMixPng = renderPaymentMixChartPng({
    cashTotal,
    mobileMoneyTotal,
    creditTotal,
    collectionsTotal,
    locale,
  });
  const stockCategoryPng = renderStockCategoryChartPng({ products, locale });
  const attendancePng = renderAttendanceChartPng({
    daysInMonth,
    dailyCheckins,
    locale,
  });

  // Create A4 Portrait PDF
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 12;
  const contentW = pageW - margin * 2;

  // ---------- PAGE 1 ----------
  // Top dark banner
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, 30, 'F');
  doc.setFillColor(46, 125, 50);
  doc.rect(0, 30, pageW, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(pdfText(`AGRIKOOM - ${org.name.toUpperCase()}`), margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    pdfText(
      locale === 'en'
        ? `Monthly Performance & Financial Report · ${monthLabel}`
        : `Rapport Mensuel de Performance & Synthèse Financière · ${monthLabel}`
    ),
    margin,
    19
  );
  doc.setFontSize(8.5);
  const generatedStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
  doc.text(
    pdfText(`${org.region} · ${org.orgType.toUpperCase()} · Généré le ${generatedStr}`),
    margin,
    25.5
  );

  // KPI Grid (4 cards)
  const kpiY = 38;
  const gap = 3;
  const cardW = (contentW - gap * 3) / 4;
  const cardH = 24;
  const avgSale = monthSales.length > 0 ? Math.round(totalRevenue / monthSales.length) : 0;

  const kpis = [
    {
      title: locale === 'en' ? 'Monthly Revenue' : "Chiffre d'affaires",
      value: fmtFcfa(totalRevenue),
      sub: `${monthSales.length} ventes · moy. ${fmtShortFcfa(avgSale)}`,
      accent: [46, 125, 50] as const,
    },
    {
      title: locale === 'en' ? 'Cash Collected' : 'Trésorerie encaissée',
      value: fmtFcfa(treasuryTotal),
      sub: `Recouvré : ${fmtShortFcfa(collectionsTotal)} FCFA`,
      accent: [26, 115, 232] as const,
    },
    {
      title: locale === 'en' ? 'Outstanding Debt' : 'Encours dettes clients',
      value: fmtFcfa(totalOutstandingDebt),
      sub: `${overdueDebtors.length} échéance(s) en retard`,
      accent: [217, 119, 6] as const,
    },
    {
      title: locale === 'en' ? 'Payroll & Stock' : 'Paie & Alertes Stock',
      value: fmtFcfa(totalPayroll),
      sub: `${activeAttendanceLogs.length} pointages · ${criticalProducts.length} alertes`,
      accent: [100, 116, 139] as const,
    },
  ];

  kpis.forEach((k, idx) => {
    const x = margin + idx * (cardW + gap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, kpiY, cardW, cardH, 2.5, 2.5, 'FD');

    doc.setFillColor(k.accent[0], k.accent[1], k.accent[2]);
    doc.rect(x, kpiY + 2, 1.4, cardH - 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfText(k.title), x + 3.5, kpiY + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59);
    doc.text(pdfText(k.value), x + 3.5, kpiY + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(pdfText(k.sub), x + 3.5, kpiY + 20);
  });

  // Chart 1: Daily Revenue & Collections
  let cursorY = 68;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    pdfText(
      locale === 'en'
        ? '1. Monthly Sales & Collections Curve'
        : '1. Performances Commerciales & Recouvrements du Mois'
    ),
    margin,
    cursorY
  );
  cursorY += 3;

  if (dailyRevenuePng) {
    const chartH = (contentW * 460) / 1360;
    doc.addImage(dailyRevenuePng, 'PNG', margin, cursorY, contentW, chartH);
    cursorY += chartH + 7;
  }

  // Chart 2 & 3 side-by-side
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    pdfText(
      locale === 'en'
        ? '2. Payment Channels & Inventory Breakdown'
        : '2. Canaux de Paiement & Structure du Stock'
    ),
    margin,
    cursorY
  );
  cursorY += 3;

  const halfW = (contentW - 4) / 2;
  const halfH = (halfW * 380) / 660;
  if (paymentMixPng) {
    doc.addImage(paymentMixPng, 'PNG', margin, cursorY, halfW, halfH);
  }
  if (stockCategoryPng) {
    doc.addImage(stockCategoryPng, 'PNG', margin + halfW + 4, cursorY, halfW, halfH);
  }
  cursorY += halfH + 8;

  // Quick monthly stock valuation & cash closings bar on page 1 bottom
  const totalClosingTheory = monthClosings.reduce((s, c) => s + c.theoreticalCashFcfa, 0);
  const totalClosingCounted = monthClosings.reduce((s, c) => s + c.countedCashFcfa, 0);
  const totalVariance = monthClosings.reduce((s, c) => s + c.varianceFcfa, 0);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, cursorY, contentW, 20, 2.5, 2.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(pdfText('Synthèse Patrimoine & Clôtures de Caisse du Mois'), margin + 4, cursorY + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfText(
      `Valorisation stock actuel : ${fmtFcfa(stockValuation)} (${products.length} références)  ·  Avances salaires : ${fmtFcfa(totalAdvances)}`
    ),
    margin + 4,
    cursorY + 12
  );
  doc.text(
    pdfText(
      `Clôtures caisse du mois : ${monthClosings.length}  ·  Théorique : ${fmtFcfa(totalClosingTheory)}  ·  Compté : ${fmtFcfa(totalClosingCounted)}  ·  Écart : ${fmtFcfa(totalVariance)}`
    ),
    margin + 4,
    cursorY + 17
  );

  // Page 1 footer
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(pdfText(`AgriKoom ERP · ${org.name} · ${monthLabel}`), margin, 289);
  doc.text('Page 1 / 2', pageW - margin, 289, { align: 'right' });

  // ---------- PAGE 2 ----------
  doc.addPage();
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, 18, 'F');
  doc.setFillColor(26, 115, 232);
  doc.rect(0, 18, pageW, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(pdfText(`AGRIKOOM · ${org.name.toUpperCase()} — DÉTAILS OPÉRATIONNELS`), margin, 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(pdfText(monthLabel), pageW - margin, 11.5, { align: 'right' });

  // Chart 4: Workforce attendance
  let p2Y = 27;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    pdfText(
      locale === 'en'
        ? '3. Monthly Workforce Attendance & Payroll Activity'
        : '3. Activité Main-d’Œuvre & Fréquentation Journalière'
    ),
    margin,
    p2Y
  );
  p2Y += 3;

  if (attendancePng) {
    const attH = (contentW * 360) / 1360;
    doc.addImage(attendancePng, 'PNG', margin, p2Y, contentW, attH);
    p2Y += attH + 8;
  }

  // Table 1: Critical stock alerts
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    pdfText(`4. Alertes Stock Seuil Critique (${criticalProducts.length} / ${products.length} articles)`),
    margin,
    p2Y
  );
  p2Y += 4;

  if (criticalProducts.length === 0) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(margin, p2Y, contentW, 11, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(22, 101, 52);
    doc.text(pdfText('Tous les niveaux de stock sont nominaux (aucun article sous le seuil critique).'), margin + 4, p2Y + 7);
    p2Y += 17;
  } else {
    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, p2Y, contentW, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text('Produit', margin + 3, p2Y + 5);
    doc.text('Catégorie', margin + 72, p2Y + 5);
    doc.text('Stock Actuel', margin + 108, p2Y + 5);
    doc.text('Seuil Min', margin + 138, p2Y + 5);
    doc.text('Statut', margin + 164, p2Y + 5);
    p2Y += 7.5;

    const topCrit = criticalProducts.slice(0, 8);
    topCrit.forEach((p, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, p2Y, contentW, 6.8, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(pdfText(p.name.slice(0, 34)), margin + 3, p2Y + 4.8);
      doc.text(pdfText(p.category), margin + 72, p2Y + 4.8);
      doc.text(pdfText(`${p.quantity} ${p.unit}`), margin + 108, p2Y + 4.8);
      doc.text(pdfText(`${p.minThreshold} ${p.unit}`), margin + 138, p2Y + 4.8);
      doc.setTextColor(p.quantity <= 0 ? 211 : 180, p.quantity <= 0 ? 47 : 83, p.quantity <= 0 ? 47 : 9);
      doc.setFont('helvetica', 'bold');
      doc.text(p.quantity <= 0 ? 'RUPTURE' : 'ALERTE', margin + 164, p2Y + 4.8);
      p2Y += 6.8;
    });
    p2Y += 7;
  }

  // Table 2: Outstanding debtors
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    pdfText(`5. État des Créances Clients Ouvertes (${activeDebtors.length} comptes)`),
    margin,
    p2Y
  );
  p2Y += 4;

  if (activeDebtors.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, p2Y, contentW, 11, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(pdfText('Aucune créance client en cours à la date du rapport.'), margin + 4, p2Y + 7);
    p2Y += 16;
  } else {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, p2Y, contentW, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text('Client / Membre', margin + 3, p2Y + 5);
    doc.text('Zone', margin + 68, p2Y + 5);
    doc.text('Échéance', margin + 104, p2Y + 5);
    doc.text('Reste Dû', margin + 136, p2Y + 5);
    doc.text('Statut', margin + 168, p2Y + 5);
    p2Y += 7.5;

    activeDebtors.slice(0, 8).forEach((d, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, p2Y, contentW, 6.8, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(pdfText(d.fullName.slice(0, 32)), margin + 3, p2Y + 4.8);
      doc.text(pdfText((d.zone || '-').slice(0, 18)), margin + 68, p2Y + 4.8);
      doc.text(pdfText(d.dueDate), margin + 104, p2Y + 4.8);
      doc.setFont('helvetica', 'bold');
      doc.text(pdfText(fmtFcfa(d.remainingFcfa)), margin + 136, p2Y + 4.8);
      doc.setTextColor(d.status === 'en_retard' ? 211 : 26, d.status === 'en_retard' ? 47 : 115, d.status === 'en_retard' ? 47 : 232);
      doc.text(
        d.status === 'en_retard' ? 'EN RETARD' : d.status === 'partiel' ? 'PARTIEL' : 'EN COURS',
        margin + 168,
        p2Y + 4.8
      );
      p2Y += 6.8;
    });
  }

  // Page 2 footer
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(pdfText(`AgriKoom ERP · ${org.name} · ${monthLabel}`), margin, 289);
  doc.text('Page 2 / 2', pageW - margin, 289, { align: 'right' });

  const safeOrg = org.name.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `AgriKoom_${safeOrg}_Rapport_Mensuel_${monthIso}.pdf`;
  doc.save(fileName);

  return {
    fileName,
    monthLabel,
    salesCount: monthSales.length,
    revenueFcfa: totalRevenue,
  };
}
