import React, { useMemo, useState } from 'react';
import {
  Ban,
  Calculator,
  CheckCircle2,
  Link2,
  Minus,
  Plus,
  ScanBarcode,
  Search,
  ShoppingBag,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { BarcodeScannerModal, type BarcodeScanOutcome } from './BarcodeScannerModal';
import { formatFcfa } from '../i18n/translations';
import type {
  Debtor,
  MobileMoneyProvider,
  Organization,
  Product,
  ProductCategory,
  Sale,
  UserRole,
} from '../types/agrikoom';

interface CartItem {
  product: Product;
  qty: number;
}

interface PosViewProps {
  org: Organization;
  role: UserRole;
  actorUid: string;
  actorName: string;
  products: Product[];
  sales: Sale[];
  debtors: Debtor[];
  onRecordSale: (params: {
    items: Array<{ product: Product; qty: number }>;
    discountFcfa: number;
    cashFcfa: number;
    mobileMoneyFcfa: number;
    mobileMoneyProvider: MobileMoneyProvider;
    creditFcfa: number;
    debtorId?: string;
    debtorName?: string;
    newDebtor?: { fullName: string; phone: string; zone: string };
  }) => Promise<void>;
  onCancelSale: (sale: Sale) => Promise<void>;
  onCloseRegister: (params: {
    theoreticalCashFcfa: number;
    countedCashFcfa: number;
    mobileMoneyTotalFcfa: number;
    creditTotalFcfa: number;
    note: string;
  }) => Promise<void>;
  onAssignBarcode?: (product: Product, barcode: string) => Promise<void>;
}

export const PosView: React.FC<PosViewProps> = ({
  role,
  products,
  sales,
  debtors,
  onRecordSale,
  onCancelSale,
  onCloseRegister,
  onAssignBarcode,
}) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | ProductCategory>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountFcfa, setDiscountFcfa] = useState(0);

  // Camera barcode scanner & quick-link state
  const [showScanner, setShowScanner] = useState(false);
  const [unmatchedBarcode, setUnmatchedBarcode] = useState<string | null>(null);
  const [assignTargetId, setAssignTargetId] = useState<string>(products[0]?.id || '');
  const [assigningBarcode, setAssigningBarcode] = useState(false);

  // Payment channels (supports Pure Cash, Pure Mobile Money, Pure Credit, or Mixed)
  const [payMode, setPayMode] = useState<'cash' | 'momo' | 'credit' | 'mixed'>('cash');
  const [momoProvider, setMomoProvider] = useState<MobileMoneyProvider>('wave');
  const [mixedCash, setMixedCash] = useState(0);
  const [mixedMomo, setMixedMomo] = useState(0);

  // Debtor binding for credit sales
  const [selectedDebtorId, setSelectedDebtorId] = useState<string>(debtors[0]?.id || '');
  const [creatingDebtor, setCreatingDebtor] = useState(false);
  const [newDebName, setNewDebName] = useState('');
  const [newDebPhone, setNewDebPhone] = useState('+221 77 ');
  const [newDebZone, setNewDebZone] = useState('');

  // Closing Register modal
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('');
  const [closingNote, setClosingNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat = category === 'all' || p.category === category;
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, category, search]);

  const subtotal = cart.reduce((sum, item) => sum + item.product.unitPriceFcfa * item.qty, 0);
  const total = Math.max(0, subtotal - discountFcfa);

  const computedSplit = useMemo(() => {
    if (payMode === 'cash') {
      return { cash: total, momo: 0, credit: 0, provider: 'none' as MobileMoneyProvider };
    }
    if (payMode === 'momo') {
      return { cash: 0, momo: total, credit: 0, provider: momoProvider };
    }
    if (payMode === 'credit') {
      return { cash: 0, momo: 0, credit: total, provider: 'none' as MobileMoneyProvider };
    }
    const c = Math.min(total, Math.max(0, mixedCash));
    const m = Math.min(total - c, Math.max(0, mixedMomo));
    const cr = Math.max(0, total - c - m);
    return {
      cash: c,
      momo: m,
      credit: cr,
      provider: m > 0 ? momoProvider : ('none' as MobileMoneyProvider),
    };
  }, [payMode, total, momoProvider, mixedCash, mixedMomo]);

  const addToCart = (product: Product) => {
    if (product.quantity <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.qty >= product.quantity) return prev;
        return prev.map((i) => (i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const handleBarcodeDetected = (rawCode: string): BarcodeScanOutcome => {
    const code = rawCode.trim();
    const normalized = code.toLowerCase();
    const match = products.find(
      (p) => (p.barcode || '').trim().toLowerCase() === normalized || p.id.toLowerCase() === normalized
    );

    if (!match) {
      setUnmatchedBarcode(code);
      if (products.length > 0 && !assignTargetId) {
        setAssignTargetId(products[0].id);
      }
      setFeedback(`Aucun produit enregistré pour le code-barres ${code}.`);
      return { ok: false, message: `Code inconnu : ${code}` };
    }

    if (match.quantity <= 0) {
      setFeedback(`Rupture de stock pour ${match.name}.`);
      return { ok: false, message: `Rupture de stock : ${match.name}` };
    }

    const existingItem = cart.find((i) => i.product.id === match.id);
    if (existingItem && existingItem.qty >= match.quantity) {
      return { ok: false, message: `Stock maximum atteint (${match.quantity}) pour ${match.name}` };
    }

    addToCart(match);
    setUnmatchedBarcode(null);
    setFeedback(`Ajouté au panier : ${match.name} (${formatFcfa(match.unitPriceFcfa)})`);
    return { ok: true, message: `Ajouté : ${match.name} (${formatFcfa(match.unitPriceFcfa)})` };
  };

  const handleLinkUnmatchedBarcode = async () => {
    if (!unmatchedBarcode || !onAssignBarcode) return;
    const target = products.find((p) => p.id === assignTargetId) || products[0];
    if (!target) return;

    setAssigningBarcode(true);
    try {
      await onAssignBarcode(target, unmatchedBarcode);
      addToCart({ ...target, barcode: unmatchedBarcode });
      setFeedback(`Code-barres ${unmatchedBarcode} lié à ${target.name} et ajouté au panier.`);
      setUnmatchedBarcode(null);
    } finally {
      setAssigningBarcode(false);
    }
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product.id !== productId) return i;
          const nextQty = Math.min(i.product.quantity, i.qty + delta);
          return { ...i, qty: nextQty };
        })
        .filter((i) => i.qty > 0)
    );
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (computedSplit.credit > 0 && !creatingDebtor && !selectedDebtorId) {
      setFeedback('Veuillez sélectionner ou créer un client débiteur pour la part à crédit.');
      return;
    }
    if (computedSplit.credit > 0 && creatingDebtor && (!newDebName.trim() || !newDebPhone.trim() || !newDebZone.trim())) {
      setFeedback('Nom, téléphone et village/zone du débiteur requis.');
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const chosenDebtor = debtors.find((d) => d.id === selectedDebtorId);
      await onRecordSale({
        items: cart,
        discountFcfa,
        cashFcfa: computedSplit.cash,
        mobileMoneyFcfa: computedSplit.momo,
        mobileMoneyProvider: computedSplit.provider,
        creditFcfa: computedSplit.credit,
        debtorId: computedSplit.credit > 0 && !creatingDebtor ? chosenDebtor?.id : undefined,
        debtorName: computedSplit.credit > 0 && !creatingDebtor ? chosenDebtor?.fullName : undefined,
        newDebtor:
          computedSplit.credit > 0 && creatingDebtor
            ? { fullName: newDebName.trim(), phone: newDebPhone.trim(), zone: newDebZone.trim() }
            : undefined,
      });
      setCart([]);
      setDiscountFcfa(0);
      setMixedCash(0);
      setMixedMomo(0);
      setCreatingDebtor(false);
      setNewDebName('');
      setNewDebZone('');
      setFeedback('Encaissement enregistré et stock mis à jour.');
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const todayCompletedSales = sales.filter((s) => s.status === 'completed' && s.createdAt.slice(0, 10) === today);
  const theoreticalCashToday = todayCompletedSales.reduce((s, x) => s + x.cashFcfa, 0);
  const momoToday = todayCompletedSales.reduce((s, x) => s + x.mobileMoneyFcfa, 0);
  const creditToday = todayCompletedSales.reduce((s, x) => s + x.creditFcfa, 0);

  const handleConfirmClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    const counted = Number(countedCashInput || 0);
    await onCloseRegister({
      theoreticalCashFcfa: theoreticalCashToday,
      countedCashFcfa: counted,
      mobileMoneyTotalFcfa: momoToday,
      creditTotalFcfa: creditToday,
      note: closingNote.trim(),
    });
    setShowClosingModal(false);
    setCountedCashInput('');
    setClosingNote('');
    setFeedback('Clôture de caisse journalière enregistrée.');
  };

  if (role === 'pointer') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="font-display text-lg font-bold text-[#1E293B]">Accès Caisse réservé aux Gérants et Présidents</p>
        <p className="mt-2 text-sm text-slate-600">
          Votre poste actuel (Pointeur / Chef d&apos;équipe) gère le pointage ouvriers et les mouvements de récolte.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1E293B]">Point de Vente (POS) &amp; Caisse</h1>
          <p className="text-xs text-slate-500">
            Saisie rapide en 2 clics · Ventilation Espèces, Wave, Orange Money, Crédit ou Mixte
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCountedCashInput(String(theoreticalCashToday));
            setShowClosingModal(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E293B] hover:bg-slate-50 min-h-[48px] whitespace-nowrap shrink-0"
        >
          <Calculator className="h-4 w-4 text-[#1A73E8]" />
          <span>Clôture de caisse ({formatFcfa(theoreticalCashToday)})</span>
        </button>
      </div>

      {feedback && (
        <div className="flex items-center justify-between rounded-xl border border-[#2E7D32]/30 bg-[#2E7D32]/10 px-4 py-3 text-sm font-medium text-[#2E7D32]">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {feedback}
          </span>
          <button type="button" onClick={() => setFeedback(null)} className="text-xs underline">
            Fermer
          </button>
        </div>
      )}

      {unmatchedBarcode && onAssignBarcode && products.length > 0 && (
        <div className="rounded-2xl border border-[#FFB300]/50 bg-[#FFB300]/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-[#1E293B]">
              Code-barres non attribué : <span className="font-mono-num">{unmatchedBarcode}</span>
            </p>
            <p className="text-xs text-slate-600">
              Associez ce code à un article du catalogue pour l&apos;ajouter directement au panier :
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={assignTargetId || products[0]?.id || ''}
              onChange={(e) => setAssignTargetId(e.target.value)}
              aria-label="Article à associer au code-barres"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#1E293B] min-h-[42px]"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={assigningBarcode}
              onClick={handleLinkUnmatchedBarcode}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E7D32] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#256428] min-h-[42px] whitespace-nowrap"
            >
              <Link2 className="h-3.5 w-3.5" />
              <span>{assigningBarcode ? 'Liaison...' : 'Associer et ajouter'}</span>
            </button>
            <button
              type="button"
              onClick={() => setUnmatchedBarcode(null)}
              className="text-xs font-medium text-slate-600 hover:underline px-2"
            >
              Ignorer
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Product Touch Grid */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && search.trim()) {
                    const q = search.trim().toLowerCase();
                    const exactMatch = products.find(
                      (p) =>
                        (p.barcode || '').trim().toLowerCase() === q ||
                        p.id.toLowerCase() === q
                    );
                    if (exactMatch) {
                      e.preventDefault();
                      handleBarcodeDetected(search.trim());
                      setSearch('');
                    }
                  }
                }}
                placeholder="Rechercher un article ou scanner un code-barres..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-[#1E293B] focus:border-[#2E7D32] focus:outline-none min-h-[48px]"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1A73E8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1557B0] min-h-[48px] whitespace-nowrap shrink-0"
            >
              <ScanBarcode className="h-5 w-5" />
              <span>Scanner caméra</span>
            </button>
          </div>

          {/* Category segmented filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {(
              [
                ['all', 'Tous'],
                ['intrants', 'Intrants'],
                ['provende', 'Provende'],
                ['recoltes', 'Récoltes'],
                ['emballages', 'Emballages'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setCategory(val)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 min-h-[40px] transition-colors ${
                  category === val
                    ? 'bg-[#2E7D32] text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-[#1E293B]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredProducts.map((p) => {
              const outOfStock = p.quantity <= 0;
              const isLow = p.quantity > 0 && p.quantity <= p.minThreshold;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={outOfStock}
                  onClick={() => addToCart(p)}
                  className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition-colors min-h-[112px] ${
                    outOfStock
                      ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                      : 'border-slate-200 bg-white hover:border-[#2E7D32] active:scale-[0.99]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display text-sm font-bold text-[#1E293B] leading-snug">
                        {p.name}
                      </span>
                      <Plus className="h-5 w-5 text-[#2E7D32] shrink-0" />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {p.unit} · Stock :{' '}
                      <span
                        className={`font-mono-num font-semibold ${
                          outOfStock ? 'text-[#D32F2F]' : isLow ? 'text-[#B45309]' : 'text-slate-700'
                        }`}
                      >
                        {p.quantity}
                      </span>
                      {p.barcode ? <span className="font-mono-num text-slate-400"> · {p.barcode}</span> : null}
                    </p>
                  </div>
                  <p className="mt-3 font-mono-num text-base font-bold text-[#2E7D32]">
                    {formatFcfa(p.unitPriceFcfa)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Cart & Multi-Payment */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-[#2E7D32]" />
              <h2 className="font-display text-base font-bold text-[#1E293B]">Panier en cours</h2>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-xs font-medium text-[#D32F2F] hover:underline"
              >
                Vider
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Touchez un produit à gauche pour démarrer une vente.
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1E293B] truncate">{item.product.name}</p>
                    <p className="font-mono-num text-xs text-slate-500">
                      {formatFcfa(item.product.unitPriceFcfa)} × {item.qty}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQty(item.product.id, -1)}
                      aria-label="Diminuer"
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-7 text-center font-mono-num text-sm font-bold">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.product.id, 1)}
                      aria-label="Augmenter"
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateQty(item.product.id, -item.qty)}
                      aria-label="Retirer"
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:text-[#D32F2F]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Discount */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <label htmlFor="pos-discount" className="text-xs font-medium text-slate-600">
                  Remise éventuelle (FCFA)
                </label>
                <input
                  id="pos-discount"
                  type="number"
                  min={0}
                  max={subtotal}
                  value={discountFcfa || ''}
                  onChange={(e) => setDiscountFcfa(Math.max(0, Number(e.target.value || 0)))}
                  placeholder="0"
                  className="w-32 rounded-lg border border-slate-200 px-3 py-1.5 text-right font-mono-num text-sm focus:border-[#2E7D32] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5">
                <span className="text-sm font-semibold text-[#1E293B]">Total à régler</span>
                <span className="font-mono-num text-xl font-bold text-[#2E7D32]">{formatFcfa(total)}</span>
              </div>

              {/* Payment Mode Tabs */}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Canal d&apos;encaissement</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(
                    [
                      ['cash', 'Espèces'],
                      ['momo', 'Mobile Money'],
                      ['credit', 'Crédit'],
                      ['mixed', 'Mixte'],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setPayMode(mode);
                        if (mode === 'mixed') {
                          setMixedCash(Math.round(total * 0.5));
                          setMixedMomo(0);
                        }
                      }}
                      className={`rounded-lg py-2.5 px-2 text-xs font-semibold transition-colors min-h-[44px] ${
                        payMode === mode
                          ? 'bg-[#2E7D32] text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {(payMode === 'momo' || payMode === 'mixed') && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-600">Opérateur Mobile Money</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ['wave', 'Wave'],
                        ['orange_money', 'Orange Money'],
                        ['free_money', 'Free Money'],
                        ['mtn_momo', 'MTN MoMo'],
                      ] as const
                    ).map(([prov, lbl]) => (
                      <button
                        key={prov}
                        type="button"
                        onClick={() => setMomoProvider(prov)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold min-h-[40px] ${
                          momoProvider === prov
                            ? 'border-[#1A73E8] bg-[#1A73E8]/10 text-[#1A73E8]'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {payMode === 'mixed' && (
                <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5 bg-slate-50/70">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs text-slate-600">Part Espèces</label>
                    <input
                      type="number"
                      min={0}
                      max={total}
                      value={mixedCash}
                      onChange={(e) => setMixedCash(Math.max(0, Number(e.target.value || 0)))}
                      className="w-32 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-right font-mono-num text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs text-slate-600">Part Mobile Money</label>
                    <input
                      type="number"
                      min={0}
                      max={total}
                      value={mixedMomo}
                      onChange={(e) => setMixedMomo(Math.max(0, Number(e.target.value || 0)))}
                      className="w-32 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-right font-mono-num text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                    <span className="font-semibold text-[#B45309]">Solde basculé en Crédit (Module 3)</span>
                    <span className="font-mono-num font-bold text-[#B45309]">{formatFcfa(computedSplit.credit)}</span>
                  </div>
                </div>
              )}

              {/* Mandatory Debtor Selection when Credit > 0 */}
              {computedSplit.credit > 0 && (
                <div className="rounded-xl border border-[#FFB300]/50 bg-[#FFB300]/10 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1E293B]">
                      Client Débiteur ({formatFcfa(computedSplit.credit)})
                    </span>
                    <button
                      type="button"
                      onClick={() => setCreatingDebtor(!creatingDebtor)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A73E8] hover:underline"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>{creatingDebtor ? 'Client existant' : 'Nouveau client'}</span>
                    </button>
                  </div>

                  {!creatingDebtor ? (
                    <select
                      value={selectedDebtorId}
                      onChange={(e) => setSelectedDebtorId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#1E293B] min-h-[44px]"
                    >
                      <option value="">-- Choisir un débiteur identifié --</option>
                      {debtors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.fullName} ({d.zone}) — Solde: {formatFcfa(d.remainingFcfa)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Nom & Prénom du client"
                        value={newDebName}
                        onChange={(e) => setNewDebName(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[42px]"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Téléphone (+221...)"
                          value={newDebPhone}
                          onChange={(e) => setNewDebPhone(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[42px]"
                        />
                        <input
                          type="text"
                          placeholder="Village / Zone"
                          value={newDebZone}
                          onChange={(e) => setNewDebZone(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[42px]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={handleCheckout}
                className="w-full rounded-xl bg-[#2E7D32] py-3.5 text-sm font-bold text-white hover:bg-[#256428] disabled:opacity-60 transition-colors min-h-[52px]"
              >
                {submitting ? 'Enregistrement...' : `Valider la vente · ${formatFcfa(total)}`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recent Sales Journal */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-[#1E293B]">Journal des Ventes Récentes</h2>
          <span className="text-xs text-slate-500">
            {role === 'manager' ? 'Suppression verrouillée (Gérant)' : 'Contrôle Président actif'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Articles</th>
                <th className="px-4 py-3 text-right">Cash</th>
                <th className="px-4 py-3 text-right">Mobile Money</th>
                <th className="px-4 py-3 text-right">Crédit</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Statut</th>
                {(role === 'admin' || role === 'super_admin') && <th className="px-4 py-3 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.slice(0, 10).map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono-num text-xs text-slate-500 whitespace-nowrap">
                    {s.createdAt.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#1E293B] max-w-xs truncate">
                    {s.itemsSummary}
                    {s.debtorName ? ` · Client : ${s.debtorName}` : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-xs">{formatFcfa(s.cashFcfa)}</td>
                  <td className="px-4 py-3 text-right font-mono-num text-xs text-[#1A73E8]">
                    {formatFcfa(s.mobileMoneyFcfa)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-xs text-[#B45309]">
                    {formatFcfa(s.creditFcfa)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num font-bold text-[#1E293B]">
                    {formatFcfa(s.totalFcfa)}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                    {s.status === 'completed' ? (
                      <span className="text-[#2E7D32]">Validée</span>
                    ) : (
                      <span className="text-[#D32F2F]">Annulée</span>
                    )}
                  </td>
                  {(role === 'admin' || role === 'super_admin') && (
                    <td className="px-4 py-3 text-right">
                      {s.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() => onCancelSale(s)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#D32F2F] hover:underline"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          <span>Annuler</span>
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Register Closing Modal */}
      {showClosingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleConfirmClosing}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl"
          >
            <h3 className="font-display text-lg font-bold text-[#1E293B]">Clôture de Caisse Journalière</h3>
            <div className="rounded-xl bg-slate-50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Espèces théoriques calculées :</span>
                <span className="font-mono-num font-bold text-[#1E293B]">{formatFcfa(theoreticalCashToday)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Mobile Money (Wave/OM) :</span>
                <span className="font-mono-num font-semibold text-[#1A73E8]">{formatFcfa(momoToday)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Ventes à Crédit du jour :</span>
                <span className="font-mono-num font-semibold text-[#B45309]">{formatFcfa(creditToday)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Montant physique compté dans le tiroir-caisse (FCFA)
              </label>
              <input
                type="number"
                required
                min={0}
                value={countedCashInput}
                onChange={(e) => setCountedCashInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono-num text-base font-bold min-h-[48px]"
              />
              {countedCashInput !== '' && (
                <p
                  className={`mt-1.5 font-mono-num text-xs font-semibold ${
                    Number(countedCashInput) - theoreticalCashToday === 0
                      ? 'text-[#2E7D32]'
                      : 'text-[#D32F2F]'
                  }`}
                >
                  Écart constaté : {formatFcfa(Number(countedCashInput) - theoreticalCashToday)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Observation / justification de clôture
              </label>
              <input
                type="text"
                value={closingNote}
                onChange={(e) => setClosingNote(e.target.value)}
                placeholder="Ex: Caisse conforme, dépôt Wave vérifié"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm min-h-[44px]"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClosingModal(false)}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 min-h-[48px]"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-[#2E7D32] py-2.5 text-sm font-semibold text-white hover:bg-[#256428] min-h-[48px]"
              >
                Clôturer la caisse
              </button>
            </div>
          </form>
        </div>
      )}
      <BarcodeScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onDetected={handleBarcodeDetected}
        title="Scanner un produit (Caisse POS)"
        subtitle="Visez le code-barres avec la caméra ou saisissez-le au clavier / douchette USB."
        showContinuousToggle
        defaultContinuous
      />
    </div>
  );
};
