'use client';

import React, { useState } from 'react';
import { apiPost } from '../../lib/api';
import {
  X,
  KeyRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  BellRing,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export default function ForgotPasswordModal({
  isOpen,
  onClose,
  initialEmail = '',
}: ForgotPasswordModalProps) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // States
  // 'initial' | 'sent_to_admin' | 'ceo_recovery' | 'ceo_success'
  const [stage, setStage] = useState<'initial' | 'sent_to_admin' | 'ceo_recovery' | 'ceo_success'>('initial');
  const [adminNotice, setAdminNotice] = useState('');

  // CEO recovery inputs
  const [masterKey, setMasterKey] = useState('');
  const [ceoNewPassword, setCeoNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your corporate email address.');
      return;
    }

    setLoading(true);

    try {
      const res = await apiPost('/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      });

      if (res.success) {
        if (res.isCeo) {
          setStage('ceo_recovery');
        } else {
          setAdminNotice(
            res.message ||
              'A password reset request has been forwarded to the Super Admin. Your administrator will reset your credentials and provide them to you.'
          );
          setStage('sent_to_admin');
        }
      } else {
        setError(res.message || 'Unable to process reset request.');
      }
    } catch (err: any) {
      setError(err?.message || 'Server error while requesting password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleCeoResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!masterKey.trim() || !ceoNewPassword) {
      setError('Please provide both the Master Recovery Key and new password.');
      return;
    }

    if (ceoNewPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await apiPost('/auth/ceo-reset-password', {
        email: email.trim().toLowerCase(),
        masterKey: masterKey.trim(),
        newPassword: ceoNewPassword,
      });

      if (res.success) {
        setStage('ceo_success');
      } else {
        setError(res.message || 'CEO reset failed. Please check your Master Recovery Key.');
      }
    } catch (err: any) {
      setError(err?.message || 'Server error while executing CEO reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setStage('initial');
    setMasterKey('');
    setCeoNewPassword('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-[#1F293D] rounded-3xl w-full max-w-md shadow-2xl shadow-black/90 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#1F293D] flex items-center justify-between bg-[#0E1424]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#5470F4]/10 border border-[#5470F4]/30 flex items-center justify-center text-[#5CC5FA]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Reset Account Access</h3>
              <p className="text-xs text-gray-400">Neximet Corporate Portal Security</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#161F30] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {stage === 'initial' && (
            <form onSubmit={handleInitialSubmit} className="space-y-4">
              <p className="text-xs text-gray-300 leading-relaxed">
                Enter your registered corporate email address. If you are an employee or manager, an administrative password reset notification will be dispatched immediately to the <strong>Super Admin</strong>.
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Corporate Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@neximet.com"
                    required
                    autoFocus
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-xs font-bold text-white gradient-btn flex items-center justify-center gap-2 shadow-lg shadow-[#5470F4]/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Checking Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Password Request</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {stage === 'sent_to_admin' && (
            <div className="py-4 space-y-5 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-[#5470F4]/10 border border-[#5470F4]/30 flex items-center justify-center text-[#5CC5FA] mx-auto shadow-lg shadow-[#5470F4]/20">
                <BellRing className="w-8 h-8 animate-bounce" />
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">Super Admin Notified</h4>
                <p className="text-xs text-gray-300 leading-relaxed px-2">
                  {adminNotice}
                </p>
              </div>

              <div className="bg-[#0B0F19] border border-[#1F293D] rounded-2xl p-4 text-left font-mono text-xs space-y-1.5 text-gray-400">
                <div className="flex justify-between">
                  <span>Target Account:</span>
                  <span className="text-white font-bold">{email}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="text-amber-400 font-semibold">Pending Admin Reset</span>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 italic">
                Once the Super Admin resets your credentials, they will deliver your temporary password to you.
              </p>

              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white gradient-btn shadow-lg shadow-[#5470F4]/20 transition-all"
              >
                Back to Sign In
              </button>
            </div>
          )}

          {stage === 'ceo_recovery' && (
            <form onSubmit={handleCeoResetSubmit} className="space-y-4 animate-in zoom-in-95 duration-200">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-amber-300">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">CEO Master Authority Verified</strong>
                  <span>As the Chief Executive Officer, authenticate using your Master Recovery Passphrase to directly reset your password.</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Master Recovery Passphrase *
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={masterKey}
                    onChange={(e) => setMasterKey(e.target.value)}
                    placeholder="Enter CEO master recovery key"
                    required
                    autoFocus
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-amber-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none font-mono"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1 font-mono">
                  Default key: NEXIMET-CEO-2026-RECOVERY
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  New CEO Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={ceoNewPassword}
                    onChange={(e) => setCeoNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-amber-500 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-gray-500 outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? 'Validating & Resetting...' : 'Update CEO Password'}
                </button>
              </div>
            </form>
          )}

          {stage === 'ceo_success' && (
            <div className="py-4 space-y-5 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">CEO Password Updated!</h4>
                <p className="text-xs text-gray-300">
                  Your credentials have been securely updated in the database. You can now log in to the portal with your new password.
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white gradient-btn shadow-lg shadow-[#5470F4]/20 transition-all"
              >
                Proceed to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
