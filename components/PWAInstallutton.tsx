'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface Props {
  className?: string;
  label?: string;
  showIcon?: boolean;
}

export function PWAInstallButton({
  className,
  label = 'Install App',
  showIcon = true,
}: Props) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone/installed mode
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsStandalone(standaloneMode);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  // Hide if already running inside the installed PWA
  if (isStandalone) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      // If browser doesn't expose automatic prompt, show guided walkthrough
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className={
          className ||
          'inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition active:scale-95 cursor-pointer'
        }
      >
        {showIcon && (
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        )}
        <span>{label}</span>
      </button>

      {/* Guided Installation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center">
                  📱
                </div>
                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                  Install on Your Phone
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {isIOS ? (
              /* Apple iPhone / iPad Safari Instructions */
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Install this app directly to your home screen using <strong>Safari</strong>:
                </p>

                <ol className="text-xs text-slate-800 space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <li className="flex items-start gap-2.5">
                    <span className="font-bold text-emerald-600 shrink-0">1.</span>
                    <span>
                      Tap the <strong>Share</strong> button at the bottom of Safari (the square icon with an upward arrow ⬆️).
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-bold text-emerald-600 shrink-0">2.</span>
                    <span>
                      Scroll down and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong> (➕).
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-bold text-emerald-600 shrink-0">3.</span>
                    <span>
                      Tap <strong>&ldquo;Add&rdquo;</strong> at the top right to complete.
                    </span>
                  </li>
                </ol>
              </div>
            ) : (
              /* Android Chrome or Desktop Browser Instructions */
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  To install on your Android device or Chrome browser:
                </p>

                <ol className="text-xs text-slate-800 space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <li className="flex items-start gap-2.5">
                    <span className="font-bold text-emerald-600 shrink-0">1.</span>
                    <span>
                      Tap the <strong>three dots menu (⋮)</strong> in the top-right corner of Chrome.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-bold text-emerald-600 shrink-0">2.</span>
                    <span>
                      Tap <strong>&ldquo;Install app&rdquo;</strong> or <strong>&ldquo;Add to Home screen&rdquo;</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-bold text-emerald-600 shrink-0">3.</span>
                    <span>
                      Confirm by tapping <strong>&ldquo;Install&rdquo;</strong>.
                    </span>
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}
    </>
  );
}