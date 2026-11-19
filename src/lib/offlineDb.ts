import Dexie, { type Table } from 'dexie';
import type {
  AttendanceRecord,
  AuditLog,
  CashClosing,
  DebtPayment,
  Debtor,
  Organization,
  OrgMember,
  Product,
  Sale,
  StockMovement,
  SyncQueueItem,
  Worker,
} from '../types/agrikoom';

class AgriKoomOfflineDB extends Dexie {
  organizations!: Table<Organization, string>;
  members!: Table<OrgMember & { id: string; orgId: string }, string>;
  products!: Table<Product, string>;
  movements!: Table<StockMovement, string>;
  sales!: Table<Sale, string>;
  debtors!: Table<Debtor, string>;
  debtPayments!: Table<DebtPayment, string>;
  workers!: Table<Worker, string>;
  attendance!: Table<AttendanceRecord, string>;
  cashClosings!: Table<CashClosing, string>;
  auditLogs!: Table<AuditLog, string>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('agrikoom_offline_db');
    this.version(1).stores({
      organizations: 'id, ownerId',
      members: 'id, orgId, uid, role',
      products: 'id, orgId, category, name',
      movements: 'id, orgId, productId, createdAt',
      sales: 'id, orgId, status, createdAt',
      debtors: 'id, orgId, status, fullName',
      debtPayments: 'id, orgId, debtorId, createdAt',
      workers: 'id, orgId, contractType, active',
      attendance: 'id, orgId, workerId, workDate, paidOut',
      cashClosings: 'id, orgId, closingDate',
      auditLogs: 'id, orgId, entityType, createdAt',
      syncQueue: '++id, orgId, collectionName, docId, createdAt',
    });
  }
}

export const offlineDb = new AgriKoomOfflineDB();

export async function enqueueOfflineWrite(item: Omit<SyncQueueItem, 'id'>): Promise<void> {
  await offlineDb.syncQueue.add(item);
}

export async function getPendingSyncCount(orgId?: string): Promise<number> {
  if (orgId) {
    return offlineDb.syncQueue.where('orgId').equals(orgId).count();
  }
  return offlineDb.syncQueue.count();
}
