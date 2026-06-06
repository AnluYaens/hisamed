'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
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
        <IosInstallModal open={showIosModal} onOpenChange={setShowIosModal} />
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

function IosInstallModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {/* Portaled to <body>, so the modal escapes the `backdrop-filter` on the
          dashboard's .glass-header/.glass-panel ancestors. Those filters
          establish a containing block for `position: fixed`, which would
          otherwise anchor the modal to the header strip instead of the
          viewport. */}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-sm" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-2xl bg-white p-6 shadow-xl outline-none transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>

          <Dialog.Title className="text-base font-semibold text-slate-900">
            Instalar Hisamed
          </Dialog.Title>

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
            onClick={() => onOpenChange(false)}
            className="mt-6 w-full"
          >
            Entendido
          </Button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
