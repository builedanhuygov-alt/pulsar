export type WorkspaceRole = 'owner' | 'creator' | 'reviewer' | 'member' | 'admin' | 'observer';

export type WorkspaceStage =
  | 'briefing'
  | 'in_progress'
  | 'review'
  | 'revision'
  | 'completed'
  | 'closed';

export type WorkspaceStatus = 'active' | 'completed' | 'archived' | 'paused';

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type MilestoneStatus =
  | 'pending'
  | 'in_progress'
  | 'submitted'
  | 'approved'
  | 'rejected';

export type MessageType = 'text' | 'system' | 'file' | 'milestone_update';

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
}

export interface WorkspaceActivity {
  id: string;
  workspace_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  target_type: 'workspace' | 'message' | 'task' | 'milestone' | 'member';
  target_id: string;
  details: string;
  metadata?: Record<string, any>;
  created_at: string;
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
