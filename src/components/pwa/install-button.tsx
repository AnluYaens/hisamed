'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Share, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isIosSafari } from '@/lib/pwa/install';

// `beforeinstallprompt` is a Chromium-only, non-standard event not present in
// the DOM lib types. Minimal shape for what we use.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Discreet "Instalar app" button.
 *
 * Two install paths:
 *  - Chromium (`beforeinstallprompt` fires): the button triggers the native
 *    install prompt, and only shows while an install is actually available.
 *  - iOS Safari (never fires `beforeinstallprompt`): the button opens a small
 *    modal with manual "add to home screen" instructions, since that is the
 *    only way to install a PWA on iOS.
 *
 * Hidden everywhere when already installed (standalone) or once installed this
 * session. Never auto-shows a prompt or nags.
 */
export function InstallButton() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already running as an installed PWA → nothing to offer, on any platform.
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    if (standalone) return;

    // iOS Safari can't use `beforeinstallprompt`; surface the manual flow.
    if (isIosSafari(navigator.userAgent, standalone)) {
      setIsIos(true);
      return;
    }

    const onBeforeInstallPrompt = (e: Event) => {
      // Stop Chrome's mini-infobar; we surface our own button instead.
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    const onAppInstalled = () => {
      // Installed — retire the button for the rest of this session.
      deferredPrompt.current = null;
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  async function handleNativePrompt() {
    const promptEvent = deferredPrompt.current;
    if (!promptEvent) return;

    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;

    // The prompt event can only be used once. Drop our reference either way.
    deferredPrompt.current = null;
    if (outcome === 'accepted') {
      // Hide immediately; `appinstalled` will also fire shortly.
      setCanInstall(false);
    }
    // If dismissed, leave the button visible — Chromium re-dispatches
    // `beforeinstallprompt` later, restocking a fresh event.
  }

  // iOS Safari → button opens the manual-install instructions modal.
  if (isIos) {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowIosModal(true)}
          title="Instalar Hisamed como aplicación"
        >
          <Download className="h-4 w-4" />
          {/* Icon-only on mobile (where installing matters most); label on ≥sm. */}
          <span className="hidden sm:inline">Instalar app</span>
        </Button>
        {showIosModal && (
          <IosInstallModal onClose={() => setShowIosModal(false)} />
        )}
      </>
    );
  }

  if (!canInstall) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleNativePrompt}
      title="Instalar Hisamed como aplicación"
    >
      <Download className="h-4 w-4" />
      {/* Icon-only on mobile (where installing matters most); label on ≥sm. */}
      <span className="hidden sm:inline">Instalar app</span>
    </Button>
  );
}

/** Steps to add the PWA to the iOS home screen, in Spanish (app is ES-only). */
const IOS_STEPS = [
  {
    icon: Share,
    text: (
      <>
        Toca el ícono <strong>Compartir</strong> en la barra de Safari.
      </>
    ),
  },
  {
    icon: Plus,
    text: (
      <>
        Desplázate y elige <strong>Añadir a pantalla de inicio</strong>.
      </>
    ),
  },
  {
    icon: null,
    text: (
      <>
        Confirma tocando <strong>Añadir</strong> en la esquina superior derecha.
      </>
    ),
  },
] as const;

function IosInstallModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>

        <h2
          id="ios-install-title"
          className="text-base font-semibold text-slate-900"
        >
          Instalar Hisamed
        </h2>

        <ol className="mt-4 space-y-3">
          {IOS_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={i} className="flex items-start gap-3 text-[13.5px] text-slate-600">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600/10 text-[11px] font-semibold text-teal-700">
                  {i + 1}
                </span>
                <span className="flex items-center gap-1.5">
                  {step.text}
                  {Icon && <Icon className="inline h-4 w-4 shrink-0 text-slate-400" />}
                </span>
              </li>
            );
          })}
        </ol>

        <Button
          type="button"
          onClick={onClose}
          className="mt-6 w-full"
        >
          Entendido
        </Button>
      </div>
    </div>
  );
}
