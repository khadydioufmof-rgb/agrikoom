import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageCircle,
  Plus,
  Receipt,
  Search,
  Wallet,
} from 'lucide-react';
import { formatFcfa } from '../i18n/translations';
import { buildDebtReminderMessage, openWhatsAppUrl } from '../lib/whatsapp';
import type {
  Debtor,
  DebtorStatus,
  DebtPayment,
  Locale,
  Organization,
  PaymentChannel,
  UserRole,
} from '../types/agrikoom';

interface DebtsViewProps {
  org: Organization;
  role: UserRole;
  locale: Locale;
  debtors: Debtor[];
  debtPayments: DebtPayment[];
  initialStatusFilter?: 'all' | DebtorStatus;
  onStatusFilterChange?: (status: 'all' | DebtorStatus) => void;
  onCreateDebtor: (input: { fullName: string; phone: string; zone: string; initialCreditFcfa: number; dueDate: string }) => Promise<void>;
  onRecordPayment: (params: { debtor: Debtor; amountFcfa: number; channel: PaymentChannel }) => Promise<DebtPayment>;
}

export const DebtsView: React.FC<DebtsViewProps> = ({
  org,
  role,
  locale,
  debtors,
  debtPayments,
  initialStatusFilter = 'all',
  onStatusFilterChange,
  onCreateDebtor,
  onRecordPayment,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | DebtorStatus>(initialStatusFilter);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<Debtor | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<DebtPayment | null>(null);

  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  const handleSelectStatusFilter = (next: 'all' | DebtorStatus) => {
    setStatusFilter(next);
    onStatusFilterChange?.(next);
  };

  // Add Debtor fields
  const [dName, setDName] = useState('');
  const [dPhone, setDPhone] = useState('+221 77 ');
  const [dZone, setDZone] = useState('');
  const [dAmount, setDAmount] = useState('0');
  const [dDue, setDDue] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));

  // Payment fields
  const [payAmount, setPayAmount] = useState('');
  const [payChannel, setPayChannel] = useState<PaymentChannel>('wave');

  const filtered = useMemo(() => {
    return debtors.filter((d) => {
      const matchStatus = statusFilter === 'all' || d.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch =
        d.fullName.toLowerCase().includes(q) ||
        d.zone.toLowerCase().includes(q) ||
        d.phone.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [debtors, statusFilter, search]);

  const totalRemaining = debtors.reduce((s, d) => s + d.remainingFcfa, 0);
  const totalRecovered = debtors.reduce((s, d) => s + d.totalPaidFcfa, 0);
  const overdueCount = debtors.filter((d) => d.status === 'en_retard').length;

  const statusBadge = (st: DebtorStatus) => {
    if (st === 'solde') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E7D32]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Soldé
        </span>
      );
    }
    if (st === 'en_retard') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#D32F2F]">
          <AlertCircle className="h-3.5 w-3.5" />
          En retard
        </span>
      );
    }
    if (st === 'partiel') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B45309]">
          <Clock className="h-3.5 w-3.5" />
          Partiellement payé
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A73E8]">
        <Clock className="h-3.5 w-3.5" />
        En cours
      </span>
    );
  };

  const handleAddDebtor = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateDebtor({
      fullName: dName.trim(),
      phone: dPhone.trim(),
      zone: dZone.trim(),
      initialCreditFcfa: Math.max(0, Number(dAmount || 0)),
      dueDate: dDue,
    });
    setShowAddModal(false);
    setDName('');
    setDZone('');
    setDAmount('0');
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTarget) return;
    const amt = Math.min(paymentTarget.remainingFcfa, Math.max(1, Number(payAmount || 0)));
    const receipt = await onRecordPayment({
      debtor: paymentTarget,
      amountFcfa: amt,
      channel: payChannel,
    });
    setPaymentTarget(null);
    setReceiptPreview(receipt);
  };

  if (role === 'pointer') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="font-display text-lg font-bold text-[#1E293B]">Accès Cahier de Dettes restreint</p>
        <p className="mt-2 text-sm text-slate-600">
          Ce module est réservé au Gérant / Caissier et au Président / Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1E293B]">Cahier de Dettes &amp; Recouvrement</h1>
          <p className="text-xs text-slate-500">
            Suivi transparent des crédits membres/clients, acomptes horodatés et relances WhatsApp en 1 clic
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2E7D32] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#256428] min-h-[48px] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Nouvelle fiche débiteur</span>
        </button>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-medium text-slate-500">Encours total à recouvrer</span>
          <p className="mt-1.5 font-mono-num text-2xl font-bold text-[#B45309]">{formatFcfa(totalRemaining)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-medium text-slate-500">Total recouvré cumulé</span>
          <p className="mt-1.5 font-mono-num text-2xl font-bold text-[#2E7D32]">{formatFcfa(totalRecovered)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-medium text-slate-500">Dossiers en retard</span>
          <p className="mt-1.5 font-mono-num text-2xl font-bold text-[#D32F2F]">{overdueCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(
            [
              ['all', 'Tous'],
              ['en_retard', 'En retard'],
              ['en_cours', 'En cours'],
              ['partiel', 'Partiel'],
              ['solde', 'Soldé'],
            ] as const
          ).map(([st, lbl]) => (
            <button
              key={st}
              type="button"
              onClick={() => handleSelectStatusFilter(st)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 min-h-[40px] ${
                statusFilter === st
                  ? 'bg-[#2E7D32] text-white'
                  : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, téléphone, village..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm min-h-[42px]"
          />
        </div>
      </div>

      {/* Debtors List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((d) => (
          <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-[#1E293B]">{d.fullName}</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {d.phone} · {d.zone} · Échéance : <span className="font-mono-num">{d.dueDate}</span>
                </p>
              </div>
              {statusBadge(d.status)}
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
              <div>
                <span className="text-slate-500 block">Crédit initial</span>
                <span className="font-mono-num font-semibold text-[#1E293B]">{formatFcfa(d.totalCreditFcfa)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Déjà versé</span>
                <span className="font-mono-num font-semibold text-[#2E7D32]">{formatFcfa(d.totalPaidFcfa)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Reste dû</span>
                <span className="font-mono-num font-bold text-[#D32F2F]">{formatFcfa(d.remainingFcfa)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {d.remainingFcfa > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentTarget(d);
                      setPayAmount(String(d.remainingFcfa));
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2E7D32] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#256428] min-h-[44px]"
                  >
                    <Wallet className="h-4 w-4" />
                    <span>Encaisser acompte</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openWhatsAppUrl(d.phone, buildDebtReminderMessage(org, d, locale))}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2E7D32]/40 bg-[#2E7D32]/10 px-3.5 py-2.5 text-xs font-semibold text-[#2E7D32] hover:bg-[#2E7D32]/15 min-h-[44px]"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Relance WhatsApp</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Installment Receipts */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-display text-base font-bold text-[#1E293B]">Historique des Règlements &amp; Reçus</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {debtPayments.slice(0, 10).map((p) => (
            <div key={p.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#1E293B]">
                  {p.debtorName} · <span className="font-mono-num text-xs text-slate-500">{p.receiptRef}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Canal : {p.channel.toUpperCase()} · Encaissé par {p.recordedByName} ({p.createdAt.slice(0, 16).replace('T', ' ')})
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono-num text-sm font-bold text-[#2E7D32]">+{formatFcfa(p.amountFcfa)}</span>
                <button
                  type="button"
                  onClick={() => setReceiptPreview(p)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-[#1E293B] hover:bg-slate-50"
                >
                  <Receipt className="h-3.5 w-3.5 text-[#1A73E8]" />
                  <span>Reçu</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Add Debtor */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <form onSubmit={handleAddDebtor} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl">
            <h3 className="font-display text-lg font-bold text-[#1E293B]">Nouvelle fiche débiteur</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nom &amp; Prénom</label>
                <input required value={dName} onChange={(e) => setDName(e.target.value)} placeholder="Ex: Moussa Ndiaye" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Téléphone WhatsApp</label>
                  <input required value={dPhone} onChange={(e) => setDPhone(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Village / Zone</label>
                  <input required value={dZone} onChange={(e) => setDZone(e.target.value)} placeholder="Ex: Mboro" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Montant crédit initial (FCFA)</label>
                  <input type="number" min={0} required value={dAmount} onChange={(e) => setDAmount(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono-num text-sm min-h-[44px]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date d&apos;échéance</label>
                  <input type="date" required value={dDue} onChange={(e) => setDDue(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold min-h-[48px]">Annuler</button>
              <button type="submit" className="flex-1 rounded-xl bg-[#2E7D32] py-2.5 text-sm font-semibold text-white min-h-[48px]">Enregistrer</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Record Payment */}
      {paymentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <form onSubmit={handleConfirmPayment} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl">
            <h3 className="font-display text-lg font-bold text-[#1E293B]">Règlement : {paymentTarget.fullName}</h3>
            <p className="text-xs text-slate-500">
              Reste dû actuel : <span className="font-mono-num font-bold text-[#D32F2F]">{formatFcfa(paymentTarget.remainingFcfa)}</span>
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Montant versé (FCFA)</label>
              <input
                type="number"
                min={1}
                max={paymentTarget.remainingFcfa}
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono-num text-base font-bold min-h-[48px]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Canal d&apos;encaissement</label>
              <select value={payChannel} onChange={(e) => setPayChannel(e.target.value as PaymentChannel)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm min-h-[44px]">
                <option value="wave">Wave</option>
                <option value="orange_money">Orange Money</option>
                <option value="free_money">Free Money</option>
                <option value="cash">Espèces (Cash)</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setPaymentTarget(null)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold min-h-[48px]">Annuler</button>
              <button type="submit" className="flex-1 rounded-xl bg-[#2E7D32] py-2.5 text-sm font-semibold text-white min-h-[48px]">Générer le reçu</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Digital Receipt */}
      {receiptPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl">
            <div className="text-center border-b border-dashed border-slate-300 pb-4">
              <p className="font-display text-base font-bold text-[#2E7D32]">{org.name}</p>
              <p className="text-xs text-slate-500">Reçu Numérique de Recouvrement</p>
              <p className="mt-1 font-mono-num text-xs font-bold text-[#1E293B]">{receiptPreview.receiptRef}</p>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Client / Membre :</span>
                <span className="font-semibold text-[#1E293B]">{receiptPreview.debtorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Montant réglé :</span>
                <span className="font-mono-num font-bold text-[#2E7D32]">{formatFcfa(receiptPreview.amountFcfa)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Canal :</span>
                <span className="font-semibold uppercase">{receiptPreview.channel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date &amp; Heure :</span>
                <span className="font-mono-num">{receiptPreview.createdAt.slice(0, 16).replace('T', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reçu par :</span>
                <span>{receiptPreview.recordedByName}</span>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const debtorObj = debtors.find((x) => x.id === receiptPreview.debtorId);
                  const msg = `Reçu ${receiptPreview.receiptRef} — ${org.name} : Paiement de ${formatFcfa(receiptPreview.amountFcfa)} reçu le ${receiptPreview.createdAt.slice(0, 10)}. Merci ${receiptPreview.debtorName} !`;
                  openWhatsAppUrl(debtorObj?.phone, msg);
                }}
                className="flex-1 rounded-xl bg-[#2E7D32] py-2.5 text-xs font-semibold text-white min-h-[44px]"
              >
                Envoyer sur WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setReceiptPreview(null)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 min-h-[44px]"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
