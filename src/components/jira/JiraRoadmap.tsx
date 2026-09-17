'use client';

import React from 'react';
import { JiraIssue, getIssueTypeDetails } from './JiraIssueCard';
import { Calendar, ChevronRight, Zap, CheckCircle2, Clock } from 'lucide-react';

interface JiraRoadmapProps {
  issues: JiraIssue[];
  onSelectIssue: (issue: JiraIssue) => void;
}

export default function JiraRoadmap({ issues, onSelectIssue }: JiraRoadmapProps) {
  // Sort issues by start date or deadline
  const sortedIssues = [...issues].sort((a, b) => {
    const dateA = new Date(a.startDate || a.createdAt).getTime();
    const dateB = new Date(b.startDate || b.createdAt).getTime();
    return dateA - dateB;
  });

  const getStatusColor = (status: JiraIssue['status']) => {
    switch (status) {
      case 'done':
        return 'bg-emerald-500/80 border-emerald-400 text-emerald-100';
      case 'review':
        return 'bg-purple-500/80 border-purple-400 text-purple-100';
      case 'in_progress':
        return 'bg-amber-500/80 border-amber-400 text-amber-100';
      case 'todo':
        return 'bg-blue-500/80 border-blue-400 text-blue-100';
      case 'backlog':
      default:
        return 'bg-slate-600/80 border-slate-500 text-slate-100';
    }
  };

  const getProgress = (issue: JiraIssue) => {
    if (issue.status === 'done' || (issue.status as string) === 'completed') return 100;
    if (!issue.subtasks || issue.subtasks.length === 0) {
      if (issue.status === 'review') return 80;
      if (issue.status === 'in_progress') return 50;
      if (issue.status === 'todo') return 10;
      return 0;
    }
    const completed = issue.subtasks.filter((s) => s.completed).length;
    return Math.round((completed / issue.subtasks.length) * 100);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Roadmap Explainer Banner */}
      <div className="bg-[#111827] border border-[#1F293D] p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <span>Project Roadmap & Sprint Timeline</span>
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Macro deliverable tracking, milestone dependencies, and real-time execution progress.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Done
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> In Progress
          </span>
          <span className="flex items-center gap-1 text-blue-400">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> To Do
          </span>
        </div>
      </div>

      {/* Timeline Gantt-style table */}
      <div className="bg-[#0D1322] border border-[#1F293D] rounded-3xl p-6 shadow-2xl overflow-hidden space-y-4">
        <div className="grid grid-cols-12 gap-4 pb-3 border-b border-[#1F293D] text-[11px] font-bold uppercase tracking-wider text-gray-400">
          <div className="col-span-5 sm:col-span-4">Work Item</div>
          <div className="col-span-2 hidden sm:block">Assignee</div>
          <div className="col-span-2 hidden md:block">Schedule</div>
          <div className="col-span-7 sm:col-span-6 md:col-span-4 text-right sm:text-left">
            Timeline Progress
          </div>
        </div>

        <div className="space-y-3">
          {sortedIssues.map((issue) => {
            const typeDetails = getIssueTypeDetails(issue.issueType);
            const TypeIcon = typeDetails.icon;
            const progress = getProgress(issue);
            const statusColor = getStatusColor(issue.status);

            const startStr = issue.startDate
              ? new Date(issue.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : 'Immediate';
            const endStr = issue.deadline
              ? new Date(issue.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : 'Flexible';

            return (
              <div
                key={issue._id}
                onClick={() => onSelectIssue(issue)}
                className="grid grid-cols-12 gap-4 items-center p-3 rounded-2xl bg-[#111827] hover:bg-[#162138] border border-[#1E293D] hover:border-[#5470F4]/60 transition-all cursor-pointer group"
              >
                {/* Item Details */}
                <div className="col-span-5 sm:col-span-4 flex items-center gap-2.5 min-w-0">
                  <div
                    className={`p-1.5 rounded-lg border shrink-0 ${typeDetails.color}`}
                    title={typeDetails.label}
                  >
                    <TypeIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono font-bold text-gray-400 group-hover:text-[#5CC5FA] block">
                      {issue.issueKey}
                    </span>
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-[#5CC5FA] transition-colors">
                      {issue.title}
                    </h4>
                  </div>
                </div>

                {/* Assignee */}
                <div className="col-span-2 hidden sm:flex items-center gap-2">
                  {issue.assignedTo ? (
                    <>
                      <div className="w-5 h-5 rounded-md bg-[#1E293D] border border-[#5470F4]/30 flex items-center justify-center text-[9px] font-bold text-[#5CC5FA]">
                        {issue.assignedTo.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .substring(0, 2)}
                      </div>
                      <span className="text-xs text-gray-300 truncate">{issue.assignedTo.name}</span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-500 italic">Unassigned</span>
                  )}
                </div>

                {/* Dates */}
                <div className="col-span-2 hidden md:block text-xs text-gray-400">
                  <span className="font-mono text-[11px]">
                    {startStr} → {endStr}
                  </span>
                </div>

                {/* Timeline Bar representation */}
                <div className="col-span-7 sm:col-span-6 md:col-span-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono text-gray-400 uppercase font-semibold">
                        {issue.status.replace('_', ' ')}
                      </span>
                      <span className="font-bold text-white">{progress}%</span>
                    </div>

                    <div className="w-full bg-[#0B0F19] h-3 rounded-full overflow-hidden p-0.5 border border-[#1E293D]">
                      <div
                        className={`h-full rounded-full border shadow-sm transition-all duration-500 ${statusColor}`}
                        style={{ width: `${Math.max(progress, 8)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
