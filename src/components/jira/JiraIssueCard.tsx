'use client';

import React from 'react';
import {
  Bookmark,
  CheckSquare,
  Bug,
  Zap,
  ChevronsUp,
  ChevronUp,
  Minus,
  ChevronDown,
  ChevronsDown,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export interface JiraIssue {
  _id: string;
  issueKey: string;
  issueType: 'story' | 'task' | 'bug' | 'epic';
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'completed';
  priority: 'Lowest' | 'Low' | 'Medium' | 'High' | 'Urgent';
  storyPoints?: number;
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
    designation?: string;
    role?: string;
  };
  reporter?: {
    _id: string;
    name: string;
  };
  labels?: string[];
  subtasks?: Array<{ _id: string; title: string; completed: boolean }>;
  comments?: Array<{ _id: string; user: any; text: string; createdAt: string }>;
  estimatedHours?: number;
  spentHours?: number;
  startDate?: string;
  deadline?: string;
  createdAt: string;
}

interface JiraIssueCardProps {
  issue: JiraIssue;
  onSelect: (issue: JiraIssue) => void;
  onMoveStatus?: (issueId: string, targetStatus: JiraIssue['status']) => void;
  columnStatuses?: Array<{ id: JiraIssue['status']; title: string }>;
}

export const getIssueTypeDetails = (type: JiraIssue['issueType'] = 'task') => {
  switch (type) {
    case 'story':
      return {
        label: 'Story',
        color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
        icon: Bookmark,
        hex: '#10B981',
      };
    case 'bug':
      return {
        label: 'Bug',
        color: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
        icon: Bug,
        hex: '#F43F5E',
      };
    case 'epic':
      return {
        label: 'Epic',
        color: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
        icon: Zap,
        hex: '#A855F7',
      };
    case 'task':
    default:
      return {
        label: 'Task',
        color: 'text-[#5CC5FA] bg-[#5470F4]/15 border-[#5470F4]/30',
        icon: CheckSquare,
        hex: '#5470F4',
      };
  }
};

export const getPriorityDetails = (priority: JiraIssue['priority'] = 'Medium') => {
  switch (priority) {
    case 'Urgent':
      return { label: 'Urgent', color: 'text-rose-500', icon: ChevronsUp };
    case 'High':
      return { label: 'High', color: 'text-amber-400', icon: ChevronUp };
    case 'Medium':
      return { label: 'Medium', color: 'text-amber-300', icon: Minus };
    case 'Low':
      return { label: 'Low', color: 'text-blue-400', icon: ChevronDown };
    case 'Lowest':
      return { label: 'Lowest', color: 'text-slate-400', icon: ChevronsDown };
    default:
      return { label: 'Medium', color: 'text-amber-300', icon: Minus };
  }
};

export default function JiraIssueCard({
  issue,
  onSelect,
  onMoveStatus,
  columnStatuses = [],
}: JiraIssueCardProps) {
  const typeDetails = getIssueTypeDetails(issue.issueType);
  const TypeIcon = typeDetails.icon;
  const priorityDetails = getPriorityDetails(issue.priority);
  const PriorityIcon = priorityDetails.icon;

  const completedSubtasks = issue.subtasks?.filter((s) => s.completed).length || 0;
  const totalSubtasks = issue.subtasks?.length || 0;

  const currentColIndex = columnStatuses.findIndex((c) => c.id === issue.status);
  const canMoveLeft = currentColIndex > 0;
  const canMoveRight = currentColIndex < columnStatuses.length - 1 && currentColIndex !== -1;

  const isOverdue =
    issue.deadline &&
    new Date(issue.deadline) < new Date() &&
    issue.status !== 'done';

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', issue._id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onSelect(issue)}
      className="group relative bg-[#131B2E] hover:bg-[#18233C] border border-[#22304C] hover:border-[#5470F4]/60 rounded-2xl p-4 shadow-lg hover:shadow-2xl hover:shadow-[#5470F4]/10 transition-all cursor-pointer select-none space-y-3"
    >
      {/* Top Header: Issue Type, Key, Priority */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-lg border flex items-center justify-center ${typeDetails.color}`}
            title={typeDetails.label}
          >
            <TypeIcon className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-mono font-bold text-gray-300 group-hover:text-[#5CC5FA] transition-colors">
            {issue.issueKey || 'NX-000'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#0B0F19] border border-[#22304C] text-[10px] font-bold ${priorityDetails.color}`}
            title={`Priority: ${issue.priority}`}
          >
            <PriorityIcon className="w-3 h-3" />
            <span>{issue.priority}</span>
          </div>
        </div>
      </div>

      {/* Summary Title */}
      <p className="text-xs font-semibold text-white line-clamp-2 leading-relaxed">
        {issue.title}
      </p>

      {/* Labels */}
      {issue.labels && issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {issue.labels.slice(0, 3).map((lbl, idx) => (
            <span
              key={idx}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#1A2640] text-gray-300 border border-[#26375A]"
            >
              {lbl}
            </span>
          ))}
          {issue.labels.length > 3 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#1A2640] text-gray-400">
              +{issue.labels.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Subtasks Progress indicator */}
      {totalSubtasks > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <CheckSquare className="w-3 h-3 text-[#5CC5FA]" />
              <span>Checklist</span>
            </span>
            <span className="font-mono">
              {completedSubtasks}/{totalSubtasks}
            </span>
          </div>
          <div className="w-full bg-[#0B0F19] h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                completedSubtasks === totalSubtasks ? 'bg-emerald-400' : 'bg-[#5470F4]'
              }`}
              style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer: Story Points, Deadline, Quick Move, Assignee Avatar */}
      <div className="flex items-center justify-between pt-2 border-t border-[#1F2B45] text-xs">
        <div className="flex items-center gap-2">
          {issue.storyPoints !== undefined && (
            <span
              className="px-2 py-0.5 rounded-md bg-[#16213A] border border-[#223356] text-[10px] font-mono font-bold text-[#5CC5FA]"
              title={`${issue.storyPoints} Story Points`}
            >
              {issue.storyPoints} pts
            </span>
          )}

          {issue.deadline && (
            <span
              className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                isOverdue
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  : 'text-gray-400'
              }`}
              title={`Due: ${new Date(issue.deadline).toLocaleDateString()}`}
            >
              <Calendar className="w-2.5 h-2.5" />
              <span>
                {new Date(issue.deadline).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </span>
          )}
        </div>

        {/* Quick Shift buttons + Assignee */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {onMoveStatus && (
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-[#0B0F19] rounded-lg p-0.5 border border-[#22304C]">
              {canMoveLeft && (
                <button
                  onClick={() => onMoveStatus(issue._id, columnStatuses[currentColIndex - 1].id)}
                  title={`Move back to ${columnStatuses[currentColIndex - 1].title}`}
                  className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1E293D]"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
              )}
              {canMoveRight && (
                <button
                  onClick={() => onMoveStatus(issue._id, columnStatuses[currentColIndex + 1].id)}
                  title={`Move forward to ${columnStatuses[currentColIndex + 1].title}`}
                  className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1E293D]"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Assignee Avatar */}
          {issue.assignedTo ? (
            <div
              className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#1E293D] to-[#2B3B5C] border border-[#5470F4]/40 flex items-center justify-center text-[10px] font-bold text-[#5CC5FA] shadow-sm"
              title={`Assigned to ${issue.assignedTo.name} (${issue.assignedTo.role || 'Member'})`}
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
              className="w-7 h-7 rounded-xl bg-[#162035] border border-dashed border-gray-600 flex items-center justify-center text-[10px] text-gray-500 font-bold"
              title="Unassigned"
            >
              ?
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
