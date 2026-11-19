import React, { useState } from 'react';
import { Delete, KeyRound, ShieldCheck, X } from 'lucide-react';
import type { OrgMember, UserRole } from '../types/agrikoom';

interface PinLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Array<OrgMember & { id: string; orgId: string }>;
  currentRole: UserRole;
  isSuperAdminEmail: boolean;
  onSelectRole: (role: UserRole, actorName: string) => void;
}

export const PinLockModal: React.FC<PinLockModalProps> = ({
  isOpen,
  onClose,
  members,
  currentRole,
  isSuperAdminEmail,
  onSelectRole,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string>(members[0]?.id || '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const activeMembers = members.filter((m) => m.active);
  const selectedMember = activeMembers.find((m) => m.id === selectedMemberId) || activeMembers[0];

  const handleDigit = (digit: string) => {
    setError('');
    if (pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      if (next.length === 4 && selectedMember) {
        if (next === selectedMember.pinCode) {
          onSelectRole(selectedMember.role, selectedMember.name);
          setPin('');
          onClose();
        } else {
          setError('Code PIN incorrect pour ce poste.');
          setTimeout(() => setPin(''), 350);
        }
      }
    }
  };

  const roleLabel = (r: string) => {
    if (r === 'admin') return 'Président / Admin';
    if (r === 'manager') return 'Gérant / Caissier';
    return 'Pointeur / Chef d\'équipe';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-5 w-5 text-[#2E7D32]" />
            <h2 className="font-display text-lg font-bold text-[#1E293B]">Verrouillage Rapide PIN (4 chiffres)</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-600">
          Sélectionnez le profil terrain sur cet appareil appairé et saisissez son code PIN à 4 chiffres.
        </p>

        {/* Staff selector */}
        <div className="mt-4 space-y-2">
          {activeMembers.map((member) => {
            const isSelected = (selectedMember?.id || '') === member.id;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => {
                  setSelectedMemberId(member.id);
                  setPin('');
                  setError('');
                }}
                className={`w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors min-h-[48px] ${
                  isSelected
                    ? 'border-[#2E7D32] bg-[#2E7D32]/5'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="text-sm font-semibold text-[#1E293B]">{member.name}</div>
                  <div className="text-xs text-slate-500">
                    {roleLabel(member.role)} · PIN configuré : <span className="font-mono-num font-medium">{member.pinCode}</span>
                  </div>
                </div>
                {currentRole === member.role && (
                  <span className="text-xs font-semibold text-[#2E7D32]">Actif</span>
                )}
              </button>
            );
          })}

          {isSuperAdminEmail && (
            <button
              type="button"
              onClick={() => {
                onSelectRole('super_admin', 'Super-Admin AgriKoom');
                onClose();
              }}
              className="w-full flex items-center justify-between rounded-xl border border-[#1A73E8]/30 bg-[#1A73E8]/5 px-3.5 py-2.5 text-left hover:bg-[#1A73E8]/10 transition-colors min-h-[48px]"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#1A73E8]" />
                <span className="text-sm font-semibold text-[#1E293B]">Console Super-Admin AgriKoom</span>
              </div>
              <span className="text-xs font-semibold text-[#1A73E8]">Accès éditeur</span>
            </button>
          )}
        </div>

        {/* PIN dots */}
        <div className="mt-5 flex items-center justify-center gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full border transition-colors ${
                i < pin.length
                  ? 'border-[#2E7D32] bg-[#2E7D32]'
                  : 'border-slate-300 bg-slate-100'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="mt-2.5 text-center text-xs font-semibold text-[#D32F2F]">{error}</p>
        )}

        {/* Touch Numeric Keypad */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0'].map((d, idx) =>
            d ? (
              <button
                key={d}
                type="button"
                onClick={() => handleDigit(d)}
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 font-mono-num text-lg font-semibold text-[#1E293B] hover:bg-slate-100 active:scale-[0.98] transition-transform"
              >
                {d}
              </button>
            ) : (
              <div key={`empty-${idx}`} />
            )
          )}
          <button
            type="button"
            onClick={() => setPin((p) => p.slice(0, -1))}
            aria-label="Effacer"
            className="h-12 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
