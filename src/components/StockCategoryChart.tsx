import React, { useMemo } from 'react';
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
import type { Product, ProductCategory } from '../types/agrikoom';

interface StockCategoryChartProps {
  products: Product[];
  activeCategory: 'all' | ProductCategory;
  onSelectCategory: (category: 'all' | ProductCategory) => void;
}

interface CategoryDatum {
  category: ProductCategory;
  label: string;
  shortLabel: string;
  color: string;
  totalQuantity: number;
  productCount: number;
  lowStockCount: number;
  stockValueFcfa: number;
  sharePct: number;
}

const CATEGORY_META: Array<{
  category: ProductCategory;
  label: string;
  shortLabel: string;
  color: string;
}> = [
  { category: 'intrants', label: 'Intrants / Engrais', shortLabel: 'Intrants', color: '#2E7D32' },
  { category: 'provende', label: 'Aliments / Provende', shortLabel: 'Provende', color: '#1A73E8' },
  { category: 'recoltes', label: 'Récoltes / Produits', shortLabel: 'Récoltes', color: '#FFB300' },
  { category: 'emballages', label: 'Emballages', shortLabel: 'Emballages', color: '#64748B' },
];

interface TooltipPayloadItem {
  payload?: CategoryDatum;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

const CustomCategoryTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-md text-xs space-y-1.5 min-w-[215px]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
        <span className="inline-flex items-center gap-1.5 font-display font-bold text-[#1E293B]">
          <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
        <span className="font-mono-num font-semibold text-slate-600">{item.sharePct.toFixed(1)} %</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-600">Volume en stock</span>
        <span className="font-mono-num font-bold text-[#1E293B]">
          {item.totalQuantity.toLocaleString('fr-FR')} unités
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-600">Articles catalogués</span>
        <span className="font-mono-num font-semibold text-[#1E293B]">
          {item.productCount} {item.productCount > 1 ? 'articles' : 'article'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-600">Valeur marchande</span>
        <span className="font-mono-num font-semibold text-[#2E7D32]">{formatFcfa(item.stockValueFcfa)}</span>
      </div>
      {item.lowStockCount > 0 && (
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-100">
          <span className="text-[#B45309]">Sous seuil d&apos;alerte</span>
          <span className="font-mono-num font-semibold text-[#B45309]">{item.lowStockCount}</span>
        </div>
      )}
    </div>
  );
};

