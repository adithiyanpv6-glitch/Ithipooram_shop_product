'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Lock, Delete, AlertCircle, ShieldCheck, RefreshCw, LogOut } from 'lucide-react';

export default function ScreenLockGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Excluded public customer or login routes
  const isExcludedRoute = 
    !pathname || 
    pathname === '/login' || 
    pathname.startsWith('/order') || 
    pathname.startsWith('/t/');

  // Listen for screen off, device sleep, or app backgrounding
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const wasLocked = sessionStorage.getItem('ithi_pos_screen_locked');
    const userLoggedIn = localStorage.getItem('ithipooram_user');
    if (wasLocked === 'true' && userLoggedIn && !isExcludedRoute) {
      setIsLocked(true);
    }

    const handleVisibilityChange = () => {
      const user = localStorage.getItem('ithipooram_user');
      if (document.visibilityState === 'hidden') {
        if (user && !isExcludedRoute) {
          sessionStorage.setItem('ithi_pos_screen_locked', 'true');
          setIsLocked(true);
        }
      } else if (document.visibilityState === 'visible') {
        if (user && !isExcludedRoute) {
          if (sessionStorage.getItem('ithi_pos_screen_locked') === 'true') {
            setIsLocked(true);
            setPin('');
            setError(null);
          }
        }
      }
    };

    const handleBlur = () => {
      const user = localStorage.getItem('ithipooram_user');
      if (user && !isExcludedRoute) {
        sessionStorage.setItem('ithi_pos_screen_locked', 'true');
      }
    };

    const handleFocus = () => {
      const user = localStorage.getItem('ithipooram_user');
      if (user && !isExcludedRoute && sessionStorage.getItem('ithi_pos_screen_locked') === 'true') {
        setIsLocked(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleBlur);
    window.addEventListener('pageshow', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleBlur);
      window.removeEventListener('pageshow', handleFocus);
    };
  }, [isExcludedRoute]);

  // Handle keypad entry
  const handleDigit = (digit: string) => {
    if (loading) return;
    setError(null);
    if (pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      if (next.length === 4) {
        verifyPinAndUnlock(next);
      }
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    setError(null);
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (loading) return;
    setPin('');
    setError(null);
  };

  // Physical keyboard listener
  useEffect(() => {
    if (!isLocked) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, pin, loading]);

  const verifyPinAndUnlock = async (enteredPin: string) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/auth/pin-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', pin: enteredPin }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Incorrect Security PIN');
      }

      sessionStorage.removeItem('ithi_pos_screen_locked');
      setIsLocked(false);
      setPin('');
    } catch (err: any) {
      setError(err.message || 'Incorrect PIN. Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOutToLogin = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('ithi_pos_screen_locked');
      localStorage.removeItem('ithipooram_user');
      localStorage.removeItem('ithipooram_token');
    }
    setIsLocked(false);
    router.replace('/login');
  };

  if (!isLocked || isExcludedRoute) {
    return null;
  }

  return (
    <aside 
      aria-label="POS Security Screen Lock"
      className="fixed inset-0 z-[9999] bg-[#0A0C10]/95 backdrop-blur-3xl flex flex-col items-center justify-center p-4 sm:p-6 font-sans select-none text-white animate-in fade-in duration-200"
    >
      <div className="max-w-sm w-full bg-gradient-to-b from-zinc-900/90 to-zinc-950/95 border border-zinc-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 flex flex-col items-center text-center space-y-6">
        
        {/* Brand & Lock Header */}
        <div className="flex flex-col items-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10 relative">
            <Lock className="w-8 h-8 text-amber-400" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-zinc-900" />
          </div>

          <div className="space-y-0.5 pt-1">
            <h1 className="text-2xl font-black text-white tracking-wide">ഇത്തിപ്പൂരം</h1>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">
              ITHI POORAM &bull; POS SCREEN LOCKED
            </p>
          </div>
          <p className="text-xs text-zinc-400 max-w-[260px]">
            Enter your 4-digit Master Security PIN to resume
          </p>
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="w-full py-2.5 px-3 rounded-2xl bg-rose-950/90 border border-rose-600/80 text-rose-200 text-xs font-bold flex items-center space-x-2 animate-in shake duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="flex-1 text-left">{error}</span>
          </div>
        )}

        {/* 4-Dot PIN Indicator */}
        <div className="flex items-center justify-center space-x-5 py-1">
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = idx < pin.length;
            return (
              <div
                key={idx}
                className={`w-5 h-5 rounded-full transition-all duration-200 flex items-center justify-center ${
                  isFilled
                    ? 'bg-amber-400 scale-125 shadow-[0_0_16px_rgba(251,191,36,0.9)] border-2 border-amber-300'
                    : 'bg-zinc-800/90 border-2 border-zinc-700'
                }`}
              >
                {isFilled && <div className="w-2 h-2 rounded-full bg-black/60" />}
              </div>
            );
          })}
        </div>

        {/* Professional Large-Button Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full pt-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              disabled={loading}
              className="h-16 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 active:bg-amber-400 active:text-black border border-zinc-700/80 text-white font-black text-2xl flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 touch-manipulation"
            >
              {digit}
            </button>
          ))}

          {/* CLEAR Button: High Contrast, Prominent, Clearly Visible */}
          <button
            type="button"
            onClick={handleClear}
            disabled={loading}
            className="h-16 rounded-2xl bg-rose-950/60 hover:bg-rose-900 border-2 border-rose-500/80 text-rose-200 hover:text-white font-black text-sm uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 touch-manipulation"
            title="Clear entered PIN"
          >
            CLEAR
          </button>

          {/* 0 Button */}
          <button
            type="button"
            onClick={() => handleDigit('0')}
            disabled={loading}
            className="h-16 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 active:bg-amber-400 active:text-black border border-zinc-700/80 text-white font-black text-2xl flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 touch-manipulation"
          >
            0
          </button>

          {/* BACKSPACE Button */}
          <button
            type="button"
            onClick={handleBackspace}
            disabled={loading}
            className="h-16 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 border-2 border-zinc-600/80 text-zinc-200 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 touch-manipulation"
            title="Backspace"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Footer Actions: Switch User / Sign Out fallback */}
        <div className="w-full flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs">
          <span className="text-[11px] text-zinc-500 font-medium">
            POS Security Active
          </span>
          <button
            type="button"
            onClick={handleSignOutToLogin}
            className="text-amber-400/90 hover:text-amber-300 font-bold flex items-center space-x-1.5 transition cursor-pointer py-1 px-2 rounded-lg hover:bg-zinc-800"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Switch User</span>
          </button>
        </div>

      </div>
    </aside>
  );
}
