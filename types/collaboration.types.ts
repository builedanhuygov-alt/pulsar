export type WorkspaceRole = 'owner' | 'creator' | 'reviewer' | 'member' | 'admin' | 'observer';

export type WorkspaceStage =
  | 'briefing'
  | 'in_progress'
  | 'review'
  | 'revision'
  | 'completed'
  | 'closed';

export type WorkspaceStatus = 'active' | 'completed' | 'archived' | 'paused';

// Spec §4 — canonical task statuses (DB CHECK + RLS aligned)
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

// Legacy aliases kept for backward compatibility with Sprint 7 v1 seed/tests.
// Service normalizes: 'done' -> 'completed', 'review' -> 'in_progress'.
export type LegacyTaskStatus = 'review' | 'done';
export type AnyTaskStatus = TaskStatus | LegacyTaskStatus;

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// Spec §5 — milestone lifecycle (DB: pending/in_progress/submitted/completed/cancelled)
export type MilestoneStatus =
  | 'pending'
  | 'in_progress'
  | 'submitted'
  | 'completed'
  | 'cancelled';

// Legacy milestone aliases from Sprint 7 v1: 'approved' -> 'completed', 'rejected' -> 'cancelled'
export type LegacyMilestoneStatus = 'approved' | 'rejected';
export type AnyMilestoneStatus = MilestoneStatus | LegacyMilestoneStatus;

// Spec §5 — deliverable review lifecycle (separate from milestone + challenge outcome)
export type DeliverableStatus =
  | 'submitted'
  | 'under_review'
  | 'changes_requested'
  | 'accepted'
  | 'rejected';

export type MessageType = 'text' | 'system' | 'file' | 'milestone_update';

// Spec §6 — notification taxonomy (no secrets in body)
export type NotificationType =
  | 'new_message'
  | 'workspace_invitation'
  | 'task_assigned'
  | 'task_deadline_changed'
  | 'deliverable_reviewed'
  | 'milestone_due_soon'
  | 'revision_requested';

export type NotificationEntityType = 'workspace' | 'message' | 'task' | 'milestone' | 'deliverable';

export interface WorkspaceAttachment {
  id: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
}

export interface WorkspaceMilestoneDeliverable {
  id: string;
  title: string;
  url: string;
  notes?: string;
  submitted_at: string;
  submitted_by: string;
  submitter_name?: string;
  // Sprint 7 hardened fields (DB-backed)
  status?: DeliverableStatus;
  version?: number;
  feedback?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

export interface WorkspaceMilestone {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  due_date: string | null;
  status: MilestoneStatus;
  deliverables: WorkspaceMilestoneDeliverable[];
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceTask {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  assignee_name?: string;
  due_date: string | null;
  milestone_id?: string | null;
  created_by: string;
  creator_name?: string;
  created_at: string;
  updated_at: string;
  /** Computed client-side from real time (due_date < now && not completed/cancelled) */
  is_overdue?: boolean;
}

export interface TaskStatusHistoryItem {
  id: string;
  workspace_id: string;
  task_id: string;
  previous_status: TaskStatus | null;
  new_status: TaskStatus;
  changed_by: string;
  changer_name?: string;
  reason?: string | null;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  status: 'active' | 'invited' | 'removed';
  joined_at: string;
  last_read_at?: string;
}

export interface WorkspaceMessage {
  id: string;
  workspace_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: WorkspaceRole;
  content: string;
  message_type: MessageType;
  attachments: WorkspaceAttachment[];
  read_by: string[]; // List of user IDs
  is_pinned: boolean;
  created_at: string;
  updated_at?: string;
  idempotency_key?: string | null;
}

export interface WorkspaceActivity {
  id: string;
  workspace_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  target_type: 'workspace' | 'message' | 'task' | 'milestone' | 'member' | 'deliverable' | 'notification';
  target_id: string;
  details: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface CollaborationNotification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  entity_type: NotificationEntityType;
  entity_id: string;
  // Generic, non-secret summary only — never full private message content.
  title: string;
  body: string;
  read_at: string | null;
  idempotency_key?: string | null;
  created_at: string;
}

export interface TaskFilterOptions {
  assignee_id?: string | 'all' | 'unassigned';
  status?: TaskStatus | 'all';
  overdueOnly?: boolean;
  dueBefore?: string | null;
  searchQuery?: string;
  milestone_id?: string | 'all';
}

export interface CollaborationWorkspace {
  id: string;
  challenge_id: string;
  challenge_title: string;
  organization_id: string;
  organization_name?: string;
  submission_id?: string | null;
  winning_submission_title?: string;
  name: string;
  description?: string;
  status: WorkspaceStatus;
  stage: WorkspaceStage;
  created_by: string;
  creator_name?: string;
  created_at: string;
  updated_at: string;
  members: WorkspaceMember[];
  tasks_progress?: {
    total: number;
    completed: number;
    percentage: number;
  };
  current_milestone?: string;
}

/** Normalize legacy task statuses to spec canonical values. */
export function normalizeTaskStatus(s: AnyTaskStatus): TaskStatus {
  if (s === 'done') return 'completed';
  if (s === 'review') return 'in_progress';
  return s as TaskStatus;
}

/** Normalize legacy milestone statuses to spec canonical values. */
export function normalizeMilestoneStatus(s: AnyMilestoneStatus): MilestoneStatus {
  if (s === 'approved') return 'completed';
  if (s === 'rejected') return 'cancelled';
  return s as MilestoneStatus;
}

/** Terminal task states (excluded from overdue computation). */
export function isTerminalTaskStatus(s: TaskStatus): boolean {
  return s === 'completed' || s === 'cancelled';
}

/** Real-time overdue check (uses actual clock, not mocked deadlines). */
export function isTaskOverdue(dueDate: string | null, status: TaskStatus, now: Date = new Date()): boolean {
  if (!dueDate) return false;
  if (isTerminalTaskStatus(status)) return false;
  return new Date(dueDate).getTime() < now.getTime();
}
