import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  ClipboardList,
  Plus,
  ScanBarcode,
  Search,
} from 'lucide-react';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { StockCategoryChart } from './StockCategoryChart';
import { formatFcfa } from '../i18n/translations';
import type {
  MovementType,
  Product,
  ProductCategory,
  StockMovement,
  UserRole,
} from '../types/agrikoom';

interface StockViewProps {
  role: UserRole;
  products: Product[];
  movements: StockMovement[];
  onCreateProduct: (input: {
    name: string;
    barcode?: string;
    category: ProductCategory;
    unit: string;
    quantity: number;
    minThreshold: number;
    unitCostFcfa: number;
    unitPriceFcfa: number;
  }) => Promise<void>;
  onRecordMovement: (params: {
    product: Product;
    movementType: MovementType;
    quantityDelta: number;
    justification: string;
  }) => Promise<void>;
  onQuickInventory: (params: {
    product: Product;
    physicalCount: number;
    justification: string;
  }) => Promise<void>;
}

export const StockView: React.FC<StockViewProps> = ({
  role,
  products,
  movements,
  onCreateProduct,
  onRecordMovement,
  onQuickInventory,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProductCategory>('all');
  const [search, setSearch] = useState('');

  // Modals
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [inventoryTarget, setInventoryTarget] = useState<Product | null>(null);

  // Add Product Form
  const [pName, setPName] = useState('');
  const [pBarcode, setPBarcode] = useState('');
  const [pCat, setPCat] = useState<ProductCategory>('intrants');
  const [pUnit, setPUnit] = useState('Sac 50 kg');
  const [pQty, setPQty] = useState('20');
  const [pMin, setPMin] = useState('10');
  const [pCost, setPCost] = useState('12000');
  const [pPrice, setPPrice] = useState('15000');

  // Movement Form
  const [movProdId, setMovProdId] = useState(products[0]?.id || '');
  const [movType, setMovType] = useState<MovementType>('entree_achat');
  const [movQty, setMovQty] = useState('10');
  const [movJustif, setMovJustif] = useState('');

  // Quick Inventory Form
  const [physCount, setPhysCount] = useState('');
  const [invJustif, setInvJustif] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      const matchSearch =
        !q || p.name.toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, categoryFilter, search]);

  const catLabel = (cat: ProductCategory) => {
    if (cat === 'intrants') return 'Intrants / Engrais';
    if (cat === 'provende') return 'Aliments / Provende';
    if (cat === 'recoltes') return 'Récoltes / Produits';
    return 'Emballages';
  };

  const movLabel = (m: MovementType) => {
    switch (m) {
      case 'entree_achat':
        return 'Entrée Achat Fournisseur';
      case 'entree_apport':
        return 'Apport Membre Coopérative';
      case 'entree_recolte':
        return 'Récolte / Production Interne';
      case 'sortie_vente':
        return 'Sortie Vente POS';
      case 'sortie_interne':
        return 'Consommation Interne';
      case 'perte':
        return 'Perte / Casse / Avarie';
      case 'ajustement':
        return 'Ajustement Inventaire';
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateProduct({
      name: pName.trim(),
      barcode: pBarcode.trim() || undefined,
      category: pCat,
      unit: pUnit.trim(),
      quantity: Number(pQty || 0),
      minThreshold: Number(pMin || 0),
      unitCostFcfa: Number(pCost || 0),
      unitPriceFcfa: Number(pPrice || 0),
    });
    setShowAddProduct(false);
    setPName('');
    setPBarcode('');
  };

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = products.find((p) => p.id === movProdId) || products[0];
    if (!target) return;
    const rawQty = Math.abs(Number(movQty || 0));
    const isOut = movType === 'sortie_interne' || movType === 'perte' || movType === 'sortie_vente';
    await onRecordMovement({
      product: target,
      movementType: movType,
      quantityDelta: isOut ? -rawQty : rawQty,
      justification: movJustif.trim(),
    });
    setShowMovementModal(false);
    setMovJustif('');
  };

  const handleInventorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inventoryTarget) return;
    await onQuickInventory({
      product: inventoryTarget,
      physicalCount: Math.max(0, Number(physCount || 0)),
      justification: invJustif.trim(),
    });
    setInventoryTarget(null);
    setInvJustif('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1E293B]">Gestion des Stocks &amp; Mouvements</h1>
          <p className="text-xs text-slate-500">
            Catalogue multi-catégories, seuils critiques et inventaire rapide avec traçabilité anti-fraude
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setMovProdId(products[0]?.id || '');
              setShowMovementModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E293B] hover:bg-slate-50 min-h-[48px] whitespace-nowrap shrink-0"
          >
            <ArrowDownUp className="h-4 w-4 text-[#1A73E8]" />
            <span>Mouvement de stock</span>
          </button>

          {role !== 'pointer' && (
            <button
              type="button"
              onClick={() => setShowAddProduct(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2E7D32] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#256428] min-h-[48px] whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Nouvel article</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Stock Distribution Chart */}
      <StockCategoryChart
        products={products}
        activeCategory={categoryFilter}
        onSelectCategory={setCategoryFilter}
      />

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(
            [
              ['all', 'Tous'],
              ['intrants', 'Intrants / Engrais'],
              ['provende', 'Aliments / Provende'],
              ['recoltes', 'Récoltes'],
              ['emballages', 'Emballages'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setCategoryFilter(val)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 min-h-[40px] ${
                categoryFilter === val
                  ? 'bg-[#2E7D32] text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-[#1E293B]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer le catalogue..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm min-h-[42px]"
          />
        </div>
      </div>

      {/* Stock Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">Article &amp; Catégorie</th>
                <th className="px-4 py-3 text-right">Stock Actuel</th>
                <th className="px-4 py-3 text-right">Seuil Alerte</th>
                <th className="px-4 py-3 text-right">Prix Vente</th>
                <th className="px-4 py-3">État</th>
                <th className="px-4 py-3 text-right">Inventaire Rapide</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const isOut = p.quantity <= 0;
                const isLow = p.quantity > 0 && p.quantity <= p.minThreshold;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-[#1E293B]">{p.name}</div>
                      <div className="text-xs text-slate-500">
                        {catLabel(p.category)} · Unité : {p.unit}
                        {p.barcode ? <span className="font-mono-num"> · Code : {p.barcode}</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num font-bold text-[#1E293B]">
                      {p.quantity} <span className="text-xs font-normal text-slate-500">{p.unit}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-xs text-slate-500">
                      {p.minThreshold}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num font-semibold text-[#2E7D32]">
                      {formatFcfa(p.unitPriceFcfa)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {isOut ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D32F2F]">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Rupture
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B45309]">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Seuil critique
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2E7D32]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Nominal
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setInventoryTarget(p);
                          setPhysCount(String(p.quantity));
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#1E293B] hover:bg-slate-50 min-h-[38px]"
                      >
                        <ClipboardList className="h-3.5 w-3.5 text-[#1A73E8]" />
                        <span>Compter</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movements History */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-display text-base font-bold text-[#1E293B]">Journal des Mouvements de Stock</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {movements.slice(0, 12).map((m) => (
            <div key={m.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#1E293B]">{m.productName}</span>
                  <span className="text-xs text-slate-500">· {movLabel(m.movementType)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Justification : {m.justification} · Par {m.actorName} ({m.createdAt.slice(0, 16).replace('T', ' ')})
                </p>
              </div>
              <span
                className={`font-mono-num text-sm font-bold whitespace-nowrap ${
                  m.quantityDelta >= 0 ? 'text-[#2E7D32]' : 'text-[#D32F2F]'
                }`}
              >
                {m.quantityDelta >= 0 ? `+${m.quantityDelta}` : m.quantityDelta}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: New Product */}
      {showAddProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateProduct} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl">
            <h3 className="font-display text-lg font-bold text-[#1E293B]">Nouvel article au catalogue</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nom de l&apos;article</label>
                <input required value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Ex: Semences Oignon Violet" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Code-barres (optionnel)</label>
                <div className="flex gap-2">
                  <input
                    value={pBarcode}
                    onChange={(e) => setPBarcode(e.target.value)}
                    maxLength={64}
                    placeholder="Ex: 6041000005012"
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 font-mono-num text-sm min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBarcodeScanner(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-[#1E293B] hover:bg-slate-100 min-h-[44px] whitespace-nowrap"
                  >
                    <ScanBarcode className="h-4 w-4 text-[#1A73E8]" />
                    <span>Scanner</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Catégorie</label>
                  <select value={pCat} onChange={(e) => setPCat(e.target.value as ProductCategory)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]">
                    <option value="intrants">Intrants / Engrais</option>
                    <option value="provende">Aliments / Provende</option>
                    <option value="recoltes">Récoltes</option>
                    <option value="emballages">Emballages</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Unité de mesure</label>
                  <input required value={pUnit} onChange={(e) => setPUnit(e.target.value)} placeholder="Sac 50 kg, kg, Litre" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Quantité initiale</label>
                  <input type="number" min={0} required value={pQty} onChange={(e) => setPQty(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono-num text-sm min-h-[44px]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Seuil alerte critique</label>
                  <input type="number" min={0} required value={pMin} onChange={(e) => setPMin(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono-num text-sm min-h-[44px]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Coût d&apos;achat (FCFA)</label>
                  <input type="number" min={0} required value={pCost} onChange={(e) => setPCost(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono-num text-sm min-h-[44px]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Prix de vente (FCFA)</label>
                  <input type="number" min={0} required value={pPrice} onChange={(e) => setPPrice(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono-num text-sm min-h-[44px]" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowAddProduct(false)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold min-h-[48px]">Annuler</button>
              <button type="submit" className="flex-1 rounded-xl bg-[#2E7D32] py-2.5 text-sm font-semibold text-white min-h-[48px]">Créer</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Record Movement */}
      {showMovementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <form onSubmit={handleMovementSubmit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl">
            <h3 className="font-display text-lg font-bold text-[#1E293B]">Enregistrer un mouvement</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Produit concerné</label>
                <select value={movProdId} onChange={(e) => setMovProdId(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]">
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.quantity} {p.unit})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nature du mouvement</label>
                <select value={movType} onChange={(e) => setMovType(e.target.value as MovementType)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]">
                  <option value="entree_achat">Entrée : Achat fournisseur</option>
                  <option value="entree_apport">Entrée : Apport membre coopérative</option>
                  <option value="entree_recolte">Entrée : Récolte / Production interne</option>
                  <option value="sortie_interne">Sortie : Consommation interne (cheptel/parcelle)</option>
                  <option value="perte">Sortie : Perte / Casse / Avarie</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Quantité</label>
                <input type="number" min={1} required value={movQty} onChange={(e) => setMovQty(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono-num text-sm min-h-[44px]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Justification obligatoire</label>
                <input required minLength={3} value={movJustif} onChange={(e) => setMovJustif(e.target.value)} placeholder="Ex: Livraison fournisseur ICS / Récolte Parcelle B" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowMovementModal(false)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold min-h-[48px]">Annuler</button>
              <button type="submit" className="flex-1 rounded-xl bg-[#2E7D32] py-2.5 text-sm font-semibold text-white min-h-[48px]">Enregistrer</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Quick Physical Inventory (Mandatory Justification) */}
      {inventoryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <form onSubmit={handleInventorySubmit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl">
            <h3 className="font-display text-lg font-bold text-[#1E293B]">Inventaire Rapide : {inventoryTarget.name}</h3>
            <p className="text-xs text-slate-500">
              Stock théorique actuel : <span className="font-mono-num font-bold">{inventoryTarget.quantity} {inventoryTarget.unit}</span>.
              Tout écart est enregistré de manière immuable dans le journal d&apos;audit.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Comptage physique réel</label>
              <input
                type="number"
                min={0}
                required
                value={physCount}
                onChange={(e) => setPhysCount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono-num text-base font-bold min-h-[48px]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Justification obligatoire de l&apos;écart</label>
              <input
                required
                minLength={3}
                value={invJustif}
                onChange={(e) => setInvJustif(e.target.value)}
                placeholder="Ex: Sacs endommagés par l'humidité / Contrôle physique hebdomadaire"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm min-h-[44px]"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setInventoryTarget(null)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold min-h-[48px]">Annuler</button>
              <button type="submit" className="flex-1 rounded-xl bg-[#1A73E8] py-2.5 text-sm font-semibold text-white min-h-[48px]">Valider l&apos;ajustement</button>
            </div>
          </form>
        </div>
      )}
      <BarcodeScannerModal
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onDetected={(code) => {
          setPBarcode(code.slice(0, 64));
          return { ok: true, message: `Code-barres capturé : ${code}`, autoClose: true };
        }}
        title="Associer un code-barres"
        subtitle="Scannez le code-barres de l'emballage pour l'enregistrer sur cet article."
        showContinuousToggle={false}
        defaultContinuous={false}
      />
    </div>
  );
};
