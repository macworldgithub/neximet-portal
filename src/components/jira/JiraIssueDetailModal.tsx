'use client';

import React, { useState, useEffect } from 'react';
import { JiraIssue, getIssueTypeDetails, getPriorityDetails } from './JiraIssueCard';
import { apiPut, apiPost, apiDelete } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  Bookmark,
  CheckSquare,
  Bug,
  Zap,
  Clock,
  Calendar,
  Trash2,
  Send,
  Plus,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  ListTodo,
  Sparkles,
} from 'lucide-react';

interface JiraIssueDetailModalProps {
  issue: JiraIssue | null;
  onClose: () => void;
  onUpdateIssue: (updatedIssue: JiraIssue) => void;
  onDeleteIssue?: (issueId: string) => void;
  teamMembers?: Array<{ _id: string; name: string; email: string; role?: string }>;
}

export default function JiraIssueDetailModal({
  issue,
  onClose,
  onUpdateIssue,
  onDeleteIssue,
  teamMembers = [],
}: JiraIssueDetailModalProps) {
  const { user, hasRole } = useAuth();

  // Local editable fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<JiraIssue['status']>('todo');
  const [priority, setPriority] = useState<JiraIssue['priority']>('Medium');
  const [issueType, setIssueType] = useState<JiraIssue['issueType']>('task');
  const [storyPoints, setStoryPoints] = useState<number>(3);
  const [assignedToId, setAssignedToId] = useState<string>('');
  const [deadline, setDeadline] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabelInput, setNewLabelInput] = useState('');

  // Subtask local state
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);

  // Comment local state
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Quick Log Time state
  const [showLogTime, setShowLogTime] = useState(false);
  const [logHours, setLogHours] = useState(2);
  const [logDesc, setLogDesc] = useState('');
  const [loggingTime, setLoggingTime] = useState(false);

  const [copiedKey, setCopiedKey] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);

  useEffect(() => {
    if (issue) {
      setTitle(issue.title || '');
      setDescription(issue.description || '');
      setStatus(issue.status === 'completed' ? 'done' : issue.status || 'todo');
      setPriority(issue.priority || 'Medium');
      setIssueType(issue.issueType || 'task');
      setStoryPoints(issue.storyPoints ?? 3);
      setAssignedToId(issue.assignedTo?._id || '');
      setDeadline(issue.deadline ? issue.deadline.substring(0, 10) : '');
      setStartDate(issue.startDate ? issue.startDate.substring(0, 10) : '');
      setLabels(issue.labels || []);
    }
  }, [issue]);

  if (!issue) return null;

  const typeDetails = getIssueTypeDetails(issueType);
  const TypeIcon = typeDetails.icon;
  const priorityDetails = getPriorityDetails(priority);
  const PriorityIcon = priorityDetails.icon;

  const totalSubtasks = issue.subtasks?.length || 0;
  const completedSubtasks = issue.subtasks?.filter((s) => s.completed).length || 0;
  const subtaskPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  // Save main fields
  const handleSaveFieldUpdates = async (overrideData?: Partial<any>) => {
    setSavingDetails(true);
    try {
      const payload = {
        title,
        description,
        status,
        priority,
        issueType,
        storyPoints: Number(storyPoints),
        assignedTo: assignedToId || null,
        deadline: deadline ? new Date(deadline) : null,
        startDate: startDate ? new Date(startDate) : null,
        labels,
        ...overrideData,
      };

      const res = await apiPut(`/tasks/${issue._id}`, payload);
      if (res.success && res.task) {
        onUpdateIssue(res.task);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingDetails(false);
    }
  };

  // Subtask methods
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || addingSubtask) return;

    setAddingSubtask(true);
    try {
      const res = await apiPost(`/tasks/${issue._id}/subtasks`, { title: newSubtaskTitle.trim() });
      if (res.success && res.task) {
        onUpdateIssue(res.task);
        setNewSubtaskTitle('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingSubtask(false);
    }
  };

  const handleToggleSubtask = async (subtaskId: string, currentCompleted: boolean) => {
    try {
      const res = await apiPut(`/tasks/${issue._id}/subtasks/${subtaskId}`, {
        completed: !currentCompleted,
      });
      // Note: route in taskRoutes is PATCH /:id/subtasks/:subtaskId
      // Let's call apiFetch with PATCH
      const patchRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/tasks/${issue._id}/subtasks/${subtaskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('neximet_token')}`,
        },
        body: JSON.stringify({ completed: !currentCompleted }),
      });
      const data = await patchRes.json();
      if (data.success && data.task) {
        onUpdateIssue(data.task);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      const res = await apiDelete(`/tasks/${issue._id}/subtasks/${subtaskId}`);
      if (res.success && res.task) {
        onUpdateIssue(res.task);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Comment method
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || postingComment) return;

    setPostingComment(true);
    try {
      const res = await apiPost(`/tasks/${issue._id}/comments`, { text: commentText.trim() });
      if (res.success && res.task) {
        onUpdateIssue(res.task);
        setCommentText('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPostingComment(false);
    }
  };

  // Work log method
  const handleLogWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logHours || loggingTime) return;

    setLoggingTime(true);
    try {
      const res = await apiPost('/tasks/timelogs', {
        project: (issue as any).project?._id || (issue as any).project,
        task: issue._id,
        hours: logHours,
        description: logDesc || `Work on ${issue.issueKey}`,
        billable: true,
      });
      if (res.success) {
        setShowLogTime(false);
        setLogDesc('');
        // Refresh task to get new spentHours
        const taskRes = await apiPut(`/tasks/${issue._id}`, {});
        if (taskRes.success && taskRes.task) {
          onUpdateIssue(taskRes.task);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoggingTime(false);
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(issue.issueKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleAddLabel = () => {
    if (!newLabelInput.trim()) return;
    const clean = newLabelInput.trim().toLowerCase();
    if (!labels.includes(clean)) {
      const next = [...labels, clean];
      setLabels(next);
      handleSaveFieldUpdates({ labels: next });
    }
    setNewLabelInput('');
  };

  const handleRemoveLabel = (lbl: string) => {
    const next = labels.filter((l) => l !== lbl);
    setLabels(next);
    handleSaveFieldUpdates({ labels: next });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-4xl bg-[#0D1322] border-l border-[#1F293D] h-full overflow-y-auto custom-scrollbar flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Top Header Bar */}
        <div className="sticky top-0 z-20 bg-[#0D1322]/95 backdrop-blur-md border-b border-[#1F293D] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Issue Type Selector */}
            <select
              value={issueType}
              onChange={(e) => {
                const nextType = e.target.value as JiraIssue['issueType'];
                setIssueType(nextType);
                handleSaveFieldUpdates({ issueType: nextType });
              }}
              className="text-xs font-bold px-2.5 py-1 rounded-xl bg-[#141C30] border border-[#243454] text-[#5CC5FA] outline-none cursor-pointer"
            >
              <option value="story">Story</option>
              <option value="task">Task</option>
              <option value="bug">Bug</option>
              <option value="epic">Epic</option>
            </select>

            <button
              onClick={handleCopyKey}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141C30] hover:bg-[#1A2540] border border-[#243454] text-xs font-mono font-bold text-gray-300 hover:text-white transition-colors"
              title="Copy issue key"
            >
              <span>{issue.issueKey}</span>
              {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {hasRole('CEO', 'Project Manager') && onDeleteIssue && (
              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to delete ${issue.issueKey}?`)) {
                    onDeleteIssue(issue._id);
                    onClose();
                  }
                }}
                className="p-2 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Delete Issue"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#1F293D] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content Grid */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
          {/* Left Column: Title, Description, Subtasks, Comments (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Title / Summary */}
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => handleSaveFieldUpdates()}
                className="w-full text-lg sm:text-xl font-bold text-white bg-transparent border border-transparent hover:border-[#22304C] focus:border-[#5470F4] rounded-xl px-3 py-1.5 outline-none transition-all"
                placeholder="Issue title / summary"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                Description
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => handleSaveFieldUpdates()}
                placeholder="Add a detailed description, acceptance criteria, or technical specs..."
                className="w-full bg-[#111827] border border-[#1F293D] hover:border-[#26375A] focus:border-[#5470F4] rounded-2xl p-4 text-xs text-gray-200 outline-none transition-all leading-relaxed"
              />
            </div>

            {/* Subtasks Checklist Section */}
            <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-5 space-y-4 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-[#5CC5FA]" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Checklist Subtasks
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#5470F4]/15 text-[#5CC5FA] border border-[#5470F4]/30">
                    {completedSubtasks}/{totalSubtasks}
                  </span>
                </div>

                {totalSubtasks > 0 && (
                  <span className="text-xs font-mono font-bold text-gray-400">
                    {subtaskPercent}%
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              {totalSubtasks > 0 && (
                <div className="w-full bg-[#0B0F19] h-2 rounded-full overflow-hidden border border-[#1F293D]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      subtaskPercent === 100 ? 'bg-emerald-400' : 'bg-[#5470F4]'
                    }`}
                    style={{ width: `${subtaskPercent}%` }}
                  />
                </div>
              )}

              {/* Subtasks List */}
              <div className="space-y-2">
                {issue.subtasks && issue.subtasks.length > 0 ? (
                  issue.subtasks.map((subtask) => (
                    <div
                      key={subtask._id}
                      className="group flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#0D1322] border border-[#1E293D] hover:border-[#5470F4]/40 transition-all"
                    >
                      <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={subtask.completed}
                          onChange={() => handleToggleSubtask(subtask._id, subtask.completed)}
                          className="w-4 h-4 rounded accent-[#5470F4] cursor-pointer"
                        />
                        <span
                          className={`text-xs ${
                            subtask.completed
                              ? 'line-through text-gray-500'
                              : 'text-gray-200'
                          } truncate`}
                        >
                          {subtask.title}
                        </span>
                      </label>

                      <button
                        onClick={() => handleDeleteSubtask(subtask._id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-rose-400 transition-opacity"
                        title="Remove checklist item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 py-1">No checklist subtasks yet.</p>
                )}
              </div>

              {/* Add Subtask Input */}
              <form onSubmit={handleAddSubtask} className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  placeholder="+ Add a checklist item..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  className="flex-1 bg-[#0B0F19] border border-[#1E293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
                <button
                  type="submit"
                  disabled={!newSubtaskTitle.trim() || addingSubtask}
                  className="px-3 py-2 rounded-xl text-xs font-bold gradient-btn text-white disabled:opacity-40"
                >
                  Add
                </button>
              </form>
            </div>

            {/* Discussion Comments Stream */}
            <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-5 space-y-4 shadow-md">
              <div className="flex items-center gap-2 pb-1 border-b border-[#1F293D]">
                <MessageSquare className="w-4 h-4 text-[#5CC5FA]" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Discussion Activity
                </h4>
                <span className="text-[10px] text-gray-400">
                  ({issue.comments?.length || 0})
                </span>
              </div>

              {/* Comment Input */}
              <form onSubmit={handleAddComment} className="space-y-2">
                <textarea
                  rows={2}
                  placeholder="Leave a comment or update for the team..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1E293D] focus:border-[#5470F4] rounded-xl p-3 text-xs text-white outline-none"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!commentText.trim() || postingComment}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold gradient-btn text-white disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <Send className="w-3 h-3" />
                    <span>Post Comment</span>
                  </button>
                </div>
              </form>

              {/* Comments Feed */}
              <div className="space-y-3 pt-2">
                {issue.comments && issue.comments.length > 0 ? (
                  issue.comments.map((cmt) => (
                    <div
                      key={cmt._id}
                      className="p-3.5 rounded-2xl bg-[#0D1322] border border-[#1E293D] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md bg-[#1E293D] border border-[#5470F4]/30 flex items-center justify-center text-[9px] font-bold text-[#5CC5FA]">
                            {cmt.user?.name
                              ? cmt.user.name
                                  .split(' ')
                                  .map((n: string) => n[0])
                                  .join('')
                                  .substring(0, 2)
                              : 'US'}
                          </div>
                          <span className="font-bold text-white">{cmt.user?.name || 'User'}</span>
                          <span className="text-[10px] text-gray-500">
                            {cmt.user?.role || ''}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500">
                          {new Date(cmt.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 pl-7 leading-relaxed">{cmt.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 text-center py-2">No comments posted yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Status, Assignee, Priority, Points, Dates (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            {/* Status Selector */}
            <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-4 space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Workflow Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const nextStatus = e.target.value as JiraIssue['status'];
                  setStatus(nextStatus);
                  handleSaveFieldUpdates({ status: nextStatus });
                }}
                className="w-full bg-[#0B0F19] border border-[#1E293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs font-bold text-white outline-none cursor-pointer"
              >
                <option value="backlog">Backlog</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">In Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            {/* Details Panel */}
            <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-4 space-y-4 text-xs">
              <h5 className="font-bold uppercase tracking-wider text-gray-400 text-[10px] pb-2 border-b border-[#1F293D]">
                Issue Attributes
              </h5>

              {/* Assignee */}
              <div className="space-y-1">
                <label className="text-gray-400 text-[11px] block">Assignee</label>
                <select
                  value={assignedToId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setAssignedToId(nextId);
                    handleSaveFieldUpdates({ assignedTo: nextId || null });
                  }}
                  className="w-full bg-[#0B0F19] border border-[#1E293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                >
                  <option value="">-- Unassigned --</option>
                  {teamMembers.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name} ({m.role || 'Member'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <label className="text-gray-400 text-[11px] block">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => {
                    const nextPri = e.target.value as JiraIssue['priority'];
                    setPriority(nextPri);
                    handleSaveFieldUpdates({ priority: nextPri });
                  }}
                  className="w-full bg-[#0B0F19] border border-[#1E293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs font-semibold text-white outline-none cursor-pointer"
                >
                  <option value="Lowest">Lowest</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              {/* Story Points */}
              <div className="space-y-1">
                <label className="text-gray-400 text-[11px] block">Story Points</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={storyPoints}
                  onChange={(e) => setStoryPoints(Number(e.target.value))}
                  onBlur={() => handleSaveFieldUpdates()}
                  className="w-full bg-[#0B0F19] border border-[#1E293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#5CC5FA] outline-none"
                />
              </div>

              {/* Due Date */}
              <div className="space-y-1">
                <label className="text-gray-400 text-[11px] block">Due Date</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => {
                    setDeadline(e.target.value);
                    handleSaveFieldUpdates({
                      deadline: e.target.value ? new Date(e.target.value) : null,
                    });
                  }}
                  className="w-full bg-[#0B0F19] border border-[#1E293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                />
              </div>

              {/* Labels */}
              <div className="space-y-1.5 pt-1">
                <label className="text-gray-400 text-[11px] block">Labels</label>
                <div className="flex flex-wrap gap-1.5">
                  {labels.map((lbl) => (
                    <span
                      key={lbl}
                      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#18233C] text-gray-300 border border-[#233355]"
                    >
                      <span>{lbl}</span>
                      <button
                        onClick={() => handleRemoveLabel(lbl)}
                        className="hover:text-rose-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    placeholder="New label..."
                    value={newLabelInput}
                    onChange={(e) => setNewLabelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLabel();
                      }
                    }}
                    className="flex-1 bg-[#0B0F19] border border-[#1E293D] focus:border-[#5470F4] rounded-lg px-2 py-1 text-[11px] text-white outline-none"
                  />
                  <button
                    onClick={handleAddLabel}
                    className="px-2 py-1 bg-[#1A2540] hover:bg-[#223356] text-[10px] font-bold text-gray-300 rounded-lg"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Time Tracking Widget */}
            <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#5CC5FA]" />
                  <span>Time Tracking</span>
                </span>
                <button
                  onClick={() => setShowLogTime(!showLogTime)}
                  className="text-[#5CC5FA] hover:underline"
                >
                  {showLogTime ? 'Cancel' : '+ Log Work'}
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-gray-400">Logged: {issue.spentHours || 0}h</span>
                  <span className="text-gray-400">Est: {issue.estimatedHours || 8}h</span>
                </div>
                <div className="w-full bg-[#0B0F19] h-2 rounded-full overflow-hidden border border-[#1F293D]">
                  <div
                    className="h-full bg-emerald-400 rounded-full"
                    style={{
                      width: `${Math.min(
                        ((issue.spentHours || 0) / (issue.estimatedHours || 8)) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {showLogTime && (
                <form onSubmit={handleLogWork} className="space-y-2 pt-2 border-t border-[#1F293D]">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="16"
                    value={logHours}
                    onChange={(e) => setLogHours(Number(e.target.value))}
                    placeholder="Hours spent"
                    className="w-full bg-[#0B0F19] border border-[#1E293D] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                  />
                  <input
                    type="text"
                    value={logDesc}
                    onChange={(e) => setLogDesc(e.target.value)}
                    placeholder="Work description..."
                    className="w-full bg-[#0B0F19] border border-[#1E293D] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loggingTime}
                    className="w-full py-1.5 rounded-lg text-xs font-bold gradient-btn text-white disabled:opacity-50"
                  >
                    {loggingTime ? 'Logging...' : 'Confirm Hours'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
