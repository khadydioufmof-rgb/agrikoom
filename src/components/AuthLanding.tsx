import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  User,
  WifiOff,
} from 'lucide-react';
import { formatFcfa } from '../i18n/translations';
import { getSubscriptionPlan, SUBSCRIPTION_PLANS } from '../lib/subscriptionPlans';
import type { PaymentChannel, SubscriptionPlan } from '../types/agrikoom';
import { AgriKoomLogo } from './AgriKoomLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface ModernAuthInputProps {
  id: string;
  label: string;
  type?: React.HTMLInputTypeAttribute;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon: React.ReactNode;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  mono?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  rightElement?: React.ReactNode;
  helperText?: string;
  accent?: 'green' | 'blue';
}

const ModernAuthInput: React.FC<ModernAuthInputProps> = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  icon,
  required,
  minLength,
  maxLength,
  autoComplete,
  inputMode,
  mono = false,
  inputRef,
  rightElement,
  helperText,
  accent = 'green',
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const isFloating = isFocused || value.length > 0;
  const accentColor = accent === 'blue' ? '#1A73E8' : '#2E7D32';
  const focusGlowClass =
    accent === 'blue'
      ? 'border-[#1A73E8] bg-white shadow-[0_0_0_4px_rgba(26,115,232,0.12)]'
      : 'border-[#2E7D32] bg-white shadow-[0_0_0_4px_rgba(46,125,50,0.12)]';

  return (
    <div>
      <div
        className={`group relative overflow-hidden rounded-xl border transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isFocused
            ? focusGlowClass
            : value.length > 0
              ? 'border-slate-300 bg-white hover:border-slate-400'
              : 'border-slate-200 bg-slate-50/75 hover:border-slate-300 hover:bg-white'
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isFocused ? 'scale-110' : 'text-slate-400 group-hover:text-slate-500'
          }`}
          style={isFocused ? { color: accentColor } : undefined}
        >
          {icon}
        </span>

        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-10 right-10 truncate transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isFloating
              ? 'top-2 translate-y-0 text-[11px] font-semibold'
              : 'top-1/2 -translate-y-1/2 text-xs sm:text-sm font-medium text-slate-500'
          }`}
          style={isFocused ? { color: accentColor } : isFloating ? { color: '#475569' } : undefined}
        >
          {label}
        </label>

        <input
          ref={inputRef}
          id={id}
          type={type}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
          inputMode={inputMode}
          value={value}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isFocused ? placeholder : ''}
          className={`w-full bg-transparent pt-5 pb-2 pl-10 ${
            rightElement ? 'pr-11' : 'pr-3.5'
          } text-sm text-[#1E293B] placeholder:text-slate-400 placeholder:transition-opacity placeholder:duration-200 focus:outline-none min-h-[54px] ${
            mono ? 'font-mono-num' : ''
          }`}
        />

        {rightElement && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10">{rightElement}</div>
        )}

        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-center transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isFocused ? 'scale-x-100' : 'scale-x-0'
          }`}
          style={{ backgroundColor: accentColor }}
        />
      </div>
      {helperText && <p className="mt-1.5 text-[11px] text-slate-500">{helperText}</p>}
    </div>
  );
};

export interface PhoneOtpRequestPayload {
  phone: string;
  mode: 'register' | 'login';
  displayName?: string;
  orgName?: string;
  subscriptionPlan?: SubscriptionPlan;
  paymentChannel?: PaymentChannel;
}

export interface EmailSignUpPayload {
  email: string;
  password: string;
  displayName: string;
  orgName: string;
  subscriptionPlan: SubscriptionPlan;
  paymentChannel: PaymentChannel;
}

export interface EmailSignInPayload {
  email: string;
  password: string;
}

interface AuthLandingProps {
  onRequestPhoneOtp: (payload: PhoneOtpRequestPayload) => Promise<boolean>;
  onVerifyPhoneOtp: (otpCode: string, displayName?: string) => Promise<void>;
  onCancelPhoneOtp: () => void;
  phoneOtpTarget?: string | null;
  onEmailSignUp: (payload: EmailSignUpPayload) => Promise<void>;
  onEmailSignIn: (payload: EmailSignInPayload) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onCheckEmailVerification?: () => Promise<void>;
  onResendVerification?: () => Promise<void>;
  pendingVerificationEmail?: string | null;
  pendingVerificationPlan?: SubscriptionPlan;
  loading: boolean;
  errorMsg: string | null;
  infoMsg?: string | null;
  isAuthenticated?: boolean;
  userName?: string;
  onReturnToApp?: () => void;
  onSignOut?: () => Promise<void>;
  signedOutNotice?: boolean;
}

