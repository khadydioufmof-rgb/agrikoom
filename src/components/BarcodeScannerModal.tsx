import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserCodeReader, BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Flashlight,
  Keyboard,
  RefreshCw,
  ScanBarcode,
  X,
} from 'lucide-react';

export interface BarcodeScanOutcome {
  ok: boolean;
  message: string;
  autoClose?: boolean;
}

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (code: string) => BarcodeScanOutcome | Promise<BarcodeScanOutcome>;
  title?: string;
  subtitle?: string;
  defaultContinuous?: boolean;
  showContinuousToggle?: boolean;
}

function playBeep(success: boolean) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = success ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(success ? 1046.5 : 320, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (success ? 0.12 : 0.18));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.13 : 0.19));
    setTimeout(() => {
      ctx.close().catch(() => undefined);
    }, 300);
  } catch {
    // Ignore audio context restrictions
  }
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onDetected,
  title = 'Scanner un code-barres',
  subtitle = 'Placez le code-barres (EAN-13, Code 128, QR) dans le cadre de la caméra',
  defaultContinuous = true,
  showContinuousToggle = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastScanRef = useRef<{ code: string; ts: number }>({ code: '', ts: 0 });
  const processingRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [continuous, setContinuous] = useState(defaultContinuous);
  const continuousRef = useRef(continuous);
  continuousRef.current = continuous;

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [status, setStatus] = useState<BarcodeScanOutcome | null>(null);
  const [manualCode, setManualCode] = useState('');

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      // Ignore stop error
    }
    controlsRef.current = null;

    const videoEl = videoRef.current;
    if (videoEl && videoEl.srcObject) {
      const stream = videoEl.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop failure
        }
      });
      videoEl.srcObject = null;
    }

    try {
      BrowserCodeReader.releaseAllStreams();
    } catch {
      // Ignore cleanup error
    }

    setCameraReady(false);
    setTorchSupported(false);
    setTorchOn(false);
  }, []);

  const processScannedCode = useCallback(async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code || processingRef.current) return;

    const now = Date.now();
    if (lastScanRef.current.code === code && now - lastScanRef.current.ts < 1400) {
      return;
    }

    lastScanRef.current = { code, ts: now };
    processingRef.current = true;
    try {
      const outcome = await onDetectedRef.current(code);
      setStatus(outcome);
      playBeep(outcome.ok);

      if (outcome.autoClose || (outcome.ok && !continuousRef.current)) {
        setTimeout(() => {
          stopCamera();
          onCloseRef.current();
        }, 250);
      }
    } finally {
      processingRef.current = false;
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setStatus(null);
      setCameraError(null);
      setManualCode('');
      lastScanRef.current = { code: '', ts: 0 };
      return;
    }

    setContinuous(defaultContinuous);
  }, [isOpen, defaultContinuous, stopCamera]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setCameraError(null);
    setCameraReady(false);

    const startScanner = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Caméra non disponible dans ce navigateur. Utilisez la saisie manuelle ou un lecteur USB ci-dessous.'
        );
        return;
      }

      const hints = new Map<DecodeHintType, unknown>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
        BarcodeFormat.QR_CODE,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 180,
        delayBetweenScanSuccess: 600,
      });

      const videoEl = videoRef.current;
      if (!videoEl) return;

      try {
        const callback = (
          result: { getText: () => string } | undefined,
          _err: unknown,
          controls: IScannerControls
        ) => {
          if (cancelled) {
            controls.stop();
            return;
          }
          controlsRef.current = controls;
          if (result) {
            void processScannedCode(result.getText());
          }
        };

        const controls = activeDeviceId
          ? await reader.decodeFromVideoDevice(activeDeviceId, videoEl, callback)
          : await reader.decodeFromConstraints(
              {
                audio: false,
                video: {
                  facingMode: { ideal: 'environment' },
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
              },
              videoEl,
              callback
            );

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setCameraReady(true);

        // Check torch capability on active stream
        const stream = videoEl.srcObject as MediaStream | null;
        if (stream) {
          const [track] = stream.getVideoTracks();
          if (track) {
            setTorchSupported(BrowserCodeReader.mediaStreamIsTorchCompatibleTrack(track));
          }
        }

        try {
          const list = await BrowserCodeReader.listVideoInputDevices();
          if (!cancelled && list.length > 0) {
            setDevices(list);
          }
        } catch {
          // Ignore device listing errors on restricted browsers
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
          setCameraError(
            "Autorisation caméra refusée. Activez l'accès caméra dans votre navigateur ou saisissez le code manuellement ci-dessous."
          );
        } else if (msg.toLowerCase().includes('notfound') || msg.toLowerCase().includes('device')) {
          setCameraError(
            'Aucune caméra détectée sur cet appareil. Saisissez ou scannez le code manuellement ci-dessous.'
          );
        } else {
          setCameraError(
            "Impossible de démarrer la caméra. Vous pouvez tout de même saisir ou scanner le code manuellement ci-dessous."
          );
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, activeDeviceId, processScannedCode, stopCamera]);

  const handleToggleTorch = async () => {
    const videoEl = videoRef.current;
    const stream = videoEl?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await BrowserCodeReader.mediaStreamSetTorch(track, next);
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  };

  const handleSwitchCamera = () => {
    if (devices.length <= 1) return;
    const currentIndex = devices.findIndex((d) => d.deviceId === activeDeviceId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % devices.length : 0;
    setActiveDeviceId(devices[nextIndex].deviceId);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualCode.trim();
    if (!trimmed) return;
    lastScanRef.current = { code: '', ts: 0 };
    await processScannedCode(trimmed);
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2E7D32]/10 text-[#2E7D32] shrink-0">
              <ScanBarcode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-[#1E293B]">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label="Fermer le scanner"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="p-5 space-y-4">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-950 border border-slate-800">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className="h-full w-full object-cover"
            />

            {/* Framing Guide */}
            {!cameraError && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                <div className="relative h-40 w-full max-w-[290px] rounded-xl border border-white/25 bg-black/10">
                  <span className="absolute -top-0.5 -left-0.5 h-6 w-6 rounded-tl-xl border-t-4 border-l-4 border-[#FFB300]" />
                  <span className="absolute -top-0.5 -right-0.5 h-6 w-6 rounded-tr-xl border-t-4 border-r-4 border-[#FFB300]" />
                  <span className="absolute -bottom-0.5 -left-0.5 h-6 w-6 rounded-bl-xl border-b-4 border-l-4 border-[#FFB300]" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-br-xl border-b-4 border-r-4 border-[#FFB300]" />
                  <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-0.5 bg-[#FFB300]/80" />
                </div>
              </div>
            )}

            {/* Loading Camera Overlay */}
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/75 text-white p-4 text-center">
                <Camera className="h-8 w-8 text-[#FFB300] mb-2" />
                <p className="text-xs font-medium text-slate-200">Activation de la caméra en cours...</p>
              </div>
            )}

            {/* Error Overlay */}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 text-white p-6 text-center">
                <AlertCircle className="h-8 w-8 text-[#FFB300] mb-2" />
                <p className="text-sm font-semibold text-white">Caméra indisponible</p>
                <p className="mt-1 text-xs text-slate-300 max-w-xs">{cameraError}</p>
              </div>
            )}

            {/* Camera Controls Overlay */}
            {cameraReady && !cameraError && (
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                {torchSupported && (
                  <button
                    type="button"
                    onClick={handleToggleTorch}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold backdrop-blur-md min-h-[40px] ${
                      torchOn
                        ? 'bg-[#FFB300] text-[#1E293B]'
                        : 'bg-slate-900/75 text-white border border-white/20'
                    }`}
                  >
                    <Flashlight className="h-3.5 w-3.5" />
                    <span>Torche</span>
                  </button>
                )}
                {devices.length > 1 && (
                  <button
                    type="button"
                    onClick={handleSwitchCamera}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900/75 border border-white/20 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md min-h-[40px]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Changer caméra</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Scan Feedback Banner */}
          {status && (
            <div
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                status.ok
                  ? 'border-[#2E7D32]/30 bg-[#2E7D32]/10 text-[#2E7D32]'
                  : 'border-[#D32F2F]/30 bg-[#D32F2F]/10 text-[#D32F2F]'
              }`}
            >
              {status.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{status.message}</span>
            </div>
          )}

          {/* Continuous Mode Toggle */}
          {showContinuousToggle && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <div>
                <p className="text-xs font-semibold text-[#1E293B]">Scan continu multi-articles</p>
                <p className="text-[11px] text-slate-500">
                  {continuous
                    ? 'Reste ouvert après chaque scan pour enchaîner les produits'
                    : 'Ferme automatiquement le scanner après 1 produit ajouté'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={continuous}
                onClick={() => setContinuous((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  continuous ? 'bg-[#2E7D32]' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    continuous ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Manual / USB Scanner Fallback */}
          <form onSubmit={handleManualSubmit} className="space-y-1.5">
            <label htmlFor="manual-barcode-input" className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Keyboard className="h-3.5 w-3.5 text-[#1A73E8]" />
              <span>Saisie manuelle ou douchette USB</span>
            </label>
            <div className="flex gap-2">
              <input
                id="manual-barcode-input"
                type="text"
                maxLength={64}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ex: 6041000001015"
                className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 font-mono-num text-sm text-[#1E293B] focus:border-[#2E7D32] focus:outline-none min-h-[44px]"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="rounded-xl bg-[#2E7D32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#256428] disabled:opacity-50 min-h-[44px] whitespace-nowrap"
              >
                Valider
              </button>
            </div>
          </form>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-[#1E293B] hover:bg-slate-50 min-h-[44px]"
            >
              Terminer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
