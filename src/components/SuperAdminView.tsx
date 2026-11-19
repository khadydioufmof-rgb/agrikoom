import React, { useState } from 'react';
import { Building2, CheckCircle2, Plus, TrendingUp } from 'lucide-react';
import { formatFcfa } from '../i18n/translations';
import { getSubscriptionPlan, inferSubscriptionPlan, toMonthlyEquivalentFcfa } from '../lib/subscriptionPlans';
import type { Organization } from '../types/agrikoom';

interface SuperAdminViewProps {
  organizations: Organization[];
  activeOrgId: string;
  onSelectOrg: (orgId: string) => void;
  onCreateOrg: (input: {
    name: string;
    orgType: Organization['orgType'];
    region: string;
    phone: string;
    whatsappNumber: string;
  }) => Promise<void>;
  onUpdateSubscription: (orgId: string, status: Organization['subscriptionStatus']) => Promise<void>;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({
  organizations,
  activeOrgId,
  onSelectOrg,
  onCreateOrg,
  onUpdateSubscription,
}) => {
  const [name, setName] = useState('');
  const [orgType, setOrgType] = useState<Organization['orgType']>('cooperative');
  const [region, setRegion] = useState('');
  const [phone, setPhone] = useState('+221 77 ');
  const [creating, setCreating] = useState(false);

  const activeOrgs = organizations.filter((o) => o.subscriptionStatus === 'active');
  const currentMrrFcfa = activeOrgs.reduce(
    (sum, o) => sum + toMonthlyEquivalentFcfa(o.subscriptionPlan, o.planAmountUsd),
    0
  );
  const targetCoops = 70;
  const targetMrrFcfa = 2100000;
  const progressPct = Math.min(100, Math.round((organizations.length / targetCoops) * 100));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await onCreateOrg({
        name,
        orgType,
        region,
        phone,
        whatsappNumber: phone,
      });
      setName('');
      setRegion('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#1E293B]">Console Super-Admin AgriKoom</h1>
        <p className="text-xs text-slate-500">
          Supervision multi-tenant des coopératives, facturation B2B SaaS (dès 24 000 FCFA / mois) et onboarding terrain
        </p>
      </div>

      {/* Commercial Roadmap KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Organisations Actives</span>
            <Building2 className="h-4 w-4 text-[#2E7D32]" />
          </div>
          <p className="mt-2 font-mono-num text-2xl font-bold text-[#1E293B]">
            {organizations.length} <span className="text-sm font-normal text-slate-500">/ {targetCoops} objectif</span>
          </p>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div style={{ width: `${Math.max(4, progressPct)}%` }} className="h-full bg-[#2E7D32]" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">MRR Récurrent</span>
            <TrendingUp className="h-4 w-4 text-[#1A73E8]" />
          </div>
          <p className="mt-2 font-mono-num text-2xl font-bold text-[#1A73E8]">
            {formatFcfa(currentMrrFcfa)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono-num">
            Objectif : {formatFcfa(targetMrrFcfa)} / mois
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-medium text-slate-500">Zones Pilotes Sénégal</span>
          <p className="mt-2 text-sm font-bold text-[#1E293B]">Niayes · Vallée du Fleuve · Casamance</p>
          <p className="mt-1 text-xs text-slate-500">Encaissement Wave Business &amp; Orange Money</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Organizations List */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-display text-base font-bold text-[#1E293B]">Coopératives &amp; Fermes Enregistrées</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {organizations.map((o) => (
              <div key={o.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold text-[#1E293B]">{o.name}</span>
                    {o.id === activeOrgId && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E7D32]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Ouverte
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {o.region} · {o.orgType} ·{' '}
                    {getSubscriptionPlan(inferSubscriptionPlan(o.subscriptionPlan, o.planAmountUsd)).labelFr} (
                    {formatFcfa(
                      getSubscriptionPlan(inferSubscriptionPlan(o.subscriptionPlan, o.planAmountUsd)).amountFcfa
                    )}
                    ) · {o.paymentChannel || 'wave'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={o.subscriptionStatus}
                    onChange={(e) => onUpdateSubscription(o.id, e.target.value as Organization['subscriptionStatus'])}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold"
                  >
                    <option value="active">Active</option>
                    <option value="trial">Pilote / Essai</option>
                    <option value="past_due">Impayé</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => onSelectOrg(o.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-[#1E293B] hover:bg-slate-50 min-h-[38px]"
                  >
                    Basculer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Onboard New Organization */}
        <form onSubmit={handleSubmit} className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 space-y-4 h-fit">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-[#2E7D32]" />
            <h2 className="font-display text-base font-bold text-[#1E293B]">Onboarder une Coopérative</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nom de la coopérative / ferme</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Ferme Avicole Casamance" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Type d&apos;entité</label>
                <select value={orgType} onChange={(e) => setOrgType(e.target.value as Organization['orgType'])} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]">
                  <option value="cooperative">Coopérative</option>
                  <option value="gie">GIE</option>
                  <option value="ferme">Ferme</option>
                  <option value="transformation">Unité Transformation</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Région / Zone</label>
                <input required value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Ex: Ziguinchor, Sénégal" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Téléphone WhatsApp Président</label>
              <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]" />
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-xl bg-[#2E7D32] py-3 text-sm font-semibold text-white hover:bg-[#256428] disabled:opacity-60 min-h-[48px]"
          >
            {creating ? 'Création en cours...' : 'Créer le tenant isolé'}
          </button>
        </form>
      </div>
    </div>
  );
};
