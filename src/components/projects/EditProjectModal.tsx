'use client';

import React, { useState, useEffect } from 'react';
import { apiPut } from '../../lib/api';
import {
  X,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Coins,
  Clock,
  Activity,
  Layers,
  FileText,
} from 'lucide-react';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  onUpdated: (updatedProject: any) => void;
}

export default function EditProjectModal({
  isOpen,
  onClose,
  project,
  onUpdated,
}: EditProjectModalProps) {
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [clientName, setClientName] = useState('');
  const [department, setDepartment] = useState('Software Development');
  const [status, setStatus] = useState('planning');
  const [priority, setPriority] = useState('Medium');
  const [budget, setBudget] = useState<number | string>(0);
  const [completionPercentage, setCompletionPercentage] = useState<number>(0);
  const [estimatedHours, setEstimatedHours] = useState<number | string>(160);
  const [deadline, setDeadline] = useState('');
  const [startDate, setStartDate] = useState('');
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (project) {
      setTitle(project.title || '');
      setCode(project.code || '');
      setClientName(project.clientName || '');
      setDepartment(project.department || 'Software Development');
      setStatus(project.status || 'planning');
      setPriority(project.priority || 'Medium');
      setBudget(project.budget ?? 0);
      setCompletionPercentage(project.completionPercentage ?? 0);
      setEstimatedHours(project.estimatedHours ?? 160);
      setDeadline(
        project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : ''
      );
      setStartDate(
        project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : ''
      );
      setDescription(project.description || '');
      setError('');
      setSuccess(false);
    }
  }, [project, isOpen]);

  if (!isOpen || !project) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const payload: any = {
        title: title.trim(),
        code: code.trim().toUpperCase(),
        clientName: clientName.trim(),
        department,
        status,
        priority,
        budget: Number(budget),
        completionPercentage: Number(completionPercentage),
        estimatedHours: Number(estimatedHours),
        description: description.trim(),
      };

      if (deadline) {
        payload.deadline = new Date(deadline).toISOString();
      }
      if (startDate) {
        payload.startDate = new Date(startDate).toISOString();
      }

      const res = await apiPut(`/projects/${project._id}`, payload);

      if (res.success && res.project) {
        setSuccess(true);
        onUpdated(res.project);
        setTimeout(() => {
          onClose();
          setSuccess(false);
        }, 600);
      } else {
        setError(res.message || 'Failed to update project details');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while saving changes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-y-auto">
      <div className="bg-[#111827] border border-[#1F293D] rounded-2xl sm:rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-150 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 sm:px-7 sm:py-5 border-b border-[#1F293D] bg-[#161F30]/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#5470F4]/15 border border-[#5470F4]/30 flex items-center justify-center text-[#5CC5FA]">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Edit Project Details
              </h2>
              <p className="text-[11px] sm:text-xs text-gray-400">
                Modify project name, client, budget, department & deliverables
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#1E293D] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 sm:p-7 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
            {error && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-rose-400 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2.5 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Project updated successfully!</span>
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Project Title / Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Neximet ERP Platform"
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Project Code <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. NX-ERP-01"
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono uppercase placeholder-gray-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Client / Organization Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Acquia Global"
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all"
                >
                  <option value="Software Development">Software Development</option>
                  <option value="Digital Marketing (SEO)">Digital Marketing (SEO)</option>
                  <option value="Graphics Designing">Graphics Designing</option>
                  <option value="WordPress Team">WordPress Team</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all"
                >
                  <option value="planning">Planning</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">In Review</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Completion Progress ({completionPercentage}%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={completionPercentage}
                    onChange={(e) => setCompletionPercentage(Number(e.target.value))}
                    className="flex-1 accent-[#5470F4] cursor-pointer"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={completionPercentage}
                    onChange={(e) => setCompletionPercentage(Math.min(100, Math.max(0, Number(e.target.value))))}
                    className="w-16 bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-2 py-1 text-center text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Target Deadline <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Project Budget (PKR)
                </label>
                <input
                  type="number"
                  min={0}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Estimated Hours
                </label>
                <input
                  type="number"
                  min={0}
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Description & Scope Summary
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Outline the core deliverables, milestones, and client objectives..."
                className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl p-3 text-xs text-white placeholder-gray-500 outline-none transition-all resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 px-5 py-4 sm:px-7 sm:py-5 border-t border-[#1F293D] bg-[#161F30]/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#1E293D] transition-all text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold gradient-btn text-white shadow-lg shadow-[#5470F4]/25 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
