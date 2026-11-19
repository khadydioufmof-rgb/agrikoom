import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ label: string }> = ({ label }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 rounded-lg border border-[#1A73E8]/30 bg-[#1A73E8]/10 px-3 py-2 text-xs font-semibold text-[#1A73E8] hover:bg-[#1A73E8]/15 transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
      >
        <Download className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <Download className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 border border-slate-200 shadow-xl">
              <h3 className="font-display text-lg font-bold text-[#1E293B]">Installer AgriKoom sur iPhone / iPad</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                1. Appuyez sur le bouton <strong>Partager</strong> dans la barre Safari.<br />
                2. Faites défiler et choisissez <strong>Sur l&apos;écran d&apos;accueil</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-[#2E7D32] py-2.5 text-sm font-semibold text-white hover:bg-[#256428] transition-colors min-h-[44px]"
              >
                Compris
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
