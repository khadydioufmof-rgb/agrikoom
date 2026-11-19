export type Locale = 'fr' | 'en';

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'pointer';

export type ProductCategory = 'intrants' | 'provende' | 'recoltes' | 'emballages';

export type MovementType =
  | 'entree_achat'
  | 'entree_apport'
  | 'entree_recolte'
  | 'sortie_vente'
  | 'sortie_interne'
  | 'perte'
  | 'ajustement';

export type MobileMoneyProvider = 'none' | 'wave' | 'orange_money' | 'free_money' | 'mtn_momo';

export type DebtorStatus = 'en_cours' | 'partiel' | 'en_retard' | 'solde';

export type ContractType = 'permanent' | 'journalier' | 'saisonnier';

export type PayBasis = 'jour' | 'semaine' | 'tache';

export type AttendanceStatus = 'present' | 'demi_journee' | 'absent' | 'tache';

export type PaymentChannel = 'cash' | 'wave' | 'orange_money' | 'free_money';

export type SubscriptionPlan = 'monthly' | 'quarterly' | 'annual';

export interface UserProfile {
  uid: string;
  email?: string;
  phone?: string;
  displayName: string;
  defaultOrgId?: string;
  locale: Locale;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsappPreferences {
  includeRevenue: boolean;
  includeTreasury: boolean;
  includeDebts: boolean;
  includeStockAlerts: boolean;
  includePayroll: boolean;
  weeklySummary: boolean;
  monthlySummary: boolean;
}

export interface Organization {
  id: string;
  name: string;
  orgType: 'cooperative' | 'ferme' | 'gie' | 'transformation';
  region: string;
  phone?: string;
  ownerId: string;
  memberUids: string[];
  whatsappNumber?: string;
  whatsappReportTime: string;
  whatsappPreferences?: WhatsappPreferences;
  subscriptionStatus: 'active' | 'trial' | 'past_due';
  subscriptionPlan?: SubscriptionPlan;
  planAmountUsd: number;
  paymentChannel?: PaymentChannel;
  createdAt: string;
  updatedAt: string;
}

export interface OrgMember {
  uid: string;
  orgOwnerId: string;
  memberUids: string[];
  name: string;
  role: 'admin' | 'manager' | 'pointer';
  pinCode: string;
  phone?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  orgId: string;
  orgOwnerId: string;
  memberUids: string[];
  name: string;
  barcode?: string;
  category: ProductCategory;
  unit: string;
  quantity: number;
  minThreshold: number;
  unitCostFcfa: number;
  unitPriceFcfa: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  orgId: string;
  orgOwnerId: string;
  memberUids: string[];
  productId: string;
  productName: string;
  movementType: MovementType;
  quantityDelta: number;
  justification: string;
  actorName: string;
  actorUid: string;
  createdAt: string;
}

export interface Sale {
  id: string;
  orgId: string;
  orgOwnerId: string;
  memberUids: string[];
  itemsSummary: string;
  subtotalFcfa: number;
  discountFcfa: number;
  totalFcfa: number;
  cashFcfa: number;
  mobileMoneyFcfa: number;
  mobileMoneyProvider: MobileMoneyProvider;
  creditFcfa: number;
  debtorId?: string;
  debtorName?: string;
  cashierUid: string;
  cashierName: string;
  status: 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface Debtor {
  id: string;
  orgId: string;
  orgOwnerId: string;
  memberUids: string[];
  fullName: string;
  phone: string;
  zone: string;
  totalCreditFcfa: number;
  totalPaidFcfa: number;
  remainingFcfa: number;
  dueDate: string;
  status: DebtorStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DebtPayment {
  id: string;
  orgId: string;
  orgOwnerId: string;
  memberUids: string[];
  debtorId: string;
  debtorName: string;
  amountFcfa: number;
  channel: PaymentChannel;
  receiptRef: string;
  recordedByUid: string;
  recordedByName: string;
  createdAt: string;
}

export interface Worker {
  id: string;
  orgId: string;
  orgOwnerId: string;
  memberUids: string[];
  fullName: string;
  phone?: string;
  contractType: ContractType;
  payBasis: PayBasis;
  rateFcfa: number;
  advancesFcfa: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  orgId: string;
  orgOwnerId: string;
  memberUids: string[];
  workerId: string;
  workerName: string;
  workDate: string;
  status: AttendanceStatus;
  unitsCompleted: number;
  earnedFcfa: number;
  advanceGivenFcfa: number;
  paidOut: boolean;
  recordedByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface CashClosing {
  id: string;
  orgId: string;
  orgOwnerId: string;
  memberUids: string[];
  closingDate: string;
  theoreticalCashFcfa: number;
  countedCashFcfa: number;
  varianceFcfa: number;
  mobileMoneyTotalFcfa: number;
  creditTotalFcfa: number;
  note?: string;
  closedByUid: string;
  closedByName: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  orgId: string;
  orgOwnerId: string;
  memberUids: string[];
  action: string;
  entityType: string;
  summary: string;
  actorUid: string;
  actorName: string;
  createdAt: string;
}

export interface SyncQueueItem {
  id?: number;
  orgId: string;
  collectionName: string;
  docId: string;
  operation: 'set' | 'update' | 'delete';
  payload: Record<string, unknown>;
  createdAt: string;
}

export type ActiveTab = 'dashboard' | 'pos' | 'stocks' | 'debts' | 'workers' | 'reports' | 'settings' | 'super_admin';
