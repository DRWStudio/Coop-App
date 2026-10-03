'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// ---------------------------------------------------------------------------
// In-App PWA Install Trigger Component
// ---------------------------------------------------------------------------
function InstallButton({
  label = 'Install App',
  className,
  showIcon = true,
}: {
  label?: string;
  className?: string;
  showIcon?: boolean;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Detect if app is already running in standalone/installed mode
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

  // Suppress button if already installed and running as standalone app
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
          'inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition active:scale-95 cursor-pointer'
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

      {/* Guided Installation Walkthrough Modal */}
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
                      Tap <strong>&ldquo;Add&rdquo;</strong> in the top-right corner to finish.
                    </span>
                  </li>
                </ol>
              </div>
            ) : (
              /* Android Chrome or Desktop Browser Instructions */
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  To install on your Android phone or Chrome browser:
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

// ---------------------------------------------------------------------------
// Main Homepage Component
// ---------------------------------------------------------------------------
export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      {/* Navigation Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
              C
            </div>
            <div>
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 block leading-tight">
                CoopSavings
              </span>
              <span className="text-[10px] uppercase font-semibold text-emerald-600 tracking-wider">
                Credit & Thrift Society
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Header Install Button */}
            <InstallButton
              label="Install App"
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
            />

            <Link
              href="/login"
              className="text-xs sm:text-sm font-semibold text-slate-700 hover:text-emerald-600 px-2 py-2 transition"
            >
              Sign In
            </Link>

            <Link
              href="/register"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-xl shadow-sm transition active:scale-95"
            >
              Join Coop
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex-1 flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-6 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Dedicated NUBAN Accounts • 3-Month Savings Cycles • Housing Scheme
        </span>

        <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight max-w-4xl leading-[1.15]">
          Cooperative Savings with Your Own{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
            Dedicated Bank Account
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
          Transfer from any Nigerian bank directly into your dedicated NUBAN account. Track your 3-month savings cycle and contribute directly toward the cooperative housing scheme.
        </p>

        {/* Primary Call to Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-lg">
          <Link
            href="/register"
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-7 py-3.5 rounded-xl shadow-lg shadow-emerald-600/20 transition active:scale-95 text-center text-sm"
          >
            Create Your Account
          </Link>

          {/* Prominent Hero Install Button */}
          <InstallButton
            label="📲 Install App on Phone"
            showIcon={false}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold px-7 py-3.5 rounded-xl shadow-lg transition active:scale-95 text-center text-sm cursor-pointer"
          />

          <Link
            href="/login"
            className="w-full sm:w-auto bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-semibold px-6 py-3.5 rounded-xl transition text-center text-sm"
          >
            Sign In
          </Link>
        </div>

        {/* Install Notice Banner */}
        <div className="mt-12 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 font-bold text-2xl flex items-center justify-center shrink-0">
              ⚡
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Works Offline & Installs Directly on Any Phone
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                No app store download needed. Click &ldquo;Install App&rdquo; to add it to your home screen.
              </p>
            </div>
          </div>

          <InstallButton
            label="Install Now"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition shrink-0 cursor-pointer self-start sm:self-center"
          />
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left w-full">
          <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl mb-4">
              🏛️
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Instant Dedicated NUBAN</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              Every member gets an automated dedicated bank account number upon sign up. Transfer anytime to fund your wallet.
            </p>
          </div>

          <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xl mb-4">
              🏡
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Housing Project Scheme</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              Contribute daily or monthly toward your housing goal with real-time target progress bar tracking.
            </p>
          </div>

          <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl mb-4">
              ⏱️
            </div>
            <h3 className="font-bold text-slate-900 text-lg">3-Month Savings Cycles</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              Disciplined 3-month fixed cycles ensure investment maturity before payouts are approved directly to your verified bank account.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Cooperative Savings & Credit Society. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-slate-800">
              Member Sign In
            </Link>
            <Link href="/register" className="hover:text-slate-800">
              Join Cooperative
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}