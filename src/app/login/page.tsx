'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ShieldCheck, Lock, Delete, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check if system master PIN is already configured
  useEffect(() => {
    const checkPinStatus = async () => {
      try {
        const res = await fetch('/api/auth/pin-status');
        if (res.ok) {
          const data = await res.json();
          setIsConfigured(Boolean(data.isConfigured));
          setIsSetupMode(!data.isConfigured);
        } else {
          setIsConfigured(true);
        }
      } catch {
        setIsConfigured(true);
      }
    };
    checkPinStatus();
  }, []);

  // Handle number button click on keypad
  const handleDigit = (digit: string) => {
    setErrorMessage(null);
    if (isSetupMode) {
      if (pin.length < 4) {
        const next = pin + digit;
        setPin(next);
      } else if (confirmPin.length < 4) {
        const next = confirmPin + digit;
        setConfirmPin(next);
      }
    } else {
      if (pin.length < 4) {
        const next = pin + digit;
        setPin(next);
        if (next.length === 4) {
          submitPin(next);
        }
      }
    }
  };

  const handleBackspace = () => {
    setErrorMessage(null);
    if (isSetupMode) {
      if (confirmPin.length > 0) {
        setConfirmPin(confirmPin.slice(0, -1));
      } else if (pin.length > 0) {
        setPin(pin.slice(0, -1));
      }
    } else {
      if (pin.length > 0) {
        setPin(pin.slice(0, -1));
      }
    }
  };

  const handleClear = () => {
    setPin('');
    setConfirmPin('');
    setErrorMessage(null);
  };

  // Keyboard support for desktop / laptop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, confirmPin, isSetupMode]);

  const submitPin = async (inputPin: string) => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ pin: inputPin }),
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem('ithipooram_user', JSON.stringify(res.user));
        localStorage.setItem('ithipooram_token', res.token || 'jwt-master-session');
        sessionStorage.removeItem('ithi_screen_locked');
      }

      setSuccessMessage('Access Granted! Opening POS...');
      setTimeout(() => {
        router.replace('/');
      }, 300);
    } catch (err: any) {
      setErrorMessage(err.message || 'Incorrect PIN. Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSetup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length !== 4) {
      setErrorMessage('Please enter a 4-digit security PIN.');
      return;
    }
    if (confirmPin.length !== 4) {
      setErrorMessage('Please confirm your 4-digit PIN.');
      return;
    }
    if (pin !== confirmPin) {
      setErrorMessage('PINs do not match. Please re-enter.');
      setConfirmPin('');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      // Register initial PIN via pin-status API
      const res = await fetch('/api/auth/pin-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPin: pin }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to setup Master PIN');
      }

      // Auto login with the newly created PIN
      await submitPin(pin);
    } catch (err: any) {
      setErrorMessage(err.message || 'Setup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0E12] text-white flex flex-col justify-center items-center p-4 font-sans select-none">
      <div className="max-w-xs sm:max-w-sm w-full flex flex-col items-center text-center space-y-6">
        
        {/* Brand Calligraphy Header */}
        <div className="flex flex-col items-center space-y-2">
          <div className="relative w-48 h-12">
            <Image
              src="/brand-calligraphy-uploaded.png"
              alt="ഇത്തിപ്പൂരം Ithi Pooram"
              fill
              className="object-contain filter invert contrast-125"
              priority
            />
          </div>
          <p className="text-[11px] font-bold text-zinc-400 tracking-wider uppercase">
            Vanchiyoor, Trivandrum &bull; Restaurant Terminal
          </p>
        </div>

        {/* Security Status Badge */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-bold text-zinc-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>{isSetupMode ? 'System Setup & Master Security' : 'POS Terminal Security Gateway'}</span>
        </div>

        {/* Dynamic Title */}
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white">
            {isSetupMode ? 'Create Master Security PIN' : 'Enter 4-Digit Security PIN'}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {isSetupMode 
              ? 'Set your primary authorization PIN to secure POS, billing, and system settings'
              : 'Authorized access to Ithi Pooram billing counter and operational console'}
          </p>
        </div>

        {/* Error / Success Feedback */}
        {errorMessage && (
          <div className="w-full p-2.5 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="flex-1 text-left">{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="w-full p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="flex-1 text-left">{successMessage}</span>
          </div>
        )}

        {/* PIN Indicators Display */}
        {!isSetupMode ? (
          <div className="flex items-center justify-center space-x-4 py-2">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  idx < pin.length
                    ? 'bg-white scale-125 shadow-[0_0_12px_rgba(255,255,255,0.7)]'
                    : 'bg-zinc-800 border border-zinc-700'
                }`}
              />
            ))}
          </div>
        ) : (
          <div className="w-full space-y-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase text-zinc-400 mb-1.5">Step 1: Enter New PIN</p>
              <div className="flex items-center justify-center space-x-3">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                      idx < pin.length
                        ? 'bg-emerald-400 scale-110 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                        : 'bg-zinc-800 border border-zinc-700'
                    }`}
                  />
                ))}
              </div>
            </div>
            {pin.length === 4 && (
              <div className="animate-in fade-in slide-in-from-top-1">
                <p className="text-[10px] font-extrabold uppercase text-zinc-400 mb-1.5">Step 2: Confirm PIN</p>
                <div className="flex items-center justify-center space-x-3">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                        idx < confirmPin.length
                          ? 'bg-emerald-400 scale-110 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                          : 'bg-zinc-800 border border-zinc-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
            {pin.length === 4 && confirmPin.length === 4 && (
              <button
                type="button"
                onClick={() => handleCompleteSetup()}
                disabled={loading}
                className="w-full mt-2 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-black text-xs transition cursor-pointer flex items-center justify-center space-x-2 active:scale-95 shadow-lg"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Confirm &amp; Save Master PIN</span>}
              </button>
            )}
          </div>
        )}

        {/* Touchscreen Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5 w-full pt-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              disabled={loading}
              className="h-14 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 active:bg-white active:text-black border border-zinc-800 text-white font-extrabold text-xl flex items-center justify-center transition cursor-pointer shadow-xs active:scale-95"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800/60 font-bold text-xs uppercase tracking-wider flex items-center justify-center transition cursor-pointer active:scale-95"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            disabled={loading}
            className="h-14 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 active:bg-white active:text-black border border-zinc-800 text-white font-extrabold text-xl flex items-center justify-center transition cursor-pointer shadow-xs active:scale-95"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800/60 flex items-center justify-center transition cursor-pointer active:scale-95"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Footer Note */}
        <p className="text-[10px] text-zinc-500 font-medium">
          Physical keyboard typing supported &bull; Stored securely in laptop master database
        </p>

      </div>
    </div>
  );
}
