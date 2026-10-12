'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiPut } from '../../lib/api';
import {
  X,
  User,
  Phone,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Building2,
  Briefcase,
  Mail,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileSettingsModal({ isOpen, onClose }: ProfileSettingsModalProps) {
  const { user, refreshUser } = useAuth();

  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user && isOpen) {
      setPhone(user.phone || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMsg(null);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    // Validation for password changes
    if (newPassword || confirmPassword) {
      if (newPassword.length < 6) {
        setMsg({ type: 'error', text: 'New password must be at least 6 characters long.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        setMsg({ type: 'error', text: 'New password and confirmation do not match.' });
        return;
      }
    }

    setLoading(true);
    try {
      const payload: any = {
        phone: phone.trim(),
      };

      if (newPassword) {
        payload.newPassword = newPassword;
        if (currentPassword) {
          payload.currentPassword = currentPassword;
        }
      }

      const res = await apiPut('/auth/profile', payload);

      if (res.success) {
        setMsg({ type: 'success', text: 'Your profile and credentials have been updated successfully!' });
        await refreshUser();
        // Clear password inputs
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMsg({ type: 'error', text: res.message || 'Failed to update profile settings.' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Error occurred while saving profile settings.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-modal fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div role="dialog" aria-modal="true" aria-label="Profile and security settings" className="bg-[#111827] border border-[#1F293D] rounded-3xl p-5 sm:p-7 max-w-lg w-full my-auto shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1F293D] pb-3.5">
          <div className="min-w-0 flex-1 flex items-start gap-2.5">
            <div className="hidden sm:block shrink-0 p-2 rounded-xl bg-[#5470F4]/10 border border-[#5470F4]/30 text-[#5CC5FA]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Profile & Security Settings</h3>
              <p className="text-[11px] text-gray-400">Update your mobile contact number and access password</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close profile settings"
            className="shrink-0 p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#161F30] transition-all"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Read-Only Identity Card */}
        <div className="p-3.5 rounded-2xl bg-[#0B0F19] border border-[#1F293D] space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#161F30] to-[#1E293D] border border-[#5470F4]/40 flex items-center justify-center font-bold text-xs text-[#5CC5FA] shrink-0">
                {user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 break-words">
                <p className="font-bold text-white leading-tight">{user.name}</p>
                <p className="text-[11px] text-gray-400 font-mono">{user.email}</p>
              </div>
            </div>
            <span
              className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1 border ${
                user.role === 'CEO'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : user.role === 'Super Admin'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}
            >
              <ShieldCheck className="w-2.5 h-2.5" />
              <span>{user.role}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#1F293D]/60 text-[11px] text-gray-400">
            <div className="flex items-center gap-1.5 truncate">
              <Building2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <span className="truncate">{user.department}</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <Briefcase className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <span className="truncate">{user.designation}</span>
            </div>
          </div>
        </div>

        {/* Message Banner */}
        {msg && (
          <div
            className={`p-3 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 ${
              msg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section 1: Phone */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#5CC5FA]" />
              <span>Phone / Mobile Number</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 (300) 123-4567"
                required
                className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 outline-none font-mono"
              />
            </div>
            <p className="text-[10px] text-gray-500">
              Corporate directory and emergency contact phone number.
            </p>
          </div>

          {/* Section 2: Password Update */}
          <div className="pt-3 border-t border-[#1F293D] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#5470F4]" />
                <span>Change Password</span>
              </label>
              <span className="text-[10px] text-gray-500">Leave blank if not changing</span>
            </div>

            {/* Current Password */}
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-600 outline-none pr-9 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* New Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-600 outline-none pr-9 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-600 outline-none pr-9 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1F293D]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#161F30] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold gradient-btn text-white shadow-lg shadow-[#5470F4]/30 hover:scale-[1.02] transition-all disabled:opacity-50"
            >
              {loading ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
