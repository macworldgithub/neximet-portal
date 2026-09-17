'use client';

import React, { useState } from 'react';
import { JiraIssue } from './JiraIssueCard';
import { apiPost } from '../../lib/api';
import { X, Plus, Sparkles } from 'lucide-react';

interface CreateIssueModalProps {
  projectId: string;
  projectCode: string;
  defaultStatus?: JiraIssue['status'];
  onClose: () => void;
  onCreated: (newIssue: JiraIssue) => void;
  teamMembers?: Array<{ _id: string; name: string; email: string; role?: string }>;
}

export default function CreateIssueModal({
  projectId,
  projectCode,
  defaultStatus = 'todo',
  onClose,
  onCreated,
  teamMembers = [],
}: CreateIssueModalProps) {
  const [issueType, setIssueType] = useState<JiraIssue['issueType']>('task');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<JiraIssue['status']>(defaultStatus);
  const [priority, setPriority] = useState<JiraIssue['priority']>('Medium');
  const [storyPoints, setStoryPoints] = useState(3);
  const [assignedTo, setAssignedTo] = useState('');
  const [labelsStr, setLabelsStr] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide an issue summary/title.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const labels = labelsStr
        .split(',')
        .map((l) => l.trim().toLowerCase())
        .filter((l) => l.length > 0);

      const payload: any = {
        project: projectId,
        issueType,
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        storyPoints: Number(storyPoints),
        labels,
      };

      if (assignedTo) {
        payload.assignedTo = assignedTo;
      }
      if (deadline) {
        payload.deadline = new Date(deadline);
      }

      const res = await apiPost('/tasks', payload);
      if (res.success && res.task) {
        onCreated(res.task);
        onClose();
      } else {
        setError(res.message || 'Failed to create issue.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred creating issue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0D1322] border border-[#1F293D] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1F293D] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#5470F4]/15 border border-[#5470F4]/30 text-[#5CC5FA]">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create Issue</h3>
              <p className="text-xs text-gray-400">
                Project Code: <strong className="text-[#5CC5FA]">{projectCode}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#1F293D] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Issue Type & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Issue Type</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as JiraIssue['issueType'])}
                className="w-full bg-[#111827] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
              >
                <option value="story">Story 📗</option>
                <option value="task">Task 📘</option>
                <option value="bug">Bug 🔴</option>
                <option value="epic">Epic 🟪</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Initial Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as JiraIssue['status'])}
                className="w-full bg-[#111827] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
              >
                <option value="backlog">Backlog</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">In Review</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          {/* Title / Summary */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Summary <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Implement real-time Redis cart persistence"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#111827] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Description</label>
            <textarea
              rows={3}
              placeholder="Detailed acceptance criteria, context, or notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#111827] border border-[#1F293D] focus:border-[#5470F4] rounded-xl p-3 text-xs text-white outline-none leading-relaxed"
            />
          </div>

          {/* Priority & Story Points & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as JiraIssue['priority'])}
                className="w-full bg-[#111827] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
              >
                <option value="Lowest">Lowest</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Story Points</label>
              <input
                type="number"
                min={0}
                max={100}
                value={storyPoints}
                onChange={(e) => setStoryPoints(Number(e.target.value))}
                className="w-full bg-[#111827] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#5CC5FA] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Target Due Date</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-[#111827] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Assignee & Labels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Assignee</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full bg-[#111827] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
              >
                <option value="">-- Unassigned --</option>
                {teamMembers.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} ({m.role || 'Member'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Labels (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. backend, redis, api"
                value={labelsStr}
                onChange={(e) => setLabelsStr(e.target.value)}
                className="w-full bg-[#111827] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end items-center gap-3 pt-4 border-t border-[#1F293D]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold gradient-btn text-white disabled:opacity-50 flex items-center gap-2 shadow-md shadow-[#5470F4]/20"
            >
              <Plus className="w-4 h-4" />
              <span>{loading ? 'Creating...' : 'Create Issue'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
