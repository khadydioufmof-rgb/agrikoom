import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  RecaptchaVerifier,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  updateProfile,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import {
  BarChart3,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Package,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wallet,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { AgriKoomLogo } from './components/AgriKoomLogo';
import {
  AuthLanding,
  type EmailSignInPayload,
  type EmailSignUpPayload,
  type PhoneOtpRequestPayload,
} from './components/AuthLanding';
import { DashboardView } from './components/DashboardView';
import { DebtsView } from './components/DebtsView';
import { OrgSettingsView } from './components/OrgSettingsView';
import { PinLockModal } from './components/PinLockModal';
import { PosView } from './components/PosView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ReportsView } from './components/ReportsView';
import { StockView } from './components/StockView';
import { SuperAdminView } from './components/SuperAdminView';
import { WorkersView } from './components/WorkersView';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { translations } from './i18n/translations';
import { auth } from './lib/firebase';
import { getPendingSyncCount } from './lib/offlineDb';
import type { SeedOnboardingOptions } from './lib/seedData';
import {
  createNewOrganization,
  ensureUserProfileAndSeed,
  fetchAllOrganizationsForSuperAdmin,
  flushSyncQueue,
  subscribeToOrganizationData,
  updateOrganizationSettings,
  writeOrgEntity,
} from './lib/syncService';
import type {
  ActiveTab,
  AttendanceRecord,
  AttendanceStatus,
  AuditLog,
  CashClosing,
  ContractType,
  DebtPayment,
  Debtor,
  DebtorStatus,
  Locale,
  MobileMoneyProvider,
  MovementType,
  OrgMember,
  Organization,
  PayBasis,
  PaymentChannel,
  Product,
  ProductCategory,
  Sale,
  StockMovement,
  SubscriptionPlan,
  UserRole,
  Worker,
} from './types/agrikoom';

const SUPER_ADMIN_EMAIL = 'bishflix2@gmail.com';
const ONBOARDING_STORAGE_PREFIX = 'agrikoom_onboarding_';

function saveOnboardingDraft(uid: string, draft: SeedOnboardingOptions) {
  try {
    localStorage.setItem(`${ONBOARDING_STORAGE_PREFIX}${uid}`, JSON.stringify(draft));
  } catch {
    // ignore storage quota errors
  }
}

function readOnboardingDraft(uid: string): SeedOnboardingOptions | undefined {
  try {
    const raw = localStorage.getItem(`${ONBOARDING_STORAGE_PREFIX}${uid}`);
    if (!raw) return undefined;
    return JSON.parse(raw) as SeedOnboardingOptions;
  } catch {
    return undefined;
  }
}

function clearOnboardingDraft(uid: string) {
  try {
    localStorage.removeItem(`${ONBOARDING_STORAGE_PREFIX}${uid}`);
  } catch {
    // ignore
  }
}

function isVerifiedAuthSession(user: User | null): boolean {
  return Boolean(user && (user.emailVerified || user.phoneNumber));
}

function normalizePhoneE164(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, '');
  let candidate = cleaned;
  if (candidate.startsWith('00')) {
    candidate = `+${candidate.slice(2)}`;
  } else if (/^[73][0-9]{8}$/.test(candidate)) {
    // 9-digit Senegal number without country code -> default +221
    candidate = `+221${candidate}`;
  }
  return /^\+[1-9][0-9]{7,14}$/.test(candidate) ? candidate : null;
}

function formatFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Cette adresse e-mail est déjà associée à un compte. Basculez sur « Se connecter ».';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Identifiants incorrects. Vérifiez vos informations et réessayez.';
    case 'auth/weak-password':
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    case 'auth/invalid-email':
      return 'Veuillez saisir une adresse e-mail valide.';
    case 'auth/invalid-phone-number':
    case 'auth/missing-phone-number':
      return 'Numéro de téléphone invalide. Utilisez le format international avec indicatif (ex : +221 77 450 28 19).';
    case 'auth/invalid-verification-code':
      return 'Code SMS incorrect. Vérifiez les 6 chiffres reçus par SMS.';
    case 'auth/code-expired':
      return 'Le code SMS a expiré. Cliquez sur « Renvoyer le code ».';
    case 'auth/captcha-check-failed':
      return 'Échec de la vérification anti-robot reCAPTCHA. Réessayez ou rechargez la page.';
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
      return 'Trop de tentatives ou quota SMS atteint. Patientez quelques instants avant de réessayer.';
    case 'auth/billing-not-enabled':
      return 'L’envoi de SMS réels nécessite d’activer le fournisseur Téléphone (ou les numéros de test) dans Firebase Console > Authentication > Sign-in method > Téléphone.';
    case 'auth/unauthorized-domain':
      return 'Ce domaine doit être ajouté dans Firebase Console > Authentication > Settings > Authorized domains.';
    case 'auth/operation-not-allowed':
      return 'Le fournisseur « Téléphone » doit être activé dans Firebase Console (Authentication > Sign-in method > Téléphone).';
    default:
      return err instanceof Error ? err.message : 'Erreur d’authentification. Veuillez réessayer.';
  }
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [pendingVerificationPlan, setPendingVerificationPlan] = useState<SubscriptionPlan | undefined>(
    undefined
  );
  const [phoneOtpTarget, setPhoneOtpTarget] = useState<string | null>(null);
  const phoneConfirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const pendingPhoneDraftRef = useRef<(SeedOnboardingOptions & { displayName?: string }) | undefined>(
    undefined
  );

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>('');
  const [dataLoading, setDataLoading] = useState(false);

  // Active role & workstation actor (PIN switchable)
  const [activeRole, setActiveRole] = useState<UserRole>('admin');
  const [activeActorName, setActiveActorName] = useState<string>('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [locale, setLocale] = useState<Locale>('fr');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [debtsInitialFilter, setDebtsInitialFilter] = useState<'all' | DebtorStatus>('all');
  const [viewingSite, setViewingSite] = useState(false);
  const [signedOutNotice, setSignedOutNotice] = useState(false);

  const handleNavigateTab = useCallback((tab: ActiveTab) => {
    setDebtsInitialFilter('all');
    setActiveTab(tab);
  }, []);

  const handleNavigateToDebts = useCallback((status: 'all' | DebtorStatus = 'all') => {
    setDebtsInitialFilter(status);
    setActiveTab('debts');
  }, []);

  // Organization collections
  const [members, setMembers] = useState<Array<OrgMember & { id: string; orgId: string }>>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [cashClosings, setCashClosings] = useState<CashClosing[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Offline & Sync tracking
  const { effectiveOnline, simulatedOffline, setSimulatedOffline } = useOnlineStatus();
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const isSuperAdminEmail =
    (authUser?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL && Boolean(authUser?.emailVerified);

  const activeOrg = useMemo(
    () => organizations.find((o) => o.id === activeOrgId) || organizations[0] || null,
    [organizations, activeOrgId]
  );

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingSyncCount();
    setPendingSyncCount(count);
  }, []);

  const loadVerifiedUserWorkspace = useCallback(async (user: User) => {
    setDataLoading(true);
    const phoneDraft = pendingPhoneDraftRef.current;
    const resolvedDisplayName =
      user.displayName ||
      phoneDraft?.displayName ||
      user.email?.split('@')[0] ||
      user.phoneNumber ||
      'Président';
    setActiveActorName(resolvedDisplayName);
    setActiveRole('admin');
    try {
      const storedDraft = readOnboardingDraft(user.uid);
      const onboardingOptions = storedDraft || phoneDraft;
      let orgs = await ensureUserProfileAndSeed(
        user.uid,
        user.email || '',
        resolvedDisplayName,
        onboardingOptions,
        user.phoneNumber || phoneDraft?.phone
      );
      clearOnboardingDraft(user.uid);
      pendingPhoneDraftRef.current = undefined;
      if ((user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL && user.emailVerified) {
        const allOrgs = await fetchAllOrganizationsForSuperAdmin();
        if (allOrgs.length > 0) orgs = allOrgs;
      }
      setOrganizations(orgs);
      if (orgs.length > 0) {
        setActiveOrgId((prev) => prev || orgs[0].id);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Erreur lors du chargement de la coopérative.');
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (user) {
        if (!isVerifiedAuthSession(user)) {
          const draft = readOnboardingDraft(user.uid);
          setPendingVerificationEmail(user.email || null);
          setPendingVerificationPlan(draft?.subscriptionPlan);
          setOrganizations([]);
          setActiveOrgId('');
          return;
        }
        setPendingVerificationEmail(null);
        setPendingVerificationPlan(undefined);
        setPhoneOtpTarget(null);
        phoneConfirmationRef.current = null;
        await loadVerifiedUserWorkspace(user);
      } else {
        setPendingVerificationEmail(null);
        setPendingVerificationPlan(undefined);
        setOrganizations([]);
        setActiveOrgId('');
      }
    });
    return () => unsub();
  }, [loadVerifiedUserWorkspace]);

  // Subscribe to active organization collections once authenticated
  useEffect(() => {
    if (!authUser || !activeOrgId) return;
    const subs = subscribeToOrganizationData(
      activeOrgId,
      {
        onMembers: setMembers,
        onProducts: setProducts,
        onMovements: setMovements,
        onSales: setSales,
        onDebtors: setDebtors,
        onDebtPayments: setDebtPayments,
        onWorkers: setWorkers,
        onAttendance: setAttendance,
        onCashClosings: setCashClosings,
        onAuditLogs: setAuditLogs,
      },
      authUser.uid
    );
    return () => subs.unsubscribeAll();
  }, [authUser, activeOrgId]);

  // Flush offline queue automatically when back online
  const handleManualSync = useCallback(async () => {
    if (!effectiveOnline) return;
    setSyncing(true);
    try {
      await flushSyncQueue();
      await refreshPendingCount();
    } finally {
      setSyncing(false);
    }
  }, [effectiveOnline, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
    if (effectiveOnline) {
      handleManualSync();
    }
  }, [effectiveOnline, handleManualSync, refreshPendingCount]);

  const clearRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // ignore cleanup error
      }
      recaptchaVerifierRef.current = null;
    }
  };

  const handleRequestPhoneOtp = async (payload: PhoneOtpRequestPayload): Promise<boolean> => {
    setAuthError(null);
    setAuthInfo(null);
    setSignedOutNotice(false);
    setViewingSite(false);

    const normalized = normalizePhoneE164(payload.phone);
    if (!normalized) {
      setAuthError(
        'Numéro invalide. Saisissez le numéro avec indicatif pays (ex : +221 77 450 28 19).'
      );
      return false;
    }

    setAuthLoading(true);
    try {
      clearRecaptcha();
      const verifier = new RecaptchaVerifier(auth, 'agrikoom-recaptcha-container', {
        size: 'invisible',
      });
      recaptchaVerifierRef.current = verifier;

      pendingPhoneDraftRef.current =
        payload.mode === 'register'
          ? {
              displayName: payload.displayName,
              orgName: payload.orgName,
              phone: normalized,
              subscriptionPlan: payload.subscriptionPlan,
              paymentChannel: payload.paymentChannel,
            }
          : { phone: normalized };

      const confirmation = await signInWithPhoneNumber(auth, normalized, verifier);
      phoneConfirmationRef.current = confirmation;
      setPhoneOtpTarget(normalized);
      setAuthInfo(`Un code de vérification par SMS vient d’être envoyé au ${normalized}.`);
      return true;
    } catch (err) {
      clearRecaptcha();
      pendingPhoneDraftRef.current = undefined;
      setAuthError(formatFirebaseAuthError(err));
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (otpCode: string, displayName?: string) => {
    if (!phoneConfirmationRef.current) {
      setAuthError('Session SMS expirée. Demandez un nouveau code.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthInfo(null);
    try {
      const cred = await phoneConfirmationRef.current.confirm(otpCode);
      const targetName = displayName?.trim() || pendingPhoneDraftRef.current?.displayName;
      if (targetName && !cred.user.displayName) {
        await updateProfile(cred.user, { displayName: targetName });
      }
      clearRecaptcha();
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCancelPhoneOtp = () => {
    clearRecaptcha();
    phoneConfirmationRef.current = null;
    pendingPhoneDraftRef.current = undefined;
    setPhoneOtpTarget(null);
    setAuthError(null);
    setAuthInfo(null);
  };

  const handleEmailSignUp = async (payload: EmailSignUpPayload) => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthInfo(null);
    setSignedOutNotice(false);
    setViewingSite(false);
    try {
      const cred = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
      if (payload.displayName) {
        await updateProfile(cred.user, { displayName: payload.displayName });
      }
      saveOnboardingDraft(cred.user.uid, {
        orgName: payload.orgName || undefined,
        subscriptionPlan: payload.subscriptionPlan,
        paymentChannel: payload.paymentChannel,
      });
      setPendingVerificationEmail(cred.user.email || payload.email);
      setPendingVerificationPlan(payload.subscriptionPlan);
      await sendEmailVerification(cred.user);
      setAuthInfo(
        `Compte créé avec succès. Un e-mail de confirmation vient d'être envoyé à ${payload.email}.`
      );
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignIn = async (payload: EmailSignInPayload) => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthInfo(null);
    setSignedOutNotice(false);
    setViewingSite(false);
    try {
      const cred = await signInWithEmailAndPassword(auth, payload.email, payload.password);
      if (!cred.user.emailVerified) {
        setPendingVerificationEmail(cred.user.email || payload.email);
        setAuthInfo(
          'Votre adresse e-mail n’est pas encore vérifiée. Validez le lien reçu par e-mail puis cliquez sur « J’ai vérifié mon e-mail ».'
        );
      }
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async (targetEmail: string) => {
    setAuthError(null);
    setAuthInfo(null);
    if (!targetEmail) {
      setAuthError('Saisissez d’abord votre adresse e-mail ci-dessous pour réinitialiser le mot de passe.');
      return;
    }
    setAuthLoading(true);
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setAuthInfo(`Un lien de réinitialisation de mot de passe a été envoyé à ${targetEmail}.`);
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCheckEmailVerification = async () => {
    if (!auth.currentUser) return;
    setAuthLoading(true);
    setAuthError(null);
    setAuthInfo(null);
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      if (auth.currentUser.emailVerified) {
        setPendingVerificationEmail(null);
        setPendingVerificationPlan(undefined);
        await loadVerifiedUserWorkspace(auth.currentUser);
      } else {
        setAuthError(
          'Votre adresse e-mail n’est pas encore confirmée. Ouvrez le lien reçu dans votre boîte mail (ou dossier spams).'
        );
      }
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    setAuthLoading(true);
    setAuthError(null);
    setAuthInfo(null);
    try {
      await sendEmailVerification(auth.currentUser);
      setAuthInfo(
        `Un nouveau lien de confirmation a été envoyé à ${auth.currentUser.email || 'votre adresse e-mail'}.`
      );
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    clearRecaptcha();
    phoneConfirmationRef.current = null;
    pendingPhoneDraftRef.current = undefined;
    setPhoneOtpTarget(null);
    setViewingSite(false);
    setActiveTab('dashboard');
    setDebtsInitialFilter('all');
    setAuthError(null);
    setAuthInfo(null);
    setPendingVerificationEmail(null);
    setPendingVerificationPlan(undefined);
    await signOut(auth);
    setOrganizations([]);
    setActiveOrgId('');
    setMembers([]);
    setProducts([]);
    setMovements([]);
    setSales([]);
    setDebtors([]);
    setDebtPayments([]);
    setWorkers([]);
    setAttendance([]);
    setCashClosings([]);
    setAuditLogs([]);
    setSignedOutNotice(true);
  };

  const logAudit = async (action: string, entityType: string, summary: string) => {
    if (!activeOrg || !authUser) return;
    const nowIso = new Date().toISOString();
    const id = makeId('aud');
    const entry: AuditLog = {
      id,
      orgId: activeOrg.id,
      orgOwnerId: activeOrg.ownerId,
      memberUids: activeOrg.memberUids,
      action,
      entityType,
      summary: summary.slice(0, 295),
      actorUid: authUser.uid,
      actorName: activeActorName || authUser.displayName || 'Opérateur',
      createdAt: nowIso,
    };
    await writeOrgEntity(activeOrg.id, 'auditLogs', id, entry as unknown as Record<string, unknown>, 'set', effectiveOnline);
    await refreshPendingCount();
  };

  // --- Module Handlers ---
  const handleCreateProduct = async (input: {
    name: string;
    barcode?: string;
    category: ProductCategory;
    unit: string;
    quantity: number;
    minThreshold: number;
    unitCostFcfa: number;
    unitPriceFcfa: number;
  }) => {
    if (!activeOrg || !authUser) return;
    const nowIso = new Date().toISOString();
    const id = makeId('prod');
    const trimmedBarcode = input.barcode?.trim().slice(0, 64);
    const product: Product = {
      id,
      orgId: activeOrg.id,
      orgOwnerId: activeOrg.ownerId,
      memberUids: activeOrg.memberUids,
      name: input.name,
      ...(trimmedBarcode ? { barcode: trimmedBarcode } : {}),
      category: input.category,
      unit: input.unit,
      quantity: input.quantity,
      minThreshold: input.minThreshold,
      unitCostFcfa: input.unitCostFcfa,
      unitPriceFcfa: input.unitPriceFcfa,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await writeOrgEntity(activeOrg.id, 'products', id, product as unknown as Record<string, unknown>, 'set', effectiveOnline);
    await logAudit('PRODUCT_CREATED', 'product', `Ajout article ${input.name} (${input.quantity} ${input.unit})`);
    await refreshPendingCount();
  };

  const handleAssignProductBarcode = async (product: Product, barcode: string) => {
    if (!activeOrg || !authUser) return;
    const trimmed = barcode.trim().slice(0, 64);
    if (!trimmed) return;
    const nowIso = new Date().toISOString();
    await writeOrgEntity(
      activeOrg.id,
      'products',
      product.id,
      { ...product, barcode: trimmed, updatedAt: nowIso } as unknown as Record<string, unknown>,
      'update',
      effectiveOnline
    );
    await logAudit('PRODUCT_BARCODE_LINKED', 'product', `Code-barres ${trimmed} associé à ${product.name}`);
    await refreshPendingCount();
  };

  const handleRecordMovement = async (params: {
    product: Product;
    movementType: MovementType;
    quantityDelta: number;
    justification: string;
  }) => {
    if (!activeOrg || !authUser) return;
    const nowIso = new Date().toISOString();
    const nextQty = Math.max(0, params.product.quantity + params.quantityDelta);

    await writeOrgEntity(
      activeOrg.id,
      'products',
      params.product.id,
      { ...params.product, quantity: nextQty, updatedAt: nowIso } as unknown as Record<string, unknown>,
      'update',
      effectiveOnline
    );

    const movId = makeId('mov');
    const mov: StockMovement = {
      id: movId,
      orgId: activeOrg.id,
      orgOwnerId: activeOrg.ownerId,
      memberUids: activeOrg.memberUids,
      productId: params.product.id,
      productName: params.product.name,
      movementType: params.movementType,
      quantityDelta: params.quantityDelta,
      justification: params.justification,
      actorName: activeActorName,
      actorUid: authUser.uid,
      createdAt: nowIso,
    };
    await writeOrgEntity(activeOrg.id, 'movements', movId, mov as unknown as Record<string, unknown>, 'set', effectiveOnline);
    await logAudit(
      'STOCK_MOVEMENT',
      'product',
      `${params.product.name} (${params.quantityDelta >= 0 ? '+' : ''}${params.quantityDelta}) : ${params.justification}`
    );
    await refreshPendingCount();
  };

  const handleQuickInventory = async (params: {
    product: Product;
    physicalCount: number;
    justification: string;
  }) => {
    const delta = params.physicalCount - params.product.quantity;
    await handleRecordMovement({
      product: params.product,
      movementType: 'ajustement',
      quantityDelta: delta,
      justification: `Inventaire physique (${params.product.quantity} -> ${params.physicalCount}) : ${params.justification}`,
    });
  };

  const handleRecordSale = async (params: {
    items: Array<{ product: Product; qty: number }>;
    discountFcfa: number;
    cashFcfa: number;
    mobileMoneyFcfa: number;
    mobileMoneyProvider: MobileMoneyProvider;
    creditFcfa: number;
    debtorId?: string;
    debtorName?: string;
    newDebtor?: { fullName: string; phone: string; zone: string };
  }) => {
    if (!activeOrg || !authUser) return;
    const nowIso = new Date().toISOString();
    const subtotal = params.items.reduce((s, i) => s + i.product.unitPriceFcfa * i.qty, 0);
    const total = Math.max(0, subtotal - params.discountFcfa);
    const itemsSummary = params.items.map((i) => `${i.qty}x ${i.product.name}`).join(' · ').slice(0, 480);

    let resolvedDebtorId = params.debtorId;
    let resolvedDebtorName = params.debtorName;

    if (params.creditFcfa > 0) {
      if (params.newDebtor) {
        const debId = makeId('deb');
        const newDeb: Debtor = {
          id: debId,
          orgId: activeOrg.id,
          orgOwnerId: activeOrg.ownerId,
          memberUids: activeOrg.memberUids,
          fullName: params.newDebtor.fullName,
          phone: params.newDebtor.phone,
          zone: params.newDebtor.zone,
          totalCreditFcfa: params.creditFcfa,
          totalPaidFcfa: 0,
          remainingFcfa: params.creditFcfa,
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          status: 'en_cours',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        await writeOrgEntity(activeOrg.id, 'debtors', debId, newDeb as unknown as Record<string, unknown>, 'set', effectiveOnline);
        resolvedDebtorId = debId;
        resolvedDebtorName = newDeb.fullName;
      } else if (resolvedDebtorId) {
        const existingDeb = debtors.find((d) => d.id === resolvedDebtorId);
        if (existingDeb) {
          const nextCredit = existingDeb.totalCreditFcfa + params.creditFcfa;
          const nextRemaining = existingDeb.remainingFcfa + params.creditFcfa;
          const nextStatus = existingDeb.totalPaidFcfa > 0 ? 'partiel' : 'en_cours';
          await writeOrgEntity(
            activeOrg.id,
            'debtors',
            existingDeb.id,
            {
              ...existingDeb,
              totalCreditFcfa: nextCredit,
              remainingFcfa: nextRemaining,
              status: nextStatus,
              updatedAt: nowIso,
            } as unknown as Record<string, unknown>,
            'update',
            effectiveOnline
          );
          resolvedDebtorName = existingDeb.fullName;
        }
      }
    }

    // 1. Create Sale
    const saleId = makeId('sale');
    const sale: Sale = {
      id: saleId,
      orgId: activeOrg.id,
      orgOwnerId: activeOrg.ownerId,
      memberUids: activeOrg.memberUids,
      itemsSummary,
      subtotalFcfa: subtotal,
      discountFcfa: params.discountFcfa,
      totalFcfa: total,
      cashFcfa: params.cashFcfa,
      mobileMoneyFcfa: params.mobileMoneyFcfa,
      mobileMoneyProvider: params.mobileMoneyProvider,
      creditFcfa: params.creditFcfa,
      ...(resolvedDebtorId ? { debtorId: resolvedDebtorId } : {}),
      ...(resolvedDebtorName ? { debtorName: resolvedDebtorName } : {}),
      cashierUid: authUser.uid,
      cashierName: activeActorName,
      status: 'completed',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await writeOrgEntity(activeOrg.id, 'sales', saleId, sale as unknown as Record<string, unknown>, 'set', effectiveOnline);

    // 2. Decrement stocks & record sortie_vente movements
    for (const item of params.items) {
      const nextQty = Math.max(0, item.product.quantity - item.qty);
      await writeOrgEntity(
        activeOrg.id,
        'products',
        item.product.id,
        { ...item.product, quantity: nextQty, updatedAt: nowIso } as unknown as Record<string, unknown>,
        'update',
        effectiveOnline
      );
      const movId = makeId('mov');
      const mov: StockMovement = {
        id: movId,
        orgId: activeOrg.id,
        orgOwnerId: activeOrg.ownerId,
        memberUids: activeOrg.memberUids,
        productId: item.product.id,
        productName: item.product.name,
        movementType: 'sortie_vente',
        quantityDelta: -item.qty,
        justification: `Vente POS #${saleId.slice(-6)}`,
        actorName: activeActorName,
        actorUid: authUser.uid,
        createdAt: nowIso,
      };
      await writeOrgEntity(activeOrg.id, 'movements', movId, mov as unknown as Record<string, unknown>, 'set', effectiveOnline);
    }

    await logAudit('POS_SALE', 'sale', `Vente ${total} FCFA (${itemsSummary})`);
    await refreshPendingCount();
  };

  const handleCancelSale = async (sale: Sale) => {
    if (!activeOrg || !authUser) return;
    const nowIso = new Date().toISOString();
    await writeOrgEntity(
      activeOrg.id,
      'sales',
      sale.id,
      { ...sale, status: 'cancelled', updatedAt: nowIso } as unknown as Record<string, unknown>,
      'update',
      effectiveOnline
    );
    await logAudit('SALE_CANCELLED', 'sale', `Annulation vente ${sale.id} (${sale.totalFcfa} FCFA)`);
    await refreshPendingCount();
  };

  const handleCloseRegister = async (params: {
    theoreticalCashFcfa: number;
    countedCashFcfa: number;
    mobileMoneyTotalFcfa: number;
    creditTotalFcfa: number;
    note: string;
  }) => {
    if (!activeOrg || !authUser) return;
    const nowIso = new Date().toISOString();
    const id = makeId('close');
    const closing: CashClosing = {
      id,
      orgId: activeOrg.id,
      orgOwnerId: activeOrg.ownerId,
      memberUids: activeOrg.memberUids,
      closingDate: nowIso.slice(0, 10),
      theoreticalCashFcfa: params.theoreticalCashFcfa,
      countedCashFcfa: params.countedCashFcfa,
      varianceFcfa: params.countedCashFcfa - params.theoreticalCashFcfa,
      mobileMoneyTotalFcfa: params.mobileMoneyTotalFcfa,
      creditTotalFcfa: params.creditTotalFcfa,
      ...(params.note ? { note: params.note } : {}),
      closedByUid: authUser.uid,
      closedByName: activeActorName,
      createdAt: nowIso,
    };
    await writeOrgEntity(activeOrg.id, 'cashClosings', id, closing as unknown as Record<string, unknown>, 'set', effectiveOnline);
    await logAudit(
      'CASH_CLOSING',
      'cashClosing',
      `Clôture ${closing.closingDate} : écart ${closing.varianceFcfa} FCFA`
    );
    await refreshPendingCount();
  };

  const handleCreateDebtor = async (input: {
    fullName: string;
    phone: string;
    zone: string;
    initialCreditFcfa: number;
    dueDate: string;
  }) => {
    if (!activeOrg || !authUser) return;
    const nowIso = new Date().toISOString();
    const id = makeId('deb');
    const debtor: Debtor = {
      id,
      orgId: activeOrg.id,
      orgOwnerId: activeOrg.ownerId,
      memberUids: activeOrg.memberUids,
      fullName: input.fullName,
      phone: input.phone,
      zone: input.zone,
      totalCreditFcfa: input.initialCreditFcfa,
      totalPaidFcfa: 0,
      remainingFcfa: input.initialCreditFcfa,
      dueDate: input.dueDate,
      status: input.initialCreditFcfa === 0 ? 'solde' : 'en_cours',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await writeOrgEntity(activeOrg.id, 'debtors', id, debtor as unknown as Record<string, unknown>, 'set', effectiveOnline);
    await logAudit('DEBTOR_CREATED', 'debtor', `Fiche débiteur ${input.fullName} (${input.initialCreditFcfa} FCFA)`);
    await refreshPendingCount();
  };

  const handleRecordDebtPayment = async (params: {
    debtor: Debtor;
    amountFcfa: number;
    channel: PaymentChannel;
  }): Promise<DebtPayment> => {
    if (!activeOrg || !authUser) throw new Error('Organisation non chargée');
    const nowIso = new Date().toISOString();
    const nextPaid = params.debtor.totalPaidFcfa + params.amountFcfa;
    const nextRemaining = Math.max(0, params.debtor.remainingFcfa - params.amountFcfa);
    const nextStatus = nextRemaining === 0 ? 'solde' : 'partiel';

    await writeOrgEntity(
      activeOrg.id,
      'debtors',
      params.debtor.id,
      {
        ...params.debtor,
        totalPaidFcfa: nextPaid,
        remainingFcfa: nextRemaining,
        status: nextStatus,
        updatedAt: nowIso,
      } as unknown as Record<string, unknown>,
      'update',
      effectiveOnline
    );

    const payId = makeId('pay');
    const payment: DebtPayment = {
      id: payId,
      orgId: activeOrg.id,
      orgOwnerId: activeOrg.ownerId,
      memberUids: activeOrg.memberUids,
      debtorId: params.debtor.id,
      debtorName: params.debtor.fullName,
      amountFcfa: params.amountFcfa,
      channel: params.channel,
      receiptRef: `AK-${Date.now().toString().slice(-6)}`,
      recordedByUid: authUser.uid,
      recordedByName: activeActorName,
      createdAt: nowIso,
    };
    await writeOrgEntity(activeOrg.id, 'debtPayments', payId, payment as unknown as Record<string, unknown>, 'set', effectiveOnline);
    await logAudit(
      'DEBT_PAYMENT',
      'debtor',
      `Acompte ${params.amountFcfa} FCFA de ${params.debtor.fullName} (${params.channel})`
    );
    await refreshPendingCount();
    return payment;
  };

  const handleCreateWorker = async (input: {
    fullName: string;
    phone: string;
    contractType: ContractType;
    payBasis: PayBasis;
    rateFcfa: number;
  }) => {
    if (!activeOrg || !authUser) return;
    const nowIso = new Date().toISOString();
    const id = makeId('wrk');
    const worker: Worker = {
      id,
      orgId: activeOrg.id,
      orgOwnerId: activeOrg.ownerId,
      memberUids: activeOrg.memberUids,
      fullName: input.fullName,
      phone: input.phone,
      contractType: input.contractType,
      payBasis: input.payBasis,
      rateFcfa: input.rateFcfa,
      advancesFcfa: 0,
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await writeOrgEntity(activeOrg.id, 'workers', id, worker as unknown as Record<string, unknown>, 'set', effectiveOnline);
    await logAudit('WORKER_ADDED', 'worker', `Nouvel ouvrier ${input.fullName} (${input.contractType})`);
    await refreshPendingCount();
  };

  const handleMarkAttendance = async (params: {
    worker: Worker;
    workDate: string;
    status: AttendanceStatus;
    unitsCompleted: number;
    advanceGivenFcfa: number;
  }) => {
    if (!activeOrg || !authUser) return;
    const nowIso = new Date().toISOString();
    let earned = 0;
    if (params.status === 'present') earned = params.worker.rateFcfa;
    if (params.status === 'demi_journee') earned = Math.round(params.worker.rateFcfa * 0.5);
    if (params.status === 'tache') earned = params.unitsCompleted * params.worker.rateFcfa;

    const attId = `att_${params.worker.id}_${params.workDate}`;
    const existingAtt = attendance.find((a) => a.id === attId);
    const record: AttendanceRecord = {
      id: attId,
      orgId: activeOrg.id,
      orgOwnerId: activeOrg.ownerId,
      memberUids: activeOrg.memberUids,
      workerId: params.worker.id,
      workerName: params.worker.fullName,
      workDate: params.workDate,
      status: params.status,
      unitsCompleted: params.unitsCompleted,
      earnedFcfa: earned,
      advanceGivenFcfa: params.advanceGivenFcfa,
      paidOut: false,
      recordedByUid: existingAtt ? existingAtt.recordedByUid : authUser.uid,
      createdAt: existingAtt ? existingAtt.createdAt : nowIso,
      updatedAt: nowIso,
    };

    await writeOrgEntity(
      activeOrg.id,
      'attendance',
      attId,
      record as unknown as Record<string, unknown>,
      existingAtt ? 'update' : 'set',
      effectiveOnline
    );
    await logAudit(
      'ATTENDANCE_MARKED',
      'attendance',
      `Pointage ${params.worker.fullName} (${params.workDate}) : ${params.status} (${earned} FCFA)`
    );
    await refreshPendingCount();
  };

  const handleSettlePayroll = async (worker: Worker, unpaidRecords: AttendanceRecord[]) => {
    if (!activeOrg || !authUser) return;
    const nowIso = new Date().toISOString();
    for (const rec of unpaidRecords) {
      await writeOrgEntity(
        activeOrg.id,
        'attendance',
        rec.id,
        { ...rec, paidOut: true, updatedAt: nowIso } as unknown as Record<string, unknown>,
        'update',
        effectiveOnline
      );
    }
    if (worker.advancesFcfa > 0) {
      await writeOrgEntity(
        activeOrg.id,
        'workers',
        worker.id,
        { ...worker, advancesFcfa: 0, updatedAt: nowIso } as unknown as Record<string, unknown>,
        'update',
        effectiveOnline
      );
    }
    const gross = unpaidRecords.reduce((s, r) => s + r.earnedFcfa, 0);
    await logAudit('PAYROLL_SETTLED', 'worker', `Émargement paie ${worker.fullName} : ${gross} FCFA soldés`);
    await refreshPendingCount();
  };

  const handleUpdateOrgSettings = async (updates: Partial<Organization>) => {
    if (!activeOrg) return;
    await updateOrganizationSettings(activeOrg.id, updates, effectiveOnline);
    setOrganizations((prev) => prev.map((o) => (o.id === activeOrg.id ? { ...o, ...updates } : o)));
    await logAudit('ORG_SETTINGS_UPDATED', 'organization', `Mise à jour paramètres coopérative`);
    await refreshPendingCount();
  };

  const handleAddStaffMember = async (input: {
    name: string;
    role: 'admin' | 'manager' | 'pointer';
    pinCode: string;
    phone: string;
  }) => {
    if (!activeOrg) return;
    const nowIso = new Date().toISOString();
    const id = makeId('staff');
    const member: OrgMember & { id: string; orgId: string } = {
      id,
      orgId: activeOrg.id,
      uid: id,
      orgOwnerId: activeOrg.ownerId,
      memberUids: activeOrg.memberUids,
      name: input.name,
      role: input.role,
      pinCode: input.pinCode,
      phone: input.phone,
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await writeOrgEntity(activeOrg.id, 'members', id, member as unknown as Record<string, unknown>, 'set', effectiveOnline);
    await logAudit('STAFF_ADDED', 'member', `Ajout opérateur ${input.name} (${input.role})`);
  };

  const handleCreateOrg = async (input: {
    name: string;
    orgType: Organization['orgType'];
    region: string;
    phone: string;
    whatsappNumber: string;
  }) => {
    if (!authUser) return;
    const newOrg = await createNewOrganization(authUser.uid, activeActorName, input);
    setOrganizations((prev) => [newOrg, ...prev]);
    setActiveOrgId(newOrg.id);
    setActiveTab('dashboard');
  };

  const handleUpdateSubscription = async (orgId: string, status: Organization['subscriptionStatus']) => {
    await updateOrganizationSettings(orgId, { subscriptionStatus: status });
    setOrganizations((prev) => prev.map((o) => (o.id === orgId ? { ...o, subscriptionStatus: status } : o)));
  };

  if (!authReady || dataLoading) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex flex-col items-center justify-center p-6">
        <AgriKoomLogo size={44} />
        <p className="mt-4 text-sm font-medium text-slate-600">Chargement de votre espace coopératif...</p>
      </div>
    );
  }

  if (!authUser || !isVerifiedAuthSession(authUser) || !activeOrg || viewingSite) {
    return (
      <AuthLanding
        onRequestPhoneOtp={handleRequestPhoneOtp}
        onVerifyPhoneOtp={handleVerifyPhoneOtp}
        onCancelPhoneOtp={handleCancelPhoneOtp}
        phoneOtpTarget={phoneOtpTarget}
        onEmailSignUp={handleEmailSignUp}
        onEmailSignIn={handleEmailSignIn}
        onResetPassword={handleResetPassword}
        onCheckEmailVerification={handleCheckEmailVerification}
        onResendVerification={handleResendVerification}
        pendingVerificationEmail={pendingVerificationEmail}
        pendingVerificationPlan={pendingVerificationPlan}
        loading={authLoading}
        errorMsg={authError}
        infoMsg={authInfo}
        isAuthenticated={Boolean(isVerifiedAuthSession(authUser) && activeOrg)}
        userName={activeActorName}
        onReturnToApp={() => setViewingSite(false)}
        onSignOut={handleSignOut}
        signedOutNotice={signedOutNotice}
      />
    );
  }

  const t = translations[locale];

  const rawNavItems: Array<{ id: ActiveTab; label: string; icon: React.ReactNode; hidden?: boolean }> = [
    { id: 'dashboard', label: t.navDashboard, icon: <LayoutDashboard className="h-5 w-5" /> },
    { id: 'pos', label: t.navPos, icon: <ShoppingCart className="h-5 w-5" />, hidden: activeRole === 'pointer' },
    { id: 'stocks', label: t.navStocks, icon: <Package className="h-5 w-5" /> },
    { id: 'debts', label: t.navDebts, icon: <Wallet className="h-5 w-5" />, hidden: activeRole === 'pointer' },
    { id: 'workers', label: t.navWorkers, icon: <Users className="h-5 w-5" /> },
    { id: 'reports', label: t.navReports, icon: <BarChart3 className="h-5 w-5" />, hidden: activeRole === 'pointer' },
    {
      id: 'settings',
      label: t.navSettings,
      icon: <Settings className="h-5 w-5" />,
      hidden: activeRole !== 'admin' && activeRole !== 'super_admin',
    },
    {
      id: 'super_admin',
      label: t.navSuperAdmin,
      icon: <ShieldCheck className="h-5 w-5" />,
      hidden: !isSuperAdminEmail && activeRole !== 'super_admin',
    },
  ];
  const navItems = rawNavItems.filter((item) => !item.hidden);

  const roleLabelText =
    activeRole === 'super_admin'
      ? t.roleSuperAdmin
      : activeRole === 'admin'
      ? t.roleAdmin
      : activeRole === 'manager'
      ? t.roleManager
      : t.rolePointer;

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-[#1E293B] flex flex-col lg:flex-row">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white z-30">
        <div className="flex h-16 items-center px-5 border-b border-slate-100">
          <AgriKoomLogo size={34} />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigateTab(item.id)}
                className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors min-h-[44px] ${
                  active
                    ? 'bg-[#2E7D32] text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-[#1E293B]'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Cooperative User Card & PIN Lock */}
        <div className="p-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center gap-3">
            <img
              src="/src/assets/images/agrikoom_president_avatar_1795042837805.jpg"
              alt={activeActorName}
              referrerPolicy="no-referrer"
              className="h-10 w-10 rounded-full object-cover border border-slate-200 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#1E293B] truncate">{activeActorName}</p>
              <p className="text-[11px] font-medium text-[#2E7D32] truncate">{roleLabelText}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPinModal(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-[#1E293B] hover:bg-slate-100 min-h-[40px]"
          >
            <KeyRound className="h-3.5 w-3.5 text-[#1A73E8]" />
            <span>{t.switchRole}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewingSite(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[40px]"
          >
            <Home className="h-3.5 w-3.5 text-[#2E7D32]" />
            <span>{t.backToSite}</span>
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#D32F2F]/25 px-3 py-2 text-xs font-semibold text-[#D32F2F] hover:bg-[#D32F2F]/5 min-h-[40px]"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{t.signOut}</span>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen pb-20 lg:pb-8">
        {/* Top Workspace Header (<= 56px on mobile to respect 15% cap) */}
        <header className="sticky top-0 z-20 h-14 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="lg:hidden shrink-0">
              <AgriKoomLogo size={30} />
            </div>
            {organizations.length > 1 ? (
              <select
                value={activeOrg.id}
                onChange={(e) => setActiveOrgId(e.target.value)}
                aria-label="Coopérative active"
                className="hidden lg:block rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-[#1E293B] max-w-xs truncate"
              >
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="hidden lg:inline text-sm font-semibold text-[#1E293B] truncate max-w-xs">
                {activeOrg.name}
              </span>
            )}
            <span className="hidden lg:inline text-xs text-slate-400">·</span>
            <span className="hidden lg:inline text-xs font-medium text-slate-500 truncate">{roleLabelText}</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Offline / Sync Indicator */}
            <button
              type="button"
              onClick={handleManualSync}
              title={
                !effectiveOnline
                  ? t.offlineMode
                  : pendingSyncCount > 0
                  ? `${pendingSyncCount} ${t.syncPending}`
                  : t.onlineMode
              }
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap min-h-[36px] ${
                !effectiveOnline
                  ? 'bg-[#FFB300]/20 text-[#92400E] border border-[#FFB300]/50'
                  : pendingSyncCount > 0
                  ? 'bg-[#1A73E8]/10 text-[#1A73E8] border border-[#1A73E8]/30'
                  : 'bg-[#2E7D32]/10 text-[#2E7D32]'
              }`}
            >
              {!effectiveOnline ? (
                <WifiOff className="h-3.5 w-3.5 shrink-0" />
              ) : syncing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
              ) : (
                <Wifi className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className={effectiveOnline && pendingSyncCount === 0 ? 'hidden sm:inline' : ''}>
                {!effectiveOnline
                  ? `${t.offlineMode}${pendingSyncCount > 0 ? ` (${pendingSyncCount})` : ''}`
                  : pendingSyncCount > 0
                  ? `${pendingSyncCount} ${t.syncPending}`
                  : t.onlineMode}
              </span>
            </button>

            <div className="hidden sm:block">
              <PWAInstallButton label={t.installApp} />
            </div>

            {activeRole !== 'pointer' && (
              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                aria-label="Rapports WhatsApp et Audit"
                className={`lg:hidden inline-flex items-center justify-center rounded-lg border p-1.5 min-h-[36px] min-w-[36px] ${
                  activeTab === 'reports'
                    ? 'border-[#2E7D32] bg-[#2E7D32]/10 text-[#2E7D32]'
                    : 'border-slate-200 text-slate-700'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
              </button>
            )}

            {(activeRole === 'admin' || activeRole === 'super_admin') && (
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                aria-label="Paramètres de l'organisation"
                className={`lg:hidden inline-flex items-center justify-center rounded-lg border p-1.5 min-h-[36px] min-w-[36px] ${
                  activeTab === 'settings'
                    ? 'border-[#2E7D32] bg-[#2E7D32]/10 text-[#2E7D32]'
                    : 'border-slate-200 text-slate-700'
                }`}
              >
                <Settings className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowPinModal(true)}
              aria-label="Changer de poste PIN"
              className="lg:hidden inline-flex items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-700 min-h-[36px] min-w-[36px]"
            >
              <KeyRound className="h-4 w-4 text-[#1A73E8]" />
            </button>

            <button
              type="button"
              onClick={() => setViewingSite(true)}
              aria-label={t.backToSite}
              title={t.backToSite}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[36px] min-w-[36px] whitespace-nowrap"
            >
              <Home className="h-4 w-4 text-[#2E7D32] shrink-0" />
              <span className="hidden md:inline">{t.backToSite}</span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              aria-label={t.signOut}
              title={t.signOut}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D32F2F]/30 bg-white px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-[#D32F2F] hover:bg-[#D32F2F]/5 min-h-[36px] min-w-[36px] whitespace-nowrap"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{t.signOut}</span>
            </button>
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6">
          {activeTab === 'dashboard' && (
            <DashboardView
              org={activeOrg}
              role={activeRole}
              locale={locale}
              products={products}
              sales={sales}
              debtors={debtors}
              debtPayments={debtPayments}
              attendance={attendance}
              cashClosings={cashClosings}
              onNavigate={handleNavigateTab}
              onNavigateDebts={handleNavigateToDebts}
            />
          )}

          {activeTab === 'pos' && (
            <PosView
              org={activeOrg}
              role={activeRole}
              actorUid={authUser.uid}
              actorName={activeActorName}
              products={products}
              sales={sales}
              debtors={debtors}
              onRecordSale={handleRecordSale}
              onCancelSale={handleCancelSale}
              onCloseRegister={handleCloseRegister}
              onAssignBarcode={handleAssignProductBarcode}
            />
          )}

          {activeTab === 'stocks' && (
            <StockView
              role={activeRole}
              products={products}
              movements={movements}
              onCreateProduct={handleCreateProduct}
              onRecordMovement={handleRecordMovement}
              onQuickInventory={handleQuickInventory}
            />
          )}

          {activeTab === 'debts' && (
            <DebtsView
              org={activeOrg}
              role={activeRole}
              locale={locale}
              debtors={debtors}
              debtPayments={debtPayments}
              initialStatusFilter={debtsInitialFilter}
              onStatusFilterChange={setDebtsInitialFilter}
              onCreateDebtor={handleCreateDebtor}
              onRecordPayment={handleRecordDebtPayment}
            />
          )}

          {activeTab === 'workers' && (
            <WorkersView
              role={activeRole}
              workers={workers}
              attendance={attendance}
              onCreateWorker={handleCreateWorker}
              onMarkAttendance={handleMarkAttendance}
              onSettlePayroll={handleSettlePayroll}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              org={activeOrg}
              role={activeRole}
              locale={locale}
              onChangeLocale={setLocale}
              members={members}
              products={products}
              sales={sales}
              debtors={debtors}
              debtPayments={debtPayments}
              attendance={attendance}
              cashClosings={cashClosings}
              auditLogs={auditLogs}
              simulatedOffline={simulatedOffline}
              onToggleSimulatedOffline={setSimulatedOffline}
              onUpdateOrgSettings={handleUpdateOrgSettings}
              onAddStaffMember={handleAddStaffMember}
              onOpenSettings={() => setActiveTab('settings')}
            />
          )}

          {activeTab === 'settings' && (
            <OrgSettingsView
              org={activeOrg}
              role={activeRole}
              locale={locale}
              onChangeLocale={setLocale}
              members={members}
              products={products}
              sales={sales}
              debtors={debtors}
              debtPayments={debtPayments}
              attendance={attendance}
              effectiveOnline={effectiveOnline}
              simulatedOffline={simulatedOffline}
              onToggleSimulatedOffline={setSimulatedOffline}
              onUpdateOrgSettings={handleUpdateOrgSettings}
              onAddStaffMember={handleAddStaffMember}
              onNavigate={setActiveTab}
              onOpenPinModal={() => setShowPinModal(true)}
            />
          )}

          {activeTab === 'super_admin' && (
            <SuperAdminView
              organizations={organizations}
              activeOrgId={activeOrg.id}
              onSelectOrg={(id) => {
                setActiveOrgId(id);
                setActiveTab('dashboard');
              }}
              onCreateOrg={handleCreateOrg}
              onUpdateSubscription={handleUpdateSubscription}
            />
          )}
        </main>
      </div>

      {/* Mobile Fixed Bottom Thumb-Zone Navigation (height = 60px, total sticky <= 15%) */}
      <nav
        aria-label="Navigation principale mobile"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-md"
      >
        <div className="grid grid-cols-5 h-[60px]">
          {(
            [
              { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
              { id: 'pos', label: 'Caisse', icon: ShoppingCart },
              { id: 'stocks', label: 'Stocks', icon: Package },
              { id: 'debts', label: 'Dettes', icon: Wallet },
              { id: 'workers', label: 'Ouvriers', icon: Users },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleNavigateTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                  active ? 'text-[#2E7D32]' : 'text-slate-500'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* PIN Lock & Role Switch Modal */}
      <PinLockModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        members={members}
        currentRole={activeRole}
        isSuperAdminEmail={isSuperAdminEmail}
        onSelectRole={(role, name) => {
          setActiveRole(role);
          setActiveActorName(name);
          if (
            role === 'pointer' &&
            (activeTab === 'pos' || activeTab === 'debts' || activeTab === 'reports' || activeTab === 'settings')
          ) {
            setActiveTab('workers');
          } else if (role === 'manager' && activeTab === 'settings') {
            setActiveTab('dashboard');
          }
        }}
      />
    </div>
  );
}
