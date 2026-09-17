'use client';

import React, { useState } from 'react';
import { JiraIssue, getIssueTypeDetails, getPriorityDetails } from './JiraIssueCard';
import {
  Plus,
  Bookmark,
  CheckSquare,
  Bug,
  Zap,
  ChevronDown,
  Layers,
  Sparkles,
  Calendar,
} from 'lucide-react';

interface JiraBacklogProps {
  issues: JiraIssue[];
  onSelectIssue: (issue: JiraIssue) => void;
  onMoveStatus: (issueId: string, targetStatus: JiraIssue['status']) => void;
  onQuickCreate: (title: string, issueType: JiraIssue['issueType']) => Promise<void>;
}

export default function JiraBacklog({
  issues,
  onSelectIssue,
  onMoveStatus,
  onQuickCreate,
}: JiraBacklogProps) {
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineType, setInlineType] = useState<JiraIssue['issueType']>('task');
  const [creating, setCreating] = useState(false);

  const activeSprintIssues = issues.filter(
    (i) => i.status === 'in_progress' || i.status === 'review' || i.status === 'todo'
  );
  const backlogIssues = issues.filter((i) => i.status === 'backlog');
  const completedIssues = issues.filter(
    (i) => i.status === 'done' || (i.status as string) === 'completed'
  );

  const handleInlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineTitle.trim() || creating) return;

    setCreating(true);
    try {
      await onQuickCreate(inlineTitle.trim(), inlineType);
      setInlineTitle('');
    } finally {
      setCreating(false);
    }
  };

  const renderIssueRow = (issue: JiraIssue) => {
    const typeDetails = getIssueTypeDetails(issue.issueType);
    const TypeIcon = typeDetails.icon;
    const priorityDetails = getPriorityDetails(issue.priority);
    const PriorityIcon = priorityDetails.icon;

    return (
      <div
        key={issue._id}
        onClick={() => onSelectIssue(issue)}
        className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#111827] hover:bg-[#162238] border border-[#1E293D] hover:border-[#5470F4]/50 rounded-2xl transition-all cursor-pointer shadow-sm"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Issue Type Icon */}
          <div
            className={`p-1.5 rounded-lg border shrink-0 ${typeDetails.color}`}
            title={typeDetails.label}
          >
            <TypeIcon className="w-3.5 h-3.5" />
          </div>

          {/* Issue Key */}
          <span className="text-xs font-mono font-bold text-gray-400 group-hover:text-[#5CC5FA] shrink-0">
            {issue.issueKey || 'NX-000'}
          </span>

          {/* Summary */}
          <span className="text-xs font-medium text-white truncate max-w-lg">
            {issue.title}
          </span>

          {/* Labels */}
          {issue.labels && issue.labels.length > 0 && (
            <div className="hidden md:flex items-center gap-1 shrink-0">
              {issue.labels.slice(0, 2).map((l, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-[#18233C] text-gray-300 border border-[#233355]"
                >
                  {l}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right Info: Status, Priority, Points, Assignee */}
        <div
          className="flex items-center gap-3 shrink-0 self-end sm:self-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Status selector */}
          <select
            value={issue.status === 'completed' ? 'done' : issue.status}
            onChange={(e) => onMoveStatus(issue._id, e.target.value as JiraIssue['status'])}
            className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-[#0B0F19] border border-[#1E293D] text-gray-300 focus:border-[#5470F4] outline-none cursor-pointer"
          >
            <option value="backlog">BACKLOG</option>
            <option value="todo">TO DO</option>
            <option value="in_progress">IN PROGRESS</option>
            <option value="review">IN REVIEW</option>
            <option value="done">DONE</option>
          </select>

          {/* Priority */}
          <div
            className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#0B0F19] border border-[#1E293D] ${priorityDetails.color}`}
            title={`Priority: ${issue.priority}`}
          >
            <PriorityIcon className="w-3 h-3" />
            <span className="hidden lg:inline">{issue.priority}</span>
          </div>

          {/* Story Points */}
          <span
            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#16213A] border border-[#223356] text-[#5CC5FA]"
            title="Story Points"
          >
            {issue.storyPoints || 0} pts
          </span>

          {/* Assignee Avatar */}
          {issue.assignedTo ? (
            <div
              className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#1E293D] to-[#2B3B5C] border border-[#5470F4]/40 flex items-center justify-center text-[9px] font-bold text-[#5CC5FA] shadow-sm"
              title={`Assigned: ${issue.assignedTo.name}`}
            >
              {issue.assignedTo.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase()}
            </div>
          ) : (
            <div
              className="w-6 h-6 rounded-lg bg-[#162035] border border-dashed border-gray-600 flex items-center justify-center text-[9px] text-gray-500 font-bold"
              title="Unassigned"
            >
              ?
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Inline Quick Creator */}
      <form
        onSubmit={handleInlineSubmit}
        className="flex items-center gap-2 p-3 bg-[#0D1322] border border-[#1E293D] focus-within:border-[#5470F4] rounded-2xl shadow-xl transition-all"
      >
        <select
          value={inlineType}
          onChange={(e) => setInlineType(e.target.value as JiraIssue['issueType'])}
          className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-[#141C30] border border-[#243454] text-[#5CC5FA] outline-none cursor-pointer"
        >
          <option value="story">Story</option>
          <option value="task">Task</option>
          <option value="bug">Bug</option>
          <option value="epic">Epic</option>
        </select>

        <input
          type="text"
          placeholder="+ What needs to be done? (Press Enter to create issue in Backlog)"
          value={inlineTitle}
          onChange={(e) => setInlineTitle(e.target.value)}
          className="flex-1 bg-transparent text-xs text-white placeholder:text-gray-500 outline-none px-2"
        />

        <button
          type="submit"
          disabled={!inlineTitle.trim() || creating}
          className="px-4 py-1.5 rounded-xl text-xs font-bold gradient-btn text-white disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-[#5470F4]/20"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{creating ? 'Adding...' : 'Add to Backlog'}</span>
        </button>
      </form>

      {/* Section 1: Active Sprint / In-Flight Issues */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#1E293D]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#5470F4]" />
            <h3 className="text-sm font-bold text-white">Active Sprint / In-Flight Work</h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#5470F4]/15 text-[#5CC5FA] border border-[#5470F4]/30">
              {activeSprintIssues.length} issues
            </span>
          </div>

          <span className="text-xs font-mono text-gray-400">
            Total Points:{' '}
            <strong className="text-white">
              {activeSprintIssues.reduce((a, c) => a + (Number(c.storyPoints) || 0), 0)} pts
            </strong>
          </span>
        </div>

        <div className="space-y-2">
          {activeSprintIssues.length > 0 ? (
            activeSprintIssues.map(renderIssueRow)
          ) : (
            <p className="text-xs text-gray-500 py-6 text-center bg-[#0D1322] border border-[#1E293D] rounded-2xl">
              No active sprint items. Move issues from Backlog below.
            </p>
          )}
        </div>
      </div>

      {/* Section 2: Backlog Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#1E293D]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <h3 className="text-sm font-bold text-white">Product Backlog</h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-300 border border-slate-500/30">
              {backlogIssues.length} issues
            </span>
          </div>

          <span className="text-xs font-mono text-gray-400">
            Backlog Points:{' '}
            <strong className="text-white">
              {backlogIssues.reduce((a, c) => a + (Number(c.storyPoints) || 0), 0)} pts
            </strong>
          </span>
        </div>

        <div className="space-y-2">
          {backlogIssues.length > 0 ? (
            backlogIssues.map(renderIssueRow)
          ) : (
            <p className="text-xs text-gray-500 py-6 text-center bg-[#0D1322] border border-[#1E293D] rounded-2xl">
              Backlog is clear. Use the bar above to plan new user stories or tasks.
            </p>
          )}
        </div>
      </div>

      {/* Section 3: Completed Archive */}
      {completedIssues.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-[#1E293D]">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h3 className="text-sm font-bold text-white">Completed Issues</h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {completedIssues.length} closed
              </span>
            </div>
          </div>

          <div className="space-y-2 opacity-80">{completedIssues.map(renderIssueRow)}</div>
        </div>
      )}
    </div>
  );
}
