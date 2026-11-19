import React, { useMemo } from 'react';
import { AlertTriangle, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { formatFcfa } from '../i18n/translations';
import type { Locale, Product, ProductCategory } from '../types/agrikoom';

interface CriticalStockTableProps {
  products: Product[];
  locale: Locale;
  onNavigateStocks: () => void;
}

const categoryLabel = (category: ProductCategory, locale: Locale): string => {
  if (locale === 'fr') {
    switch (category) {
      case 'intrants':
        return 'Intrants / Engrais';
      case 'provende':
        return 'Aliments / Provende';
      case 'recoltes':
        return 'Récoltes / Produits';
      case 'emballages':
        return 'Emballages';
    }
  }
  switch (category) {
    case 'intrants':
      return 'Inputs / Fertilizer';
    case 'provende':
      return 'Feed / Provender';
    case 'recoltes':
      return 'Harvest / Produce';
    case 'emballages':
      return 'Packaging';
  }
};

export const CriticalStockTable: React.FC<CriticalStockTableProps> = ({
  products,
  locale,
  onNavigateStocks,
}) => {
  const { criticalProducts, outOfStockCount } = useMemo(() => {
    const critical = products
      .filter((p) => p.quantity <= p.minThreshold)
      .sort((a, b) => {
        if (a.quantity <= 0 && b.quantity > 0) return -1;
        if (b.quantity <= 0 && a.quantity > 0) return 1;
        const ratioA = a.minThreshold > 0 ? a.quantity / a.minThreshold : a.quantity;
        const ratioB = b.minThreshold > 0 ? b.quantity / b.minThreshold : b.quantity;
        return ratioA - ratioB || a.name.localeCompare(b.name);
      });

    return {
      criticalProducts: critical,
      outOfStockCount: critical.filter((p) => p.quantity <= 0).length,
    };
  }, [products]);

  const lowOnlyCount = criticalProducts.length - outOfStockCount;

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
      aria-label={
        locale === 'fr'
          ? 'Tableau des produits sous seuil critique'
          : 'Critical stock threshold products table'
      }
    >
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`h-4 w-4 shrink-0 ${
                criticalProducts.length > 0 ? 'text-[#D32F2F]' : 'text-[#2E7D32]'
              }`}
            />
            <h2 className="font-display text-base font-bold text-[#1E293B]">
              {locale === 'fr'
                ? 'Produits au seuil critique ou en rupture'
                : 'Products at or Below Critical Threshold'}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {criticalProducts.length === 0 ? (
              locale === 'fr' ? (
                <>
                  <span className="font-mono-num font-semibold text-[#2E7D32]">0</span> /{' '}
                  <span className="font-mono-num">{products.length}</span>{' '}
                  {products.length > 1 ? 'articles' : 'article'} sous seuil critique
                </>
              ) : (
                <>
                  <span className="font-mono-num font-semibold text-[#2E7D32]">0</span> /{' '}
                  <span className="font-mono-num">{products.length}</span> products below threshold
                </>
              )
            ) : locale === 'fr' ? (
              <>
                <span className="font-mono-num font-semibold text-[#D32F2F]">
                  {criticalProducts.length}
                </span>{' '}
                / <span className="font-mono-num">{products.length}</span>{' '}
                {criticalProducts.length > 1 ? 'articles à réapprovisionner' : 'article à réapprovisionner'}
                <span aria-hidden="true"> · </span>
                <span className="font-mono-num font-semibold text-[#D32F2F]">{outOfStockCount}</span>{' '}
                en rupture
                <span aria-hidden="true"> · </span>
                <span className="font-mono-num font-semibold text-[#B45309]">{lowOnlyCount}</span>{' '}
                sous seuil
              </>
            ) : (
              <>
                <span className="font-mono-num font-semibold text-[#D32F2F]">
                  {criticalProducts.length}
                </span>{' '}
                / <span className="font-mono-num">{products.length}</span> items need restocking
                <span aria-hidden="true"> · </span>
                <span className="font-mono-num font-semibold text-[#D32F2F]">{outOfStockCount}</span>{' '}
                out of stock
                <span aria-hidden="true"> · </span>
                <span className="font-mono-num font-semibold text-[#B45309]">{lowOnlyCount}</span>{' '}
                low stock
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateStocks}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#1E293B] hover:bg-slate-50 transition-colors min-h-[36px] whitespace-nowrap shrink-0"
        >
          <span>{locale === 'fr' ? 'Gérer les stocks' : 'Manage stocks'}</span>
          <ArrowUpRight className="h-3.5 w-3.5 text-[#1A73E8]" />
        </button>
      </div>

      {criticalProducts.length === 0 ? (
        <div className="px-5 py-6 flex items-center gap-3 text-xs text-slate-600">
          <CheckCircle2 className="h-4 w-4 text-[#2E7D32] shrink-0" />
          <span>
            {locale === 'fr'
              ? 'Tous les articles en catalogue disposent d’un stock supérieur à leur seuil d’alerte critique.'
              : 'All catalog products are currently above their critical stock threshold.'}
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-5 py-3">
                  {locale === 'fr' ? 'Produit & Catégorie' : 'Product & Category'}
                </th>
                <th className="px-4 py-3 text-right">
                  {locale === 'fr' ? 'Stock actuel' : 'Current Stock'}
                </th>
                <th className="px-4 py-3 text-right">
                  {locale === 'fr' ? 'Seuil critique' : 'Critical Threshold'}
                </th>
                <th className="px-4 py-3 text-right">
                  {locale === 'fr' ? 'Manque min.' : 'Min. Deficit'}
                </th>
                <th className="px-4 py-3 text-right">
                  {locale === 'fr' ? 'Prix unitaire' : 'Unit Price'}
                </th>
                <th className="px-5 py-3">
                  {locale === 'fr' ? 'État' : 'Status'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {criticalProducts.map((product) => {
                const isOut = product.quantity <= 0;
                const deficit = Math.max(0, product.minThreshold - product.quantity);
                return (
                  <tr key={product.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-[#1E293B]">{product.name}</div>
                      <div className="text-xs text-slate-500">
                        {categoryLabel(product.category, locale)}
                        <span aria-hidden="true"> · </span>
                        {product.unit}
                      </div>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono-num font-bold whitespace-nowrap ${
                        isOut ? 'text-[#D32F2F]' : 'text-[#B45309]'
                      }`}
                    >
                      {product.quantity.toLocaleString('fr-FR')}{' '}
                      <span className="text-xs font-normal text-slate-500">{product.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-xs text-slate-600 whitespace-nowrap">
                      {product.minThreshold.toLocaleString('fr-FR')} {product.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-xs font-semibold text-slate-700 whitespace-nowrap">
                      {deficit > 0 ? `+${deficit.toLocaleString('fr-FR')}` : '0'} {product.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-xs font-semibold text-[#1E293B] whitespace-nowrap">
                      {formatFcfa(product.unitPriceFcfa)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {isOut ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D32F2F]">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          {locale === 'fr' ? 'Rupture de stock' : 'Out of stock'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B45309]">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          {locale === 'fr' ? 'Seuil critique' : 'Critical threshold'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
