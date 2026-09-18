'use client';

import React, { useState } from 'react';
import { apiPost } from '../../lib/api';
import {
  X,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';

interface AdminResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string;
    requestId?: string;
  } | null;
  onSuccess: () => void;
}

export default function AdminResetPasswordModal({
  isOpen,
  onClose,
  employee,
  onSuccess,
}: AdminResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [completedPassword, setCompletedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !employee) return null;

  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    let res = 'Nx#';
    for (let i = 0; i < 7; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(res);
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await apiPost('/auth/admin-reset-password', {
        userId: employee.id,
        newPassword,
        requestId: employee.requestId,
      });

      if (res.success) {
        setCompletedPassword(newPassword);
        onSuccess();
      } else {
        setError(res.message || 'Failed to update employee password.');
      }
    } catch (err: any) {
      setError(err?.message || 'Server error while resetting password.');
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = () => {
    if (!completedPassword) return;
    const text = `Neximet Corporate Portal - Password Reset Notification\n\nHello ${employee.name},\nYour account password has been updated by the Super Admin.\n\nCorporate Email: ${employee.email}\nNew Password: ${completedPassword}\nLogin URL: ${window.location.origin}/login\n\nPlease log in to your portal and update your password if desired.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClose = () => {
    setNewPassword('');
    setCompletedPassword(null);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-[#1F293D] rounded-3xl w-full max-w-lg shadow-2xl shadow-black/80 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#1F293D] flex items-center justify-between bg-[#0E1424]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Reset Employee Password</h3>
              <p className="text-xs text-gray-400">Super Admin Administrative Credential Override</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#161F30] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {completedPassword ? (
            /* Success View */
            <div className="py-4 space-y-5 text-center animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h4 className="text-base font-bold text-white">Password Updated Successfully</h4>
                <p className="text-xs text-gray-400 mt-1">
                  Credentials for <strong className="text-white">{employee.name}</strong> have been updated.
                </p>
              </div>

              <div className="bg-[#0B0F19] border border-[#1F293D] rounded-2xl p-4 text-left font-mono text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Target Employee:</span>
                  <span className="text-white">{employee.name} ({employee.email})</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#1F293D]">
                  <span className="text-gray-400">New Password:</span>
                  <span className="text-amber-400 font-bold text-sm bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                    {completedPassword}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={copyCredentials}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#1F293D] hover:bg-[#2A3752] border border-[#5470F4]/40 flex items-center justify-center gap-2 transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#5CC5FA]" />}
                  <span>{copied ? 'Copied Details to Clipboard!' : 'Copy Credentials for Employee'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="py-2.5 px-5 rounded-xl text-xs font-bold text-white gradient-btn shadow-lg shadow-[#5470F4]/20 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* Reset Form */
            <form onSubmit={handleResetSubmit} className="space-y-4">
              {/* Employee Summary Card */}
              <div className="bg-[#0B0F19] border border-[#1F293D] rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-white">{employee.name}</h5>
                  <p className="text-[11px] text-[#5CC5FA] font-mono">{employee.email}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{employee.role} • {employee.department}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#161F30] text-gray-300 border border-[#1F293D]">
                    ID: {employee.id.substring(0, 8)}...
                  </span>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-300">
                    New Temporary Password *
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[11px] text-[#5CC5FA] hover:text-[#7BCFFF] flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Auto-Generate</span>
                  </button>
                </div>

                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    required
                    minLength={6}
                    autoFocus
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-gray-500 outline-none font-mono transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-2 text-[11px] text-amber-300/90 leading-relaxed">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Overriding this password immediately clears any active sessions and allows the employee to log in with the new credentials.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#161F30] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Confirm & Reset Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