export const StockCategoryChart: React.FC<StockCategoryChartProps> = ({
  products,
  activeCategory,
  onSelectCategory,
}) => {
  const { categoryData, totalVolume, totalValueFcfa, dominant } = useMemo(() => {
    const totals = new Map<
      ProductCategory,
      { totalQuantity: number; productCount: number; lowStockCount: number; stockValueFcfa: number }
    >();

    for (const meta of CATEGORY_META) {
      totals.set(meta.category, {
        totalQuantity: 0,
        productCount: 0,
        lowStockCount: 0,
        stockValueFcfa: 0,
      });
    }

    for (const p of products) {
      const bucket = totals.get(p.category);
      if (!bucket) continue;
      const qty = Math.max(0, Number(p.quantity || 0));
      bucket.totalQuantity += qty;
      bucket.productCount += 1;
      if (qty <= p.minThreshold) {
        bucket.lowStockCount += 1;
      }
      bucket.stockValueFcfa += qty * Math.max(0, Number(p.unitPriceFcfa || 0));
    }

    let volumeSum = 0;
    let valueSum = 0;
    totals.forEach((b) => {
      volumeSum += b.totalQuantity;
      valueSum += b.stockValueFcfa;
    });

    const rows: CategoryDatum[] = CATEGORY_META.map((meta) => {
      const b = totals.get(meta.category)!;
      const sharePct = volumeSum > 0 ? Math.round((b.totalQuantity / volumeSum) * 1000) / 10 : 0;
      return {
        category: meta.category,
        label: meta.label,
        shortLabel: meta.shortLabel,
        color: meta.color,
        totalQuantity: b.totalQuantity,
        productCount: b.productCount,
        lowStockCount: b.lowStockCount,
        stockValueFcfa: b.stockValueFcfa,
        sharePct,
      };
    }).sort((a, b) => b.totalQuantity - a.totalQuantity || b.productCount - a.productCount);

    const top = rows[0] && rows[0].totalQuantity > 0 ? rows[0] : null;
    return {
      categoryData: rows,
      totalVolume: volumeSum,
      totalValueFcfa: valueSum,
      dominant: top,
    };
  }, [products]);

  const formatXAxis = (value: number) => {
    if (value === 0) return '0';
    if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
    return String(value);
  };

  const handleToggleCategory = (cat: ProductCategory) => {
    onSelectCategory(activeCategory === cat ? 'all' : cat);
  };

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4"
      aria-label="Répartition du volume de stock par catégorie"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-[#1E293B]">
            Répartition du stock par catégorie
          </h2>
          {products.length === 0 ? (
            <p className="text-xs text-slate-500 mt-0.5">
              Ajoutez des articles au catalogue pour visualiser la répartition des volumes par catégorie.
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-0.5">
              Volume total :{' '}
              <span className="font-mono-num font-semibold text-[#1E293B]">
                {totalVolume.toLocaleString('fr-FR')} unités
              </span>
              <span aria-hidden="true"> · </span>
              Valorisation :{' '}
              <span className="font-mono-num font-semibold text-[#2E7D32]">{formatFcfa(totalValueFcfa)}</span>
              {dominant && (
                <>
                  <span aria-hidden="true"> · </span>
                  Catégorie dominante :{' '}
                  <span className="font-semibold text-[#1E293B]">
                    {dominant.label} ({dominant.sharePct.toFixed(1)} %)
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        {activeCategory !== 'all' && (
          <button
            type="button"
            onClick={() => onSelectCategory('all')}
            className="self-start sm:self-auto text-xs font-semibold text-[#1A73E8] hover:underline whitespace-nowrap shrink-0"
          >
            Réinitialiser le filtre
          </button>
        )}
      </div>

      {products.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 w-full h-56 min-w-0">
            <ResponsiveContainer width="100%" height={224} minWidth={0}>
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
                barCategoryGap="22%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatXAxis}
                  allowDecimals={false}
                  tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={136}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#1E293B', fontSize: 12, fontWeight: 500 }}
                />
                <Tooltip cursor={{ fill: '#F8FAFC' }} content={<CustomCategoryTooltip />} />
                <Bar
                  dataKey="totalQuantity"
                  name="Volume en stock"
                  radius={[0, 6, 6, 0]}
                  barSize={26}
                  className="cursor-pointer"
                  onClick={(_, index) => {
                    const row = categoryData[index];
                    if (row) handleToggleCategory(row.category);
                  }}
                >
                  {categoryData.map((entry) => {
                    const isDimmed = activeCategory !== 'all' && activeCategory !== entry.category;
                    return (
                      <Cell
                        key={entry.category}
                        fill={entry.color}
                        fillOpacity={isDimmed ? 0.3 : 1}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-5 divide-y divide-slate-100 border-t border-slate-100 lg:border-t-0">
            {categoryData.map((row) => {
              const isSelected = activeCategory === row.category;
              const isDimmed = activeCategory !== 'all' && !isSelected;
              return (
                <button
                  key={row.category}
                  type="button"
                  onClick={() => handleToggleCategory(row.category)}
                  className={`w-full flex items-center justify-between gap-3 py-2.5 px-2 text-left rounded-lg transition-colors hover:bg-slate-50 ${
                    isSelected ? 'bg-slate-50' : ''
                  } ${isDimmed ? 'opacity-55' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className="text-sm font-semibold text-[#1E293B] truncate">{row.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 pl-4.5 mt-0.5 font-mono-num">
                      {row.productCount} {row.productCount > 1 ? 'articles' : 'article'}
                      <span aria-hidden="true"> · </span>
                      {formatFcfa(row.stockValueFcfa)}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono-num text-sm font-bold text-[#1E293B]">
                      {row.totalQuantity.toLocaleString('fr-FR')}{' '}
                      <span className="text-xs font-normal text-slate-500">u.</span>
                    </div>
                    <div className="font-mono-num text-xs font-semibold text-slate-500">
                      {row.sharePct.toFixed(1)} %
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
