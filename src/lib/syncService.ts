import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { enqueueOfflineWrite, offlineDb } from './offlineDb';
import { buildPilotCooperativeSeed, type SeedOnboardingOptions } from './seedData';
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
  Worker,
} from '../types/agrikoom';

function normalizeDocData<T>(data: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...data };
  for (const key of ['createdAt', 'updatedAt']) {
    const val = out[key];
    if (val instanceof Timestamp) {
      out[key] = val.toDate().toISOString();
    } else if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
      out[key] = (val as { toDate: () => Date }).toDate().toISOString();
    } else if (!val) {
      out[key] = new Date().toISOString();
    }
  }
  return out as T;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean;
}

function toFirestoreCreatePayload(obj: Record<string, unknown>, hasUpdatedAt = true): Record<string, unknown> {
  const clean = stripUndefined(obj);
  delete clean.orgId; // path already encodes orgId; keep blueprint keys strict
  clean.createdAt = serverTimestamp();
  if (hasUpdatedAt) {
    clean.updatedAt = serverTimestamp();
  } else {
    delete clean.updatedAt;
  }
  return clean;
}

export async function ensureUserProfileAndSeed(
  uid: string,
  email: string,
  displayName: string,
  onboardingOptions?: SeedOnboardingOptions,
  phone?: string
): Promise<Organization[]> {
  const userPath = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const existingOrgsSnap = await getDocs(
      query(collection(db, 'organizations'), where('memberUids', 'array-contains', uid))
    );

    const orgs: Organization[] = existingOrgsSnap.docs.map((d) =>
      normalizeDocData<Organization>(d.data())
    );

    if (orgs.length === 0) {
      const resolvedPhone = (phone || onboardingOptions?.phone || '').trim().slice(0, 30);
      const resolvedEmail = (email || '').trim().slice(0, 200);
      const seed = buildPilotCooperativeSeed(uid, displayName, {
        ...onboardingOptions,
        phone: resolvedPhone || onboardingOptions?.phone,
      });
      // 1. Create User Profile
      await setDoc(userRef, {
        uid,
        ...(resolvedEmail ? { email: resolvedEmail } : {}),
        ...(resolvedPhone ? { phone: resolvedPhone } : {}),
        displayName: (displayName || resolvedEmail.split('@')[0] || resolvedPhone || 'Président').slice(0, 120),
        defaultOrgId: seed.org.id,
        locale: 'fr',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Create Organization Root FIRST (Master Gate requires parent doc to exist before subcollections)
      await setDoc(
        doc(db, 'organizations', seed.org.id),
        toFirestoreCreatePayload(seed.org as unknown as Record<string, unknown>, true)
      );

      // 3. Seed subcollections in a batch
      const batch = writeBatch(db);
      for (const m of seed.members) {
        batch.set(
          doc(db, 'organizations', seed.org.id, 'members', m.id),
          toFirestoreCreatePayload(m as unknown as Record<string, unknown>, true)
        );
      }
      for (const p of seed.products) {
        batch.set(
          doc(db, 'organizations', seed.org.id, 'products', p.id),
          toFirestoreCreatePayload(p as unknown as Record<string, unknown>, true)
        );
      }
      for (const d of seed.debtors) {
        batch.set(
          doc(db, 'organizations', seed.org.id, 'debtors', d.id),
          toFirestoreCreatePayload(d as unknown as Record<string, unknown>, true)
        );
      }
      for (const dp of seed.debtPayments) {
        batch.set(
          doc(db, 'organizations', seed.org.id, 'debtPayments', dp.id),
          toFirestoreCreatePayload(dp as unknown as Record<string, unknown>, false)
        );
      }
      for (const s of seed.sales) {
        batch.set(
          doc(db, 'organizations', seed.org.id, 'sales', s.id),
          toFirestoreCreatePayload(s as unknown as Record<string, unknown>, true)
        );
      }
      for (const mv of seed.movements) {
        batch.set(
          doc(db, 'organizations', seed.org.id, 'movements', mv.id),
          toFirestoreCreatePayload(mv as unknown as Record<string, unknown>, false)
        );
      }
      for (const w of seed.workers) {
        batch.set(
          doc(db, 'organizations', seed.org.id, 'workers', w.id),
          toFirestoreCreatePayload(w as unknown as Record<string, unknown>, true)
        );
      }
      for (const a of seed.attendance) {
        batch.set(
          doc(db, 'organizations', seed.org.id, 'attendance', a.id),
          toFirestoreCreatePayload(a as unknown as Record<string, unknown>, true)
        );
      }
      for (const al of seed.auditLogs) {
        batch.set(
          doc(db, 'organizations', seed.org.id, 'auditLogs', al.id),
          toFirestoreCreatePayload(al as unknown as Record<string, unknown>, false)
        );
      }
      await batch.commit();

      // Cache locally in Dexie
      await offlineDb.organizations.put(seed.org);
      await offlineDb.members.bulkPut(seed.members);
      await offlineDb.products.bulkPut(seed.products);
      await offlineDb.debtors.bulkPut(seed.debtors);
      await offlineDb.debtPayments.bulkPut(seed.debtPayments);
      await offlineDb.sales.bulkPut(seed.sales);
      await offlineDb.movements.bulkPut(seed.movements);
      await offlineDb.workers.bulkPut(seed.workers);
      await offlineDb.attendance.bulkPut(seed.attendance);
      await offlineDb.auditLogs.bulkPut(seed.auditLogs);

      return [seed.org];
    }

    // Ensure user profile exists without mutating createdAt on returning users
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid,
        email,
        displayName: displayName || email.split('@')[0],
        defaultOrgId: orgs[0].id,
        locale: 'fr',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName: displayName || email.split('@')[0],
        defaultOrgId: orgs[0].id,
        updatedAt: serverTimestamp(),
      });
    }

    await offlineDb.organizations.bulkPut(orgs);
    return orgs;
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : '';
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    const isNetworkUnavailable =
      !navigator.onLine || code === 'unavailable' || msg.includes('unavailable') || msg.includes('offline');
    if (isNetworkUnavailable) {
      const cachedOrgs = await offlineDb.organizations.toArray();
      const userOrgs = cachedOrgs.filter((o) => o.ownerId === uid || o.memberUids.includes(uid));
      if (userOrgs.length > 0) return userOrgs;
    }
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function createNewOrganization(
  ownerUid: string,
  ownerName: string,
  input: {
    name: string;
    orgType: Organization['orgType'];
    region: string;
    phone?: string;
    whatsappNumber?: string;
  }
): Promise<Organization> {
  const nowIso = new Date().toISOString();
  const orgId = `org_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const org: Organization = {
    id: orgId,
    name: input.name.trim(),
    orgType: input.orgType,
    region: input.region.trim(),
    phone: input.phone?.trim() || '',
    ownerId: ownerUid,
    memberUids: [ownerUid],
    whatsappNumber: input.whatsappNumber?.trim() || input.phone?.trim() || '',
    whatsappReportTime: '18:00',
    whatsappPreferences: {
      includeRevenue: true,
      includeTreasury: true,
      includeDebts: true,
      includeStockAlerts: true,
      includePayroll: true,
      weeklySummary: true,
      monthlySummary: true,
    },
    subscriptionStatus: 'trial',
    planAmountUsd: 49,
    paymentChannel: 'wave',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const adminMember: OrgMember & { id: string; orgId: string } = {
    id: ownerUid,
    orgId,
    uid: ownerUid,
    orgOwnerId: ownerUid,
    memberUids: [ownerUid],
    name: ownerName || 'Président / Admin',
    role: 'admin',
    pinCode: '1234',
    phone: input.phone?.trim() || '',
    active: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const path = `organizations/${orgId}`;
  try {
    await setDoc(doc(db, 'organizations', orgId), toFirestoreCreatePayload(org as unknown as Record<string, unknown>, true));
    await setDoc(
      doc(db, 'organizations', orgId, 'members', ownerUid),
      toFirestoreCreatePayload(adminMember as unknown as Record<string, unknown>, true)
    );
    await offlineDb.organizations.put(org);
    await offlineDb.members.put(adminMember);
    return org;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export interface OrgSubscriptions {
  unsubscribeAll: () => void;
}

export function subscribeToOrganizationData(
  orgId: string,
  callbacks: {
    onMembers: (items: Array<OrgMember & { id: string; orgId: string }>) => void;
    onProducts: (items: Product[]) => void;
    onMovements: (items: StockMovement[]) => void;
    onSales: (items: Sale[]) => void;
    onDebtors: (items: Debtor[]) => void;
    onDebtPayments: (items: DebtPayment[]) => void;
    onWorkers: (items: Worker[]) => void;
    onAttendance: (items: AttendanceRecord[]) => void;
    onCashClosings: (items: CashClosing[]) => void;
    onAuditLogs: (items: AuditLog[]) => void;
  },
  uid: string
): OrgSubscriptions {
  const unsubs: Unsubscribe[] = [];

  const subCollection = <T extends { id: string }>(
    colName: string,
    dexieTable: {
      where: (k: string) => { equals: (v: string) => { toArray: () => Promise<T[]> } };
      bulkPut: (items: T[]) => Promise<unknown>;
    },
    onData: (items: T[]) => void
  ) => {
    // Load local IndexedDB immediately (<20ms) for instant offline-first UI
    dexieTable
      .where('orgId')
      .equals(orgId)
      .toArray()
      .then((cached) => {
        if (cached.length > 0) onData(cached);
      })
      .catch(() => {});

    const path = `organizations/${orgId}/${colName}`;
    const q = query(collection(db, 'organizations', orgId, colName), where('memberUids', 'array-contains', uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => {
          const normalized = normalizeDocData<T>(d.data());
          return { ...normalized, id: d.id, orgId } as T;
        });
        items.sort((a, b) => {
          const aTime = String((a as unknown as { createdAt?: string }).createdAt || '');
          const bTime = String((b as unknown as { createdAt?: string }).createdAt || '');
          return bTime.localeCompare(aTime);
        });
        dexieTable.bulkPut(items).catch(() => {});
        onData(items);
      },
      (error) => {
        const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : '';
        if (code === 'unavailable') {
          console.warn(`Firestore unavailable for ${path}; operating on IndexedDB offline cache.`);
          return;
        }
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
    unsubs.push(unsub);
  };

  subCollection('members', offlineDb.members, callbacks.onMembers);
  subCollection('products', offlineDb.products, callbacks.onProducts);
  subCollection('movements', offlineDb.movements, callbacks.onMovements);
  subCollection('sales', offlineDb.sales, callbacks.onSales);
  subCollection('debtors', offlineDb.debtors, callbacks.onDebtors);
  subCollection('debtPayments', offlineDb.debtPayments, callbacks.onDebtPayments);
  subCollection('workers', offlineDb.workers, callbacks.onWorkers);
  subCollection('attendance', offlineDb.attendance, callbacks.onAttendance);
  subCollection('cashClosings', offlineDb.cashClosings, callbacks.onCashClosings);
  subCollection('auditLogs', offlineDb.auditLogs, callbacks.onAuditLogs);

  return {
    unsubscribeAll: () => {
      unsubs.forEach((u) => u());
    },
  };
}

const APPEND_ONLY_COLLECTIONS = new Set(['movements', 'debtPayments', 'cashClosings', 'auditLogs']);

export async function writeOrgEntity<T extends Record<string, unknown>>(
  orgId: string,
  collectionName: string,
  docId: string,
  data: T,
  operation: 'set' | 'update' = 'set',
  isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
): Promise<void> {
  const path = `organizations/${orgId}/${collectionName}/${docId}`;
  const hasUpdatedAt = !APPEND_ONLY_COLLECTIONS.has(collectionName);

  // 1. Update IndexedDB immediately (<10ms)
  const localRecord = { ...data, id: docId, orgId };
  const tableMap: Record<string, typeof offlineDb.products> = {
    members: offlineDb.members as unknown as typeof offlineDb.products,
    products: offlineDb.products,
    movements: offlineDb.movements as unknown as typeof offlineDb.products,
    sales: offlineDb.sales as unknown as typeof offlineDb.products,
    debtors: offlineDb.debtors as unknown as typeof offlineDb.products,
    debtPayments: offlineDb.debtPayments as unknown as typeof offlineDb.products,
    workers: offlineDb.workers as unknown as typeof offlineDb.products,
    attendance: offlineDb.attendance as unknown as typeof offlineDb.products,
    cashClosings: offlineDb.cashClosings as unknown as typeof offlineDb.products,
    auditLogs: offlineDb.auditLogs as unknown as typeof offlineDb.products,
  };
  const table = tableMap[collectionName];
  if (table) {
    if (operation === 'set') {
      await table.put(localRecord as unknown as Product);
    } else {
      await table.update(docId, localRecord as unknown as Partial<Product>);
    }
  }

  // 2. If offline, queue for background sync
  if (!isOnline) {
    await enqueueOfflineWrite({
      orgId,
      collectionName,
      docId,
      operation,
      payload: data,
      createdAt: new Date().toISOString(),
    });
    return;
  }

  // 3. Push to Firestore
  const ref = doc(db, 'organizations', orgId, collectionName, docId);
  try {
    if (operation === 'set') {
      await setDoc(ref, toFirestoreCreatePayload(data, hasUpdatedAt));
    } else {
      const updatePayload = stripUndefined({ ...data });
      delete updatePayload.orgId;
      delete updatePayload.id;
      delete updatePayload.createdAt;
      delete updatePayload.orgOwnerId;
      updatePayload.updatedAt = serverTimestamp();
      await updateDoc(ref, updatePayload);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (msg.includes('offline') || msg.includes('network') || msg.includes('unavailable')) {
      await enqueueOfflineWrite({
        orgId,
        collectionName,
        docId,
        operation,
        payload: data,
        createdAt: new Date().toISOString(),
      });
      return;
    }
    handleFirestoreError(error, operation === 'set' ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function updateOrganizationSettings(
  orgId: string,
  updates: Partial<
    Pick<
      Organization,
      | 'name'
      | 'region'
      | 'phone'
      | 'whatsappNumber'
      | 'whatsappReportTime'
      | 'whatsappPreferences'
      | 'paymentChannel'
      | 'subscriptionStatus'
      | 'subscriptionPlan'
      | 'planAmountUsd'
    >
  >,
  isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
): Promise<void> {
  const path = `organizations/${orgId}`;
  const nowIso = new Date().toISOString();
  await offlineDb.organizations.update(orgId, { ...updates, updatedAt: nowIso });

  const clean = stripUndefined(updates as Record<string, unknown>);
  if (!isOnline) {
    await enqueueOfflineWrite({
      orgId,
      collectionName: '__org_root__',
      docId: orgId,
      operation: 'update',
      payload: clean,
      createdAt: nowIso,
    });
    return;
  }

  try {
    await updateDoc(doc(db, 'organizations', orgId), {
      ...clean,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (msg.includes('offline') || msg.includes('network') || msg.includes('unavailable')) {
      await enqueueOfflineWrite({
        orgId,
        collectionName: '__org_root__',
        docId: orgId,
        operation: 'update',
        payload: clean,
        createdAt: nowIso,
      });
      return;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteOrgEntity(
  orgId: string,
  collectionName: string,
  docId: string
): Promise<void> {
  const path = `organizations/${orgId}/${collectionName}/${docId}`;
  try {
    await deleteDoc(doc(db, 'organizations', orgId, collectionName, docId));
    if (collectionName === 'products') await offlineDb.products.delete(docId);
    if (collectionName === 'workers') await offlineDb.workers.delete(docId);
    if (collectionName === 'members') await offlineDb.members.delete(docId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function flushSyncQueue(): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;
  const pending = await offlineDb.syncQueue.orderBy('id').toArray();
  let syncedCount = 0;

  for (const item of pending) {
    if (item.collectionName === '__org_root__') {
      try {
        const updatePayload = stripUndefined({ ...item.payload });
        updatePayload.updatedAt = serverTimestamp();
        await updateDoc(doc(db, 'organizations', item.orgId), updatePayload);
        if (item.id !== undefined) {
          await offlineDb.syncQueue.delete(item.id);
        }
        syncedCount++;
      } catch (error) {
        console.error('Sync org update failed, keeping in queue:', item, error);
        break;
      }
      continue;
    }

    const hasUpdatedAt = !APPEND_ONLY_COLLECTIONS.has(item.collectionName);
    const ref = doc(db, 'organizations', item.orgId, item.collectionName, item.docId);
    try {
      if (item.operation === 'set') {
        await setDoc(ref, toFirestoreCreatePayload(item.payload, hasUpdatedAt));
      } else if (item.operation === 'update') {
        const updatePayload = stripUndefined({ ...item.payload });
        delete updatePayload.orgId;
        delete updatePayload.id;
        delete updatePayload.createdAt;
        delete updatePayload.orgOwnerId;
        updatePayload.updatedAt = serverTimestamp();
        await updateDoc(ref, updatePayload);
      } else if (item.operation === 'delete') {
        await deleteDoc(ref);
      }
      if (item.id !== undefined) {
        await offlineDb.syncQueue.delete(item.id);
      }
      syncedCount++;
    } catch (error) {
      console.error('Sync item failed, keeping in queue:', item, error);
      break;
    }
  }
  return syncedCount;
}

export async function fetchAllOrganizationsForSuperAdmin(): Promise<Organization[]> {
  try {
    const snap = await getDocs(collection(db, 'organizations'));
    return snap.docs.map((d) => normalizeDocData<Organization>(d.data()));
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : '';
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (!navigator.onLine || code === 'unavailable' || msg.includes('unavailable') || msg.includes('offline')) {
      const cached = await offlineDb.organizations.toArray();
      if (cached.length > 0) return cached;
    }
    handleFirestoreError(error, OperationType.LIST, 'organizations');
  }
}