export const AuthLanding: React.FC<AuthLandingProps> = ({
  onRequestPhoneOtp,
  onVerifyPhoneOtp,
  onCancelPhoneOtp,
  phoneOtpTarget,
  onEmailSignUp,
  onEmailSignIn,
  onResetPassword,
  onCheckEmailVerification,
  onResendVerification,
  pendingVerificationEmail,
  pendingVerificationPlan,
  loading,
  errorMsg,
  infoMsg,
  isAuthenticated = false,
  userName,
  onReturnToApp,
  onSignOut,
  signedOutNotice = false,
}) => {
  const [heroLoaded, setHeroLoaded] = useState(true);
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('monthly');
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>('wave');

  const [displayName, setDisplayName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);

  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const authCardRef = useRef<HTMLDivElement | null>(null);

  const activePlan = getSubscriptionPlan(selectedPlan);
  const verificationPlan = getSubscriptionPlan(pendingVerificationPlan || selectedPlan);

  const focusAuthCard = (mode: 'register' | 'login', plan?: SubscriptionPlan) => {
    setAuthMode(mode);
    if (plan) setSelectedPlan(plan);
    authCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      if (authMethod === 'phone') {
        phoneInputRef.current?.focus();
      } else {
        emailInputRef.current?.focus();
      }
    }, 250);
  };

  const handlePhoneRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpCode('');
    await onRequestPhoneOtp({
      phone: phone.trim(),
      mode: authMode,
      displayName: displayName.trim() || undefined,
      orgName: orgName.trim() || undefined,
      subscriptionPlan: selectedPlan,
      paymentChannel,
    });
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onVerifyPhoneOtp(otpCode.trim(), displayName.trim() || undefined);
  };

  const handleResendOtp = async () => {
    await onRequestPhoneOtp({
      phone: phoneOtpTarget || phone.trim(),
      mode: authMode,
      displayName: displayName.trim() || undefined,
      orgName: orgName.trim() || undefined,
      subscriptionPlan: selectedPlan,
      paymentChannel,
    });
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'register') {
      await onEmailSignUp({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        orgName: orgName.trim(),
        subscriptionPlan: selectedPlan,
        paymentChannel,
      });
    } else {
      await onEmailSignIn({
        email: email.trim(),
        password,
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-[#1E293B] flex flex-col">
      {/* Strict 3-zone top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6 h-16">
          <AgriKoomLogo size={34} />
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#modules" className="hover:text-[#2E7D32] transition-colors whitespace-nowrap shrink-0">
              Modules
            </a>
            <a href="#offline" className="hover:text-[#2E7D32] transition-colors whitespace-nowrap shrink-0">
              Hors-ligne
            </a>
            <a href="#whatsapp" className="hover:text-[#2E7D32] transition-colors whitespace-nowrap shrink-0">
              Rapports WhatsApp
            </a>
            <a href="#tarif" className="hover:text-[#2E7D32] transition-colors whitespace-nowrap shrink-0">
              Abonnements
            </a>
          </nav>
          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton label="Installer" />
            {isAuthenticated && onReturnToApp ? (
              <>
                <button
                  type="button"
                  onClick={onReturnToApp}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2E7D32] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#256428] transition-colors whitespace-nowrap shrink-0 min-h-[42px]"
                >
                  <span>Mon espace</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </button>
                {onSignOut && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-[#D32F2F] hover:bg-[#D32F2F]/5 transition-colors whitespace-nowrap shrink-0 min-h-[42px]"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Déconnecter</span>
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => focusAuthCard('login')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#2E7D32] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#256428] transition-colors whitespace-nowrap shrink-0 min-h-[42px]"
              >
                <span>Connexion</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Split Hero + Auth Card */}
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-8 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Value Proposition & Visual */}
            <div className="lg:col-span-6 space-y-6">
              <div>
                <p className="text-xs font-semibold tracking-wide text-[#2E7D32]">
                  Sénégal &amp; Afrique de l&apos;Ouest · Coopératives, GIE &amp; Fermes
                </p>
                <h1 className="mt-2.5 font-display text-3xl sm:text-4xl lg:text-[40px] font-bold leading-[1.12] tracking-tight text-[#1E293B] [text-wrap:balance]">
                  Remplacez le cahier papier par un pilotage agricole fiable.
                </h1>
                <p className="mt-3.5 text-base text-slate-600 leading-relaxed max-w-xl">
                  AgriKoom réunit la gestion des stocks, la caisse multi-paiement (Espèces, Wave, Orange Money, Crédit),
                  le recouvrement des dettes, la paie des ouvriers et le bilan WhatsApp automatique du soir.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#2E7D32]" />
                  Connexion rapide par numéro de téléphone (SMS)
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#1A73E8]" />
                  Formules Mensuelle, Trimestrielle &amp; Annuelle
                </span>
              </div>

              <div className="relative h-64 sm:h-72 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                {heroLoaded ? (
                  <img
                    src="/assets/aistudio/photorealistic-african-people-harvesting-diverse-vegetables-grains_c9bc4ff5.jpg"
                    alt="Producteur agricole récoltant des tomates et légumes frais en plein champ"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroLoaded(false)}
                    className="h-full w-full object-cover object-center"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-[#2E7D32]/15 via-white to-[#FFB300]/15 flex items-center justify-center p-8 text-center">
                    <div>
                      <AgriKoomLogo size={48} showWordmark={false} />
                      <p className="mt-3 font-display text-base font-semibold text-[#1E293B]">
                        Coopérative Maraîchère des Niayes
                      </p>
                    </div>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 text-white">
                  <p className="text-xs font-medium text-[#FFB300]">Architecture Terrain</p>
                  <p className="mt-0.5 text-sm font-semibold">
                    Lisibilité plein soleil · Actions en moins de 3 clics · Mode hors-ligne
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Subscription + Phone/Email Auth Card */}
            <div ref={authCardRef} className="lg:col-span-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
                {signedOutNotice && (
                  <div className="flex items-center gap-2 rounded-xl border border-[#2E7D32]/30 bg-[#2E7D32]/10 p-3 text-xs font-medium text-[#2E7D32]">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Session déconnectée. Vous êtes de retour sur l&apos;accueil AgriKoom.</span>
                  </div>
                )}

                {infoMsg && (
                  <div className="flex items-start gap-2 rounded-xl border border-[#1A73E8]/30 bg-[#1A73E8]/10 p-3 text-xs font-medium text-[#1E293B]">
                    <Phone className="h-4 w-4 text-[#1A73E8] shrink-0 mt-0.5" />
                    <span>{infoMsg}</span>
                  </div>
                )}

                {errorMsg && (
                  <div className="rounded-xl border border-[#D32F2F]/30 bg-[#D32F2F]/5 p-3 text-xs font-medium text-[#D32F2F]">
                    {errorMsg}
                  </div>
                )}

                {pendingVerificationEmail ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1A73E8]/10 text-[#1A73E8] shrink-0">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-display text-lg font-bold text-[#1E293B]">
                          Vérifiez votre adresse e-mail
                        </h2>
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                          Un lien de confirmation a été envoyé à{' '}
                          <span className="font-semibold text-[#1E293B]">{pendingVerificationEmail}</span>.
                          Cliquez sur le lien dans votre boîte mail pour activer votre espace et votre abonnement{' '}
                          <span className="font-semibold text-[#2E7D32]">
                            {verificationPlan.labelFr} ({formatFcfa(verificationPlan.amountFcfa)})
                          </span>
                          .
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      {onCheckEmailVerification && (
                        <button
                          type="button"
                          onClick={onCheckEmailVerification}
                          disabled={loading}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2E7D32] px-5 py-3 text-sm font-semibold text-white hover:bg-[#256428] disabled:opacity-60 min-h-[48px]"
                        >
                          <RefreshCw className={`h-4 w-4 shrink-0 ${loading ? 'animate-spin' : ''}`} />
                          <span>{loading ? 'Vérification...' : "J'ai vérifié mon e-mail — Accéder"}</span>
                        </button>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {onResendVerification && (
                          <button
                            type="button"
                            onClick={onResendVerification}
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-[#1E293B] hover:bg-slate-50 disabled:opacity-60 min-h-[44px]"
                          >
                            <Mail className="h-3.5 w-3.5 text-[#1A73E8]" />
                            <span>Renvoyer le lien</span>
                          </button>
                        )}
                        {onSignOut && (
                          <button
                            type="button"
                            onClick={onSignOut}
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-[#D32F2F] hover:bg-[#D32F2F]/5 disabled:opacity-60 min-h-[44px]"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                            <span>Changer d&apos;adresse</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : isAuthenticated && onReturnToApp ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-[#2E7D32]">Session active</p>
                      <h2 className="mt-1 font-display text-xl font-bold text-[#1E293B]">
                        Bienvenue{userName ? `, ${userName}` : ''}
                      </h2>
                      <p className="mt-1 text-xs text-slate-600">
                        Votre espace coopératif est prêt. Revenez au tableau de bord ou déconnectez-vous pour changer de compte.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={onReturnToApp}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#2E7D32] px-5 py-3 text-sm font-semibold text-white hover:bg-[#256428] min-h-[48px]"
                      >
                        <span>Accéder à mon espace</span>
                        <ArrowRight className="h-4 w-4 shrink-0" />
                      </button>
                      {onSignOut && (
                        <button
                          type="button"
                          onClick={onSignOut}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-[#D32F2F] hover:bg-[#D32F2F]/5 min-h-[48px]"
                        >
                          <LogOut className="h-4 w-4 shrink-0" />
                          <span>Déconnecter</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : phoneOtpTarget ? (
                  <form key="otp-step" onSubmit={handleVerifyOtpSubmit} className="space-y-4 animate-auth-panel">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2E7D32]/10 text-[#2E7D32] shrink-0">
                        <KeyRound className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-display text-lg font-bold text-[#1E293B]">
                          Code de vérification SMS
                        </h2>
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                          Saisissez le code à 6 chiffres envoyé par SMS au{' '}
                          <span className="font-mono-num font-bold text-[#1E293B]">{phoneOtpTarget}</span>.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="auth-otp-code" className="block text-xs font-semibold text-slate-600 mb-2">
                        Code SMS (6 chiffres)
                      </label>
                      <div className="relative">
                        <input
                          id="auth-otp-code"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          required
                          minLength={6}
                          maxLength={6}
                          value={otpCode}
                          onFocus={() => setOtpFocused(true)}
                          onBlur={() => setOtpFocused(false)}
                          onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                          className="peer absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
                        />
                        <div className="grid grid-cols-6 gap-2">
                          {Array.from({ length: 6 }, (_, idx) => {
                            const char = otpCode[idx] || '';
                            const isActiveSlot = otpFocused && idx === Math.min(otpCode.length, 5);
                            return (
                              <div
                                key={idx}
                                className={`flex h-12 sm:h-13 items-center justify-center rounded-xl border font-mono-num text-lg sm:text-xl font-bold transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                                  isActiveSlot
                                    ? 'border-[#2E7D32] bg-white text-[#1E293B] shadow-[0_0_0_4px_rgba(46,125,50,0.14)] scale-[1.03]'
                                    : char
                                      ? 'border-[#2E7D32]/50 bg-[#2E7D32]/5 text-[#1E293B]'
                                      : 'border-slate-200 bg-slate-50/75 text-slate-400'
                                }`}
                              >
                                {char ? (
                                  <span key={`${idx}-${char}`} className="animate-otp-digit">
                                    {char}
                                  </span>
                                ) : isActiveSlot ? (
                                  <span className="h-5 w-0.5 rounded-full bg-[#2E7D32] animate-pulse" />
                                ) : (
                                  <span className="text-slate-300">·</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otpCode.length < 6}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2E7D32] px-5 py-3 text-sm font-semibold text-white hover:bg-[#256428] active:scale-[0.99] disabled:opacity-60 transition-all duration-200 min-h-[48px]"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>{loading ? 'Vérification...' : 'Valider le code & accéder'}</span>
                    </button>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-[#1E293B] hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60 transition-all duration-150 min-h-[44px]"
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-[#1A73E8]" />
                        <span>Renvoyer le code</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpCode('');
                          onCancelPhoneOtp();
                        }}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60 transition-all duration-150 min-h-[44px]"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>Modifier le numéro</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    {/* Animated Sliding Switch: S'inscrire | Se connecter */}
                    <div
                      role="tablist"
                      aria-label="Mode d'authentification"
                      className="relative grid grid-cols-2 rounded-xl bg-slate-100 p-1 w-full"
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-white shadow-sm transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]"
                        style={{
                          transform: authMode === 'login' ? 'translateX(100%)' : 'translateX(0%)',
                        }}
                      />
                      <button
                        type="button"
                        role="tab"
                        aria-selected={authMode === 'register'}
                        onClick={() => setAuthMode('register')}
                        className={`relative z-10 rounded-lg py-2.5 px-3 text-xs sm:text-sm font-semibold transition-colors duration-200 whitespace-nowrap ${
                          authMode === 'register'
                            ? 'text-[#1E293B]'
                            : 'text-slate-500 hover:text-[#1E293B]'
                        }`}
                      >
                        S&apos;inscrire (Abonnement)
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={authMode === 'login'}
                        onClick={() => setAuthMode('login')}
                        className={`relative z-10 rounded-lg py-2.5 px-3 text-xs sm:text-sm font-semibold transition-colors duration-200 whitespace-nowrap ${
                          authMode === 'login'
                            ? 'text-[#1E293B]'
                            : 'text-slate-500 hover:text-[#1E293B]'
                        }`}
                      >
                        Se connecter
                      </button>
                    </div>

                    {/* Animated Method Selector: Phone (SMS) vs Email */}
                    <div
                      role="tablist"
                      aria-label="Méthode de connexion"
                      className="relative grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50/80 p-1 w-full"
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-lg border transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                          authMethod === 'phone'
                            ? 'border-[#2E7D32]/40 bg-[#2E7D32]/10'
                            : 'border-[#1A73E8]/40 bg-[#1A73E8]/10'
                        }`}
                        style={{
                          transform: authMethod === 'email' ? 'translateX(100%)' : 'translateX(0%)',
                        }}
                      />
                      <button
                        type="button"
                        role="tab"
                        aria-selected={authMethod === 'phone'}
                        onClick={() => setAuthMethod('phone')}
                        className={`relative z-10 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors duration-200 min-h-[38px] whitespace-nowrap ${
                          authMethod === 'phone'
                            ? 'text-[#2E7D32]'
                            : 'text-slate-600 hover:text-[#1E293B]'
                        }`}
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>Téléphone (SMS)</span>
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={authMethod === 'email'}
                        onClick={() => setAuthMethod('email')}
                        className={`relative z-10 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors duration-200 min-h-[38px] whitespace-nowrap ${
                          authMethod === 'email'
                            ? 'text-[#1A73E8]'
                            : 'text-slate-600 hover:text-[#1E293B]'
                        }`}
                      >
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span>Adresse e-mail</span>
                      </button>
                    </div>

                    <form
                      key={`${authMode}-${authMethod}`}
                      onSubmit={authMethod === 'phone' ? handlePhoneRequestSubmit : handleEmailSubmit}
                      className="space-y-4 animate-auth-panel"
                    >
                      {authMode === 'register' && (
                        <>
                          {/* Subscription Plan Selector: Mensuel / Trimestriel / Annuel */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-700">
                                Choisir la formule d&apos;abonnement
                              </span>
                              <span className="font-mono-num text-xs font-bold text-[#2E7D32]">
                                {formatFcfa(activePlan.amountFcfa)} {activePlan.periodFr}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              {SUBSCRIPTION_PLANS.map((plan) => {
                                const selected = selectedPlan === plan.id;
                                return (
                                  <button
                                    key={plan.id}
                                    type="button"
                                    onClick={() => setSelectedPlan(plan.id)}
                                    className={`rounded-xl border p-2.5 text-left transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] ${
                                      selected
                                        ? 'border-[#2E7D32] bg-[#2E7D32]/10 shadow-[0_0_0_2px_rgba(46,125,50,0.12)]'
                                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="text-xs font-bold text-[#1E293B]">{plan.labelFr}</div>
                                    <div className="mt-0.5 font-mono-num text-xs sm:text-sm font-bold text-[#2E7D32]">
                                      {formatFcfa(plan.amountFcfa)}
                                    </div>
                                    <div className="mt-0.5 text-[10px] text-slate-500 leading-tight font-mono-num">
                                      {formatFcfa(plan.monthlyEquivalentFcfa)}/mois
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <ModernAuthInput
                              id="auth-fullname"
                              label="Nom complet / Président"
                              type="text"
                              required
                              minLength={2}
                              maxLength={100}
                              autoComplete="name"
                              value={displayName}
                              onChange={setDisplayName}
                              placeholder="Ex: Mamadou Diop"
                              icon={<User className="h-4 w-4" />}
                            />
                            <ModernAuthInput
                              id="auth-orgname"
                              label="Coopérative / Ferme"
                              type="text"
                              maxLength={120}
                              autoComplete="organization"
                              value={orgName}
                              onChange={setOrgName}
                              placeholder="Ex: Coopérative Niayes"
                              icon={<Building2 className="h-4 w-4" />}
                            />
                          </div>
                        </>
                      )}

                      {authMethod === 'phone' ? (
                        <ModernAuthInput
                          inputRef={phoneInputRef}
                          id="auth-phone"
                          label="Numéro de téléphone (avec indicatif)"
                          type="tel"
                          required
                          autoComplete="tel"
                          value={phone}
                          onChange={setPhone}
                          placeholder="+221 77 450 28 19"
                          mono
                          icon={<Phone className="h-4 w-4" />}
                          helperText="Un code de validation par SMS sera envoyé à ce numéro (ex : +221 77 450 28 19)."
                        />
                      ) : (
                        <div className="space-y-3">
                          <ModernAuthInput
                            inputRef={emailInputRef}
                            id="auth-email"
                            label="Adresse e-mail"
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={setEmail}
                            placeholder="president@cooperative.sn"
                            accent="blue"
                            icon={<Mail className="h-4 w-4" />}
                          />

                          <div>
                            <ModernAuthInput
                              id="auth-password"
                              label="Mot de passe"
                              type={showPassword ? 'text' : 'password'}
                              required
                              minLength={6}
                              autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                              value={password}
                              onChange={setPassword}
                              placeholder={authMode === 'register' ? '6 caractères minimum' : 'Votre mot de passe'}
                              accent="blue"
                              icon={<Lock className="h-4 w-4" />}
                              rightElement={
                                <button
                                  type="button"
                                  onClick={() => setShowPassword((prev) => !prev)}
                                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              }
                            />
                            {authMode === 'login' && (
                              <div className="mt-1.5 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => onResetPassword(email.trim())}
                                  disabled={loading}
                                  className="text-xs font-semibold text-[#1A73E8] hover:underline"
                                >
                                  Mot de passe oublié ?
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {authMode === 'register' && (
                        <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/75 hover:border-slate-300 hover:bg-white focus-within:border-[#2E7D32] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(46,125,50,0.12)] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]">
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2E7D32] group-focus-within:scale-110 transition-all duration-200"
                          >
                            <CreditCard className="h-4 w-4" />
                          </span>
                          <label
                            htmlFor="auth-pay-channel"
                            className="pointer-events-none absolute left-10 top-2 text-[11px] font-semibold text-slate-500 group-focus-within:text-[#2E7D32] transition-colors duration-200"
                          >
                            Canal de règlement préféré
                          </label>
                          <select
                            id="auth-pay-channel"
                            value={paymentChannel}
                            onChange={(e) => setPaymentChannel(e.target.value as PaymentChannel)}
                            className="w-full appearance-none bg-transparent pt-5 pb-2 pl-10 pr-9 text-sm font-medium text-[#1E293B] focus:outline-none min-h-[54px] cursor-pointer"
                          >
                            <option value="wave">Wave Business</option>
                            <option value="orange_money">Orange Money</option>
                            <option value="free_money">Free Money</option>
                            <option value="cash">Espèces / Agence</option>
                          </select>
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2E7D32] transition-colors"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </span>
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-center scale-x-0 bg-[#2E7D32] transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] group-focus-within:scale-x-100"
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="group w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2E7D32] px-5 py-3 text-sm font-semibold text-white hover:bg-[#256428] active:scale-[0.99] disabled:opacity-60 transition-all duration-200 min-h-[48px]"
                      >
                        {authMethod === 'phone' ? (
                          <Phone className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                        ) : (
                          <Mail className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                        )}
                        <span>
                          {loading
                            ? authMethod === 'phone'
                              ? 'Envoi du code SMS...'
                              : authMode === 'register'
                                ? 'Création du compte...'
                                : 'Connexion...'
                            : authMethod === 'phone'
                              ? authMode === 'register'
                                ? `Recevoir le code SMS · ${activePlan.labelFr} (${formatFcfa(activePlan.amountFcfa)})`
                                : 'Se connecter par SMS'
                              : authMode === 'register'
                                ? `S'inscrire · ${activePlan.labelFr} (${formatFcfa(activePlan.amountFcfa)})`
                                : 'Se connecter avec mon e-mail'}
                        </span>
                        {!loading && (
                          <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                        )}
                      </button>
                    </form>
                  </>
                )}

                {/* Invisible Firebase reCAPTCHA mount target */}
                <div id="agrikoom-recaptcha-container" />
              </div>
            </div>
          </div>

          {/* Subscription Plans Section (#tarif) */}
          <div id="tarif" className="mt-14 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#1E293B]">
                  Formules d&apos;abonnement AgriKoom
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Choisissez la cadence adaptée à votre coopérative : mensuelle, trimestrielle ou annuelle.
                  Règlement Wave Business, Orange Money ou Free Money.
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500">
                Tous modules inclus · Multi-rôles illimités
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SUBSCRIPTION_PLANS.map((plan) => {
                const isSelected = selectedPlan === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={`rounded-2xl border bg-white p-5 flex flex-col justify-between gap-4 transition-colors ${
                      isSelected ? 'border-[#2E7D32]' : 'border-slate-200'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display text-lg font-bold text-[#1E293B]">
                          Abonnement {plan.labelFr}
                        </h3>
                        {plan.highlightFr && (
                          <span className="text-xs font-semibold text-[#2E7D32]">
                            {plan.highlightFr}
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline gap-2">
                        <span className="font-mono-num text-2xl font-bold text-[#1E293B]">
                          {formatFcfa(plan.amountFcfa)}
                        </span>
                        <span className="text-xs text-slate-500">{plan.periodFr}</span>
                      </div>

                      <p className="font-mono-num text-xs font-semibold text-[#2E7D32]">
                        Soit {formatFcfa(plan.monthlyEquivalentFcfa)} / mois
                      </p>

                      <p className="text-xs text-slate-600 pt-1">{plan.summaryFr}</p>

                      <ul className="pt-2 space-y-1.5 text-xs text-slate-600 border-t border-slate-100">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#2E7D32] shrink-0" />
                          <span>Caisse POS, Stocks &amp; Dettes clients</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#2E7D32] shrink-0" />
                          <span>Pointage ouvriers, Paie &amp; Bilan WhatsApp</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#2E7D32] shrink-0" />
                          <span>Export comptable CSV &amp; Bancaire LBA/BNDE</span>
                        </li>
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => focusAuthCard('register', plan.id)}
                      className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors min-h-[44px] ${
                        isSelected
                          ? 'bg-[#2E7D32] text-white hover:bg-[#256428]'
                          : 'border border-slate-300 bg-white text-[#1E293B] hover:bg-slate-50'
                      }`}
                    >
                      <CreditCard className="h-4 w-4 shrink-0" />
                      <span>Choisir {plan.labelFr}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4-column summary row */}
          <div id="modules" className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2.5 text-[#2E7D32]">
                <Smartphone className="h-5 w-5 shrink-0" />
                <h2 className="font-display text-sm font-bold text-[#1E293B]">Caisse POS &amp; Stocks</h2>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Saisie en 2 clics, ventilation Espèces / Wave / Orange Money / Crédit et seuils critiques.
              </p>
            </div>
            <div id="offline" className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2.5 text-[#1A73E8]">
                <WifiOff className="h-5 w-5 shrink-0" />
                <h2 className="font-display text-sm font-bold text-[#1E293B]">Offline-First IndexedDB</h2>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Continuez d&apos;encaisser et pointer sans réseau 3G ; synchronisation automatique au retour du signal.
              </p>
            </div>
            <div id="whatsapp" className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2.5 text-[#FFB300]">
                <MessageSquare className="h-5 w-5 shrink-0" />
                <h2 className="font-display text-sm font-bold text-[#1E293B]">Bilan WhatsApp 18h/20h</h2>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Synthèse CA, trésorerie, dettes en retard et alertes stock prête à envoyer aux présidents.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2.5 text-[#2E7D32]">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                <h2 className="font-display text-sm font-bold text-[#1E293B]">Dès 24 000 FCFA / mois</h2>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Organisation multi-rôles illimitée (Admin, Caissier, Pointeur) + export bancaire LBA/BNDE.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
