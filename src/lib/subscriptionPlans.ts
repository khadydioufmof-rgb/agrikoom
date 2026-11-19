import type { SubscriptionPlan } from '../types/agrikoom';

export interface SubscriptionPlanInfo {
  id: SubscriptionPlan;
  labelFr: string;
  labelEn: string;
  periodFr: string;
  periodEn: string;
  amountUsd: number;
  amountFcfa: number;
  monthlyEquivalentFcfa: number;
  summaryFr: string;
  summaryEn: string;
  highlightFr?: string;
  highlightEn?: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanInfo[] = [
  {
    id: 'monthly',
    labelFr: 'Mensuel',
    labelEn: 'Monthly',
    periodFr: 'par mois',
    periodEn: 'per month',
    amountUsd: 49,
    amountFcfa: 30000,
    monthlyEquivalentFcfa: 30000,
    summaryFr: 'Facturation mensuelle sans engagement',
    summaryEn: 'Flexible monthly billing',
  },
  {
    id: 'quarterly',
    labelFr: 'Trimestriel',
    labelEn: 'Quarterly',
    periodFr: 'par trimestre (3 mois)',
    periodEn: 'per quarter (3 months)',
    amountUsd: 135,
    amountFcfa: 82500,
    monthlyEquivalentFcfa: 27500,
    summaryFr: 'Soit 27 500 FCFA/mois · Économisez 8 %',
    summaryEn: '27,500 FCFA/mo equivalent · Save 8%',
    highlightFr: 'Économie 8 %',
    highlightEn: 'Save 8%',
  },
  {
    id: 'annual',
    labelFr: 'Annuel',
    labelEn: 'Annual',
    periodFr: 'par an (12 mois)',
    periodEn: 'per year (12 months)',
    amountUsd: 470,
    amountFcfa: 288000,
    monthlyEquivalentFcfa: 24000,
    summaryFr: 'Soit 24 000 FCFA/mois · 20 % offerts',
    summaryEn: '24,000 FCFA/mo equivalent · 20% off',
    highlightFr: 'Meilleur tarif · -20 %',
    highlightEn: 'Best value · -20%',
  },
];

export function getSubscriptionPlan(plan?: SubscriptionPlan): SubscriptionPlanInfo {
  return SUBSCRIPTION_PLANS.find((p) => p.id === plan) || SUBSCRIPTION_PLANS[0];
}

export function inferSubscriptionPlan(plan?: SubscriptionPlan, amountUsd?: number): SubscriptionPlan {
  if (plan === 'monthly' || plan === 'quarterly' || plan === 'annual') {
    return plan;
  }
  if (amountUsd === 135) return 'quarterly';
  if (amountUsd === 470) return 'annual';
  return 'monthly';
}

export function toMonthlyEquivalentFcfa(plan?: SubscriptionPlan, amountUsd?: number): number {
  const resolved = inferSubscriptionPlan(plan, amountUsd);
  return getSubscriptionPlan(resolved).monthlyEquivalentFcfa;
}
