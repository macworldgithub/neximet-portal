'use client';

import React, { useState } from 'react';
import JiraIssueCard, { JiraIssue } from './JiraIssueCard';
import { Plus, CheckCircle2, Circle, Clock, Search, Layers, Sparkles } from 'lucide-react';

interface JiraBoardProps {
  issues: JiraIssue[];
  onSelectIssue: (issue: JiraIssue) => void;
  onMoveStatus: (issueId: string, targetStatus: JiraIssue['status']) => void;
  onOpenCreateModal: (defaultStatus?: JiraIssue['status']) => void;
}

interface ColumnDef {
  id: JiraIssue['status'];
  title: string;
  dotColor: string;
  badgeBg: string;
  headerBorder: string;
  bgGlow: string;
}

const COLUMNS: ColumnDef[] = [
  {
    id: 'backlog',
    title: 'Backlog',
    dotColor: 'bg-slate-400',
    badgeBg: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    headerBorder: 'border-slate-500/40',
    bgGlow: 'hover:border-slate-500/40',
  },
  {
    id: 'todo',
    title: 'To Do',
    dotColor: 'bg-blue-400',
    badgeBg: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    headerBorder: 'border-blue-500/40',
    bgGlow: 'hover:border-blue-500/40',
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    dotColor: 'bg-amber-400',
    badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    headerBorder: 'border-amber-500/40',
    bgGlow: 'hover:border-amber-500/40',
  },
  {
    id: 'review',
    title: 'In Review',
    dotColor: 'bg-purple-400',
    badgeBg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    headerBorder: 'border-purple-500/40',
    bgGlow: 'hover:border-purple-500/40',
  },
  {
    id: 'done',
    title: 'Done',
    dotColor: 'bg-emerald-400',
    badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    headerBorder: 'border-emerald-500/40',
    bgGlow: 'hover:border-emerald-500/40',
  },
];

export default function JiraBoard({
  issues,
  onSelectIssue,
  onMoveStatus,
  onOpenCreateModal,
}: JiraBoardProps) {
  const [activeDragColumn, setActiveDragColumn] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (activeDragColumn !== colId) {
      setActiveDragColumn(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setActiveDragColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: JiraIssue['status']) => {
    e.preventDefault();
    setActiveDragColumn(null);
    const issueId = e.dataTransfer.getData('text/plain');
    if (issueId) {
      onMoveStatus(issueId, targetStatus);
    }
  };

  return (
    <div className="overflow-x-auto pb-6">
      <div className="flex gap-4 min-w-[1280px]">
        {COLUMNS.map((col) => {
          const columnIssues = issues.filter((i) => {
            if (col.id === 'done') {
              return i.status === 'done' || (i.status as string) === 'completed';
            }
            return i.status === col.id;
          });

          const totalPoints = columnIssues.reduce(
            (acc, curr) => acc + (Number(curr.storyPoints) || 0),
            0
          );

          const isDropTarget = activeDragColumn === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`flex-1 min-w-[250px] max-w-[320px] rounded-3xl bg-[#0D1322] border transition-all duration-200 flex flex-col ${
                isDropTarget
                  ? 'border-[#5470F4] ring-2 ring-[#5470F4]/30 bg-[#121A30]'
                  : 'border-[#1B263E]'
              }`}
            >
              {/* Column Header */}
              <div
                className={`p-4 border-b border-[#1B263E] flex items-center justify-between sticky top-0 bg-[#0D1322]/90 backdrop-blur-md rounded-t-3xl z-10`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    {col.title}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${col.badgeBg}`}
                  >
                    {columnIssues.length}
                  </span>
                </div>

                {totalPoints > 0 && (
                  <span
                    className="text-[10px] font-mono text-gray-400 bg-[#141C30] px-2 py-0.5 rounded-md border border-[#22304C]"
                    title="Total Story Points in this column"
                  >
                    {totalPoints} pts
                  </span>
                )}
              </div>

              {/* Column Card Body */}
              <div className="p-3 space-y-3 flex-1 min-h-[380px] max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
                {columnIssues.length > 0 ? (
                  columnIssues.map((issue) => (
                    <JiraIssueCard
                      key={issue._id}
                      issue={issue}
                      onSelect={onSelectIssue}
                      onMoveStatus={onMoveStatus}
                      columnStatuses={COLUMNS.map((c) => ({ id: c.id, title: c.title }))}
                    />
                  ))
                ) : (
                  <div className="h-44 border-2 border-dashed border-[#1B263E] rounded-2xl flex flex-col items-center justify-center p-4 text-center">
                    <p className="text-xs text-gray-500 font-medium">No issues here</p>
                    <p className="text-[10px] text-gray-600 mt-1">Drag issues or create below</p>
                  </div>
                )}
              </div>

              {/* Column Footer: Quick Add Issue */}
              <div className="p-3 border-t border-[#1B263E] bg-[#0B0F1A] rounded-b-3xl">
                <button
                  onClick={() => onOpenCreateModal(col.id)}
                  className="w-full py-2 px-3 rounded-xl border border-dashed border-[#26375A] hover:border-[#5470F4] text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#141D32] flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-[#5CC5FA]" />
                  <span>Create Issue</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
