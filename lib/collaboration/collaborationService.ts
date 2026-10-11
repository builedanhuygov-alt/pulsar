import type {
  CollaborationWorkspace,
  WorkspaceMember,
  WorkspaceMessage,
  WorkspaceTask,
  WorkspaceMilestone,
  WorkspaceActivity,
  WorkspaceRole,
  WorkspaceStage,
  WorkspaceStatus,
  TaskStatus,
  TaskPriority,
  MilestoneStatus,
} from '../../types/collaboration.types';
import type { PulsarUser } from '../../types/auth.types';
import { challengeService } from '../challenge/challengeService';
import { outcomeRewardService } from '../outcome/outcomeRewardService';
import {
  createWorkspaceSchema,
  sendMessageSchema,
  createTaskSchema,
  createMilestoneSchema,
  submitDeliverableSchema,
  addMemberSchema,
  type CreateWorkspaceInput,
  type SendMessageInput,
  type CreateTaskInput,
  type CreateMilestoneInput,
  type SubmitDeliverableInput,
  type AddMemberInput,
} from '../validation/collaboration.schema';

// ==============================================================================
// INITIAL DEMO SEED DATA ( rõ ràng có nguồn gốc, kế thừa SP1-SP6 )
// ==============================================================================

const INITIAL_WORKSPACES: CollaborationWorkspace[] = [
  {
    id: 'ws-demo-001',
    challenge_id: 'ch-001',
    challenge_title: 'Hệ Thống Tối Ưu Lộ Trình Giao Hàng Xanh Bằng AI',
    organization_id: 'org-tech-01',
    organization_name: 'Việt Nam Tech Hub',
    submission_id: 'sub-001',
    winning_submission_title: 'EcoRoute: Tối ưu hoá đa điểm dừng kết hợp mô hình Graph Neural Network',
    name: 'Không Gian Dự Án EcoRoute AI — Giai Đoạn Triển Khai Thực Nghiệm',
    description:
      'Môi trường cộng tác chính thức giữa Doanh nghiệp Việt Nam Tech Hub và Creator Minh Quang để hiện thực hoá mô hình EcoRoute AI theo thoả thuận giải ngân.',
    status: 'active',
    stage: 'in_progress',
    created_by: 'usr-biz-001',
    creator_name: 'Bảo Trân (Business CEO)',
    created_at: '2026-03-02T08:00:00Z',
    updated_at: '2026-03-05T14:30:00Z',
    members: [
      {
        id: 'mem-001',
        workspace_id: 'ws-demo-001',
        user_id: 'usr-biz-001',
        name: 'Bảo Trân (Business CEO)',
        email: 'business@techcorp.dev',
        role: 'owner',
        status: 'active',
        joined_at: '2026-03-02T08:00:00Z',
      },
      {
        id: 'mem-002',
        workspace_id: 'ws-demo-001',
        user_id: 'usr-creator-001',
        name: 'Minh Quang (Creator)',
        email: 'creator.developer@pulsar.dev',
        role: 'creator',
        status: 'active',
        joined_at: '2026-03-02T08:05:00Z',
      },
      {
        id: 'mem-003',
        workspace_id: 'ws-demo-001',
        user_id: 'usr-reviewer-001',
        name: 'TS. Nguyễn Văn Hoàng (Lead Reviewer)',
        email: 'reviewer.ai@pulsar.dev',
        role: 'reviewer',
        status: 'active',
        joined_at: '2026-03-02T09:00:00Z',
      },
    ],
    tasks_progress: {
      total: 4,
      completed: 1,
      percentage: 25,
    },
    current_milestone: 'Milestone 2: Tích hợp GNN Model và Benchmark Tiết Kiệm Năng Lượng',
  },
];

const INITIAL_MEMBERS: WorkspaceMember[] = [
  {
    id: 'mem-001',
    workspace_id: 'ws-demo-001',
    user_id: 'usr-biz-001',
    name: 'Bảo Trân (Business CEO)',
    email: 'business@techcorp.dev',
    role: 'owner',
    status: 'active',
    joined_at: '2026-03-02T08:00:00Z',
    last_read_at: '2026-03-05T15:00:00Z',
  },
  {
    id: 'mem-002',
    workspace_id: 'ws-demo-001',
    user_id: 'usr-creator-001',
    name: 'Minh Quang (Creator)',
    email: 'creator.developer@pulsar.dev',
    role: 'creator',
    status: 'active',
    joined_at: '2026-03-02T08:05:00Z',
    last_read_at: '2026-03-05T15:10:00Z',
  },
  {
    id: 'mem-003',
    workspace_id: 'ws-demo-001',
    user_id: 'usr-reviewer-001',
    name: 'TS. Nguyễn Văn Hoàng (Lead Reviewer)',
    email: 'reviewer.ai@pulsar.dev',
    role: 'reviewer',
    status: 'active',
    joined_at: '2026-03-02T09:00:00Z',
    last_read_at: '2026-03-04T12:00:00Z',
  },
];

const INITIAL_MESSAGES: WorkspaceMessage[] = [
  {
    id: 'msg-001',
    workspace_id: 'ws-demo-001',
    sender_id: 'usr-biz-001',
    sender_name: 'Bảo Trân (Business CEO)',
    sender_role: 'owner',
    content:
      'Chào mừng Minh Quang và TS. Hoàng tham gia Workspace! Mục tiêu của sprint này là hoàn thiện kết nối API và đưa giải pháp EcoRoute chạy thử trên tập dữ liệu logistics thực tế của công ty.',
    message_type: 'text',
    attachments: [],
    read_by: ['usr-biz-001', 'usr-creator-001', 'usr-reviewer-001'],
    is_pinned: true,
    created_at: '2026-03-02T08:10:00Z',
  },
  {
    id: 'msg-002',
    workspace_id: 'ws-demo-001',
    sender_id: 'usr-creator-001',
    sender_name: 'Minh Quang (Creator)',
    sender_role: 'creator',
    content:
      'Chào chị Bảo Trân và thầy Hoàng. Em đã clone repo và chuẩn bị môi trường Docker container sẵn sàng. Em sẽ hoàn thành Milestone 1 trước thứ Tư tuần này.',
    message_type: 'text',
    attachments: [
      {
        id: 'att-001',
        name: 'architecture_diagram.png',
        url: 'https://storage.pulsar.dev/workspaces/ws-demo-001/architecture.png',
        type: 'image/png',
      },
    ],
    read_by: ['usr-biz-001', 'usr-creator-001'],
    is_pinned: false,
    created_at: '2026-03-02T08:30:00Z',
  },
  {
    id: 'msg-003',
    workspace_id: 'ws-demo-001',
    sender_id: 'usr-creator-001',
    sender_name: 'Minh Quang (Creator)',
    sender_role: 'creator',
    content:
      'Đã nộp sản phẩm bàn giao cho Milestone 1: Data Pipeline Architecture Spec v1.0. Nhờ thầy Hoàng và chị Trân kiểm tra giúp em ạ.',
    message_type: 'milestone_update',
    attachments: [
      {
        id: 'att-002',
        name: 'ecoroute_spec_v1.pdf',
        url: 'https://storage.pulsar.dev/workspaces/ws-demo-001/spec.pdf',
        size: 1420000,
        type: 'application/pdf',
      },
    ],
    read_by: ['usr-biz-001', 'usr-creator-001', 'usr-reviewer-001'],
    is_pinned: false,
    created_at: '2026-03-03T11:00:00Z',
  },
  {
    id: 'msg-004',
    workspace_id: 'ws-demo-001',
    sender_id: 'usr-biz-001',
    sender_name: 'Bảo Trân (Business CEO)',
    sender_role: 'owner',
    content:
      'Hội đồng đã xem qua tài liệu spec và test thử data loader. Kiến trúc rất rõ ràng, Milestone 1 chính thức được phê duyệt! Chúng ta tiếp tục sang Milestone 2 nhé.',
    message_type: 'system',
    attachments: [],
    read_by: ['usr-biz-001', 'usr-creator-001'],
    is_pinned: false,
    created_at: '2026-03-04T09:30:00Z',
  },
];

const INITIAL_TASKS: WorkspaceTask[] = [
  {
    id: 'task-001',
    workspace_id: 'ws-demo-001',
    title: 'Benchmark inference latency trên GPU T4',
    description: 'Đo lường thời gian phản hồi của GNN model với 500 điểm giao hàng đồng thời, yêu cầu < 2.5s.',
    status: 'done',
    priority: 'high',
    assignee_id: 'usr-creator-001',
    assignee_name: 'Minh Quang (Creator)',
    due_date: '2026-03-03T18:00:00Z',
    milestone_id: 'ms-001',
    created_by: 'usr-biz-001',
    creator_name: 'Bảo Trân',
    created_at: '2026-03-02T08:15:00Z',
    updated_at: '2026-03-03T16:00:00Z',
  },
  {
    id: 'task-002',
    workspace_id: 'ws-demo-001',
    title: 'Tích hợp API endpoint với backend test harness',
    description: 'Viết FastAPI endpoint nhận GeoJSON payload và trả về tối ưu tuyến đường.',
    status: 'in_progress',
    priority: 'urgent',
    assignee_id: 'usr-creator-001',
    assignee_name: 'Minh Quang (Creator)',
    due_date: '2026-03-10T18:00:00Z',
    milestone_id: 'ms-002',
    created_by: 'usr-biz-001',
    creator_name: 'Bảo Trân',
    created_at: '2026-03-02T08:20:00Z',
    updated_at: '2026-03-04T10:00:00Z',
  },
  {
    id: 'task-003',
    workspace_id: 'ws-demo-001',
    title: 'Kiểm tra bảo mật và scan dependency CVE',
    description: 'Chạy Trivy / Snyk scanner để phát hiện lỗ hổng thư viện Python và Docker base image.',
    status: 'todo',
    priority: 'medium',
    assignee_id: 'usr-reviewer-001',
    assignee_name: 'TS. Nguyễn Văn Hoàng',
    due_date: '2026-03-12T18:00:00Z',
    milestone_id: 'ms-002',
    created_by: 'usr-biz-001',
    creator_name: 'Bảo Trân',
    created_at: '2026-03-02T08:25:00Z',
    updated_at: '2026-03-02T08:25:00Z',
  },
  {
    id: 'task-004',
    workspace_id: 'ws-demo-001',
    title: 'Viết tài liệu Swagger & deployment guide',
    description: 'Tài liệu hướng dẫn deploy Kubernetes Helm chart và tài liệu API OpenAPI 3.1.',
    status: 'todo',
    priority: 'low',
    assignee_id: 'usr-creator-001',
    assignee_name: 'Minh Quang (Creator)',
    due_date: '2026-03-20T18:00:00Z',
    milestone_id: 'ms-003',
    created_by: 'usr-biz-001',
    creator_name: 'Bảo Trân',
    created_at: '2026-03-02T08:30:00Z',
    updated_at: '2026-03-02T08:30:00Z',
  },
];

const INITIAL_MILESTONES: WorkspaceMilestone[] = [
  {
    id: 'ms-001',
    workspace_id: 'ws-demo-001',
    title: 'Milestone 1: Khảo sát kiến trúc và chuẩn hóa Dataset mô phỏng',
    description: 'Thống nhất chuẩn format GeoJSON dữ liệu đơn hàng và sơ đồ kiến trúc module.',
    due_date: '2026-03-04T23:59:59Z',
    status: 'approved',
    deliverables: [
      {
        id: 'del-001',
        title: 'Data Pipeline Architecture Spec v1.0',
        url: 'https://github.com/pulsar-dev/ecoroute-spec',
        notes: 'Đã hoàn thành bàn giao và nghiệm thu kiến trúc',
        submitted_at: '2026-03-03T11:00:00Z',
        submitted_by: 'usr-creator-001',
        submitter_name: 'Minh Quang (Creator)',
      },
    ],
    order_index: 1,
    created_at: '2026-03-02T08:00:00Z',
    updated_at: '2026-03-04T09:30:00Z',
  },
  {
    id: 'ms-002',
    workspace_id: 'ws-demo-001',
    title: 'Milestone 2: Tích hợp GNN Model và Benchmark Tiết Kiệm Năng Lượng',
    description: 'Huấn luyện và fine-tune mô hình với bộ trọng số thực tế, chứng minh tiết kiệm >= 15% nhiên liệu.',
    due_date: '2026-03-15T23:59:59Z',
    status: 'in_progress',
    deliverables: [],
    order_index: 2,
    created_at: '2026-03-02T08:00:00Z',
    updated_at: '2026-03-04T09:30:00Z',
  },
  {
    id: 'ms-003',
    workspace_id: 'ws-demo-001',
    title: 'Milestone 3: Đóng gói Docker Container và Tài Liệu Bàn Giao',
    description: 'Bàn giao trọn gói Docker compose, script kiểm thử CI/CD và tài liệu hướng dẫn vận hành.',
    due_date: '2026-03-25T23:59:59Z',
    status: 'pending',
    deliverables: [],
    order_index: 3,
    created_at: '2026-03-02T08:00:00Z',
    updated_at: '2026-03-02T08:00:00Z',
  },
];

const INITIAL_ACTIVITIES: WorkspaceActivity[] = [
  {
    id: 'act-001',
    workspace_id: 'ws-demo-001',
    actor_id: 'usr-biz-001',
    actor_name: 'Bảo Trân (Business CEO)',
    action: 'workspace_created',
    target_type: 'workspace',
    target_id: 'ws-demo-001',
    details: 'Khởi tạo không gian cộng tác dự án EcoRoute AI',
    created_at: '2026-03-02T08:00:00Z',
  },
  {
    id: 'act-002',
    workspace_id: 'ws-demo-001',
    actor_id: 'usr-creator-001',
    actor_name: 'Minh Quang (Creator)',
    action: 'deliverable_submitted',
    target_type: 'milestone',
    target_id: 'ms-001',
    details: 'Nộp tài liệu: Data Pipeline Architecture Spec v1.0 cho Milestone 1',
    created_at: '2026-03-03T11:00:00Z',
  },
  {
    id: 'act-003',
    workspace_id: 'ws-demo-001',
    actor_id: 'usr-biz-001',
    actor_name: 'Bảo Trân (Business CEO)',
    action: 'milestone_approved',
    target_type: 'milestone',
    target_id: 'ms-001',
    details: 'Phê duyệt nghiệm thu Milestone 1',
    created_at: '2026-03-04T09:30:00Z',
  },
];

// ==============================================================================
// SERVICE IMPLEMENTATION (In-Memory Reactive Store with DB-grade Logic)
// ==============================================================================

class CollaborationService {
  private workspaces: CollaborationWorkspace[] = [...INITIAL_WORKSPACES];
  private members: WorkspaceMember[] = [...INITIAL_MEMBERS];
  private messages: WorkspaceMessage[] = [...INITIAL_MESSAGES];
  private tasks: WorkspaceTask[] = [...INITIAL_TASKS];
  private milestones: WorkspaceMilestone[] = [...INITIAL_MILESTONES];
  private activities: WorkspaceActivity[] = [...INITIAL_ACTIVITIES];

  /**
   * Helper: Calculate task progress for workspace
   */
  private recalculateProgress(workspaceId: string): { total: number; completed: number; percentage: number } {
    const wsTasks = this.tasks.filter((t) => t.workspace_id === workspaceId);
    const total = wsTasks.length;
    const completed = wsTasks.filter((t) => t.status === 'done').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage };
  }

  /**
   * Helper: Check if user is a member or admin
   */
  public isMember(workspaceId: string, userId: string): boolean {
    return this.members.some(
      (m) => m.workspace_id === workspaceId && m.user_id === userId && m.status === 'active'
    );
  }

  /**
   * Helper: Get member role
   */
  public getMemberRole(workspaceId: string, userId: string): WorkspaceRole | null {
    const member = this.members.find(
      (m) => m.workspace_id === workspaceId && m.user_id === userId && m.status === 'active'
    );
    return member ? member.role : null;
  }

  /**
   * 1. CREATE WORKSPACE
   * Enforces business access rules:
   * - Challenge must exist.
   * - Actor must be organization member or admin, OR an approved/winner creator.
   * - Cannot be created unilaterally by unselected creator.
   */
  public async createWorkspace(
    input: CreateWorkspaceInput,
    actor: PulsarUser
  ): Promise<{ success: boolean; workspace?: CollaborationWorkspace; error?: string }> {
    try {
      const validated = createWorkspaceSchema.parse(input);

      // Verify challenge existence
      const challenge = challengeService.getChallengeById(validated.challenge_id);
      if (!challenge) {
        return { success: false, error: 'Không tìm thấy thử thách tương ứng.' };
      }

      // Check organization membership of actor
      const isOrgMember = actor.organizations?.some(
        (o) => o.organization.id === challenge.organization_id
      );
      const isSystemAdmin = actor.role === 'admin';

      // Check if actor is an eligible creator (must have winning outcome or accepted submission)
      const outcomes = outcomeRewardService.getOrganizationOutcomes(challenge.organization_id);
      const winningOutcome = outcomes.find(
        (o) => o.challenge_id === challenge.id && o.winner_id === actor.id
      );

      const isEligibleCreator = Boolean(winningOutcome);

      if (!isOrgMember && !isSystemAdmin && !isEligibleCreator) {
        return {
          success: false,
          error:
            'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ đơn vị tổ chức thử thách, Quản trị viên hệ thống hoặc Creator đã được trao giải/phê duyệt mới có quyền tạo Không gian Cộng tác.',
        };
      }

      const now = new Date().toISOString();
      const workspaceId = `ws-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      // Initialize workspace members list
      const initialMembers: WorkspaceMember[] = [];

      // Add creator of workspace (actor)
      const actorRole: WorkspaceRole = isOrgMember || isSystemAdmin ? 'owner' : 'creator';
      initialMembers.push({
        id: `mem-${Date.now()}-1`,
        workspace_id: workspaceId,
        user_id: actor.id,
        name: actor.profile.full_name || actor.email,
        email: actor.email,
        role: actorRole,
        status: 'active',
        joined_at: now,
      });

      // If submission_id or winning creator exists, automatically add creator if actor is business
      let submissionTitle: string | undefined = undefined;
      if (winningOutcome && winningOutcome.winner_id && winningOutcome.winner_id !== actor.id) {
        initialMembers.push({
          id: `mem-${Date.now()}-2`,
          workspace_id: workspaceId,
          user_id: winningOutcome.winner_id,
          name: winningOutcome.winner_name || 'Creator',
          email: winningOutcome.winner_email || 'creator@pulsar.dev',
          role: 'creator',
          status: 'active',
          joined_at: now,
        });
        submissionTitle = winningOutcome.winning_submission_title;
      }

      const newWorkspace: CollaborationWorkspace = {
        id: workspaceId,
        challenge_id: challenge.id,
        challenge_title: challenge.title,
        organization_id: challenge.organization_id,
        organization_name: challenge.organization_name,
        submission_id: validated.submission_id || winningOutcome?.winning_submission_id || null,
        winning_submission_title: submissionTitle,
        name: validated.name,
        description: validated.description || '',
        status: 'active',
        stage: validated.initial_stage || 'briefing',
        created_by: actor.id,
        creator_name: actor.profile.full_name || actor.email,
        created_at: now,
        updated_at: now,
        members: initialMembers,
        tasks_progress: { total: 0, completed: 0, percentage: 0 },
      };

      this.workspaces.unshift(newWorkspace);
      this.members.push(...initialMembers);

      // Log activity
      this.activities.unshift({
        id: `act-${Date.now()}`,
        workspace_id: workspaceId,
        actor_id: actor.id,
        actor_name: actor.profile.full_name || actor.email,
        action: 'workspace_created',
        target_type: 'workspace',
        target_id: workspaceId,
        details: `Tạo không gian làm việc: "${validated.name}"`,
        created_at: now,
      });

      // Create initial greeting system message
      this.messages.unshift({
        id: `msg-${Date.now()}`,
        workspace_id: workspaceId,
        sender_id: actor.id,
        sender_name: 'Pulsar System',
        sender_role: 'admin',
        content: `Không gian cộng tác đã được kích hoạt. Hãy trao đổi và thiết lập các mốc bàn giao ban đầu tại đây.`,
        message_type: 'system',
        attachments: [],
        read_by: [actor.id],
        is_pinned: false,
        created_at: now,
      });

      return { success: true, workspace: newWorkspace };
    } catch (err: any) {
      const message = err.errors?.[0]?.message || err.message || 'Lỗi tạo không gian cộng tác';
      return { success: false, error: message };
    }
  }

  /**
   * 2. GET WORKSPACE DETAIL (Strict Access Control)
   */
  public getWorkspace(
    workspaceId: string,
    actor: PulsarUser
  ): { success: boolean; workspace?: CollaborationWorkspace; error?: string } {
    const ws = this.workspaces.find((w) => w.id === workspaceId);
    if (!ws) {
      return { success: false, error: 'Không tìm thấy không gian làm việc.' };
    }

    const isMember = this.isMember(workspaceId, actor.id);
    const isSystemAdmin = actor.role === 'admin';

    if (!isMember && !isSystemAdmin) {
      return {
        success: false,
        error: 'TRUY CẬP BỊ TỪ CHỐI (403): Bạn không phải là thành viên của không gian làm việc này.',
      };
    }

    // Refresh members and progress
    const currentMembers = this.members.filter((m) => m.workspace_id === workspaceId && m.status === 'active');
    const progress = this.recalculateProgress(workspaceId);

    const fullWorkspace: CollaborationWorkspace = {
      ...ws,
      members: currentMembers,
      tasks_progress: progress,
    };

    return { success: true, workspace: fullWorkspace };
  }

  /**
   * 3. LIST WORKSPACES FOR USER
   */
  public listWorkspacesForUser(
    actor: PulsarUser,
    filters?: { status?: WorkspaceStatus; challengeId?: string }
  ): CollaborationWorkspace[] {
    const isSystemAdmin = actor.role === 'admin';

    let userWorkspaces: CollaborationWorkspace[] = [];

    if (isSystemAdmin) {
      userWorkspaces = [...this.workspaces];
    } else {
      // Find workspace IDs where actor is an active member
      const memberWorkspaceIds = new Set(
        this.members
          .filter((m) => m.user_id === actor.id && m.status === 'active')
          .map((m) => m.workspace_id)
      );
      userWorkspaces = this.workspaces.filter((w) => memberWorkspaceIds.has(w.id));
    }

    if (filters?.status) {
      userWorkspaces = userWorkspaces.filter((w) => w.status === filters.status);
    }

    if (filters?.challengeId) {
      userWorkspaces = userWorkspaces.filter((w) => w.challenge_id === filters.challengeId);
    }

    // Attach latest members and progress
    return userWorkspaces.map((w) => ({
      ...w,
      members: this.members.filter((m) => m.workspace_id === w.id && m.status === 'active'),
      tasks_progress: this.recalculateProgress(w.id),
    }));
  }

  /**
   * 4. MEMBER MANAGEMENT
   */
  public async addMember(
    workspaceId: string,
    input: AddMemberInput,
    actor: PulsarUser
  ): Promise<{ success: boolean; member?: WorkspaceMember; error?: string }> {
    try {
      const validated = addMemberSchema.parse(input);

      const ws = this.workspaces.find((w) => w.id === workspaceId);
      if (!ws) return { success: false, error: 'Không tìm thấy không gian làm việc.' };

      // Role check: Only owner, workspace admin or system admin can add members
      const actorRole = this.getMemberRole(workspaceId, actor.id);
      const isAuthorized = actorRole === 'owner' || actorRole === 'admin' || actor.role === 'admin';
      if (!isAuthorized) {
        return {
          success: false,
          error: 'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ chủ sở hữu hoặc quản trị viên workspace mới được mời thêm thành viên.',
        };
      }

      // Check duplicate
      const existing = this.members.find(
        (m) => m.workspace_id === workspaceId && m.user_id === validated.user_id && m.status === 'active'
      );
      if (existing) {
        return { success: false, error: 'Thành viên này đã có trong không gian làm việc.' };
      }

      const now = new Date().toISOString();
      const newMember: WorkspaceMember = {
        id: `mem-${Date.now()}`,
        workspace_id: workspaceId,
        user_id: validated.user_id,
        name: validated.name,
        email: validated.email,
        role: validated.role,
        status: 'active',
        joined_at: now,
      };

      this.members.push(newMember);

      // Log activity
      this.activities.unshift({
        id: `act-${Date.now()}`,
        workspace_id: workspaceId,
        actor_id: actor.id,
        actor_name: actor.profile.full_name || actor.email,
        action: 'member_added',
        target_type: 'member',
        target_id: newMember.id,
        details: `Thêm thành viên mới: ${validated.name} (${validated.role})`,
        created_at: now,
      });

      // System notification message
      this.messages.unshift({
        id: `msg-${Date.now()}`,
        workspace_id: workspaceId,
        sender_id: actor.id,
        sender_name: 'Pulsar System',
        sender_role: 'admin',
        content: `${validated.name} đã được thêm vào Không gian làm việc với vai trò [${validated.role}].`,
        message_type: 'system',
        attachments: [],
        read_by: [actor.id],
        is_pinned: false,
        created_at: now,
      });

      return { success: true, member: newMember };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi thêm thành viên' };
    }
  }

  public async removeMember(
    workspaceId: string,
    targetUserId: string,
    actor: PulsarUser
  ): Promise<{ success: boolean; error?: string }> {
    const actorRole = this.getMemberRole(workspaceId, actor.id);
    const isAuthorized = actorRole === 'owner' || actorRole === 'admin' || actor.role === 'admin';
    if (!isAuthorized) {
      return {
        success: false,
        error: 'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ chủ sở hữu workspace mới có quyền xoá thành viên.',
      };
    }

    const memberIndex = this.members.findIndex(
      (m) => m.workspace_id === workspaceId && m.user_id === targetUserId && m.status === 'active'
    );
    if (memberIndex === -1) {
      return { success: false, error: 'Không tìm thấy thành viên trong workspace.' };
    }

    const targetMember = this.members[memberIndex];
    if (targetMember.role === 'owner') {
      return { success: false, error: 'Không thể xoá chủ sở hữu (Owner) khỏi workspace.' };
    }

    targetMember.status = 'removed';

    this.activities.unshift({
      id: `act-${Date.now()}`,
      workspace_id: workspaceId,
      actor_id: actor.id,
      actor_name: actor.profile.full_name || actor.email,
      action: 'member_removed',
      target_type: 'member',
      target_id: targetMember.id,
      details: `Đã loại bỏ thành viên ${targetMember.name} khỏi workspace`,
      created_at: new Date().toISOString(),
    });

    return { success: true };
  }

  /**
   * 5. MESSAGING CENTER
   */
  public async sendMessage(
    workspaceId: string,
    input: SendMessageInput,
    actor: PulsarUser
  ): Promise<{ success: boolean; message?: WorkspaceMessage; error?: string }> {
    try {
      const validated = sendMessageSchema.parse(input);

      // Access Check: Must be member or system admin
      const isMember = this.isMember(workspaceId, actor.id);
      const isSystemAdmin = actor.role === 'admin';
      if (!isMember && !isSystemAdmin) {
        return {
          success: false,
          error: 'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ thành viên mới được gửi tin nhắn trong workspace này.',
        };
      }

      const role = this.getMemberRole(workspaceId, actor.id) || (isSystemAdmin ? 'admin' : 'member');
      const now = new Date().toISOString();

      const newMsg: WorkspaceMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        workspace_id: workspaceId,
        sender_id: actor.id,
        sender_name: actor.profile.full_name || actor.email,
        sender_role: role,
        content: validated.content,
        message_type: validated.message_type || 'text',
        attachments: (validated.attachments as any) || [],
        read_by: [actor.id],
        is_pinned: validated.is_pinned || false,
        created_at: now,
      };

      this.messages.unshift(newMsg);

      // Log activity
      this.activities.unshift({
        id: `act-${Date.now()}`,
        workspace_id: workspaceId,
        actor_id: actor.id,
        actor_name: actor.profile.full_name || actor.email,
        action: 'message_sent',
        target_type: 'message',
        target_id: newMsg.id,
        details: `Gửi tin nhắn: "${validated.content.substring(0, 40)}${validated.content.length > 40 ? '...' : ''}"`,
        created_at: now,
      });

      return { success: true, message: newMsg };
    } catch (err: any) {
      const message = err.errors?.[0]?.message || err.message || 'Lỗi gửi tin nhắn';
      return { success: false, error: message };
    }
  }

  public getMessages(
    workspaceId: string,
    actor: PulsarUser,
    options?: { page?: number; limit?: number }
  ): {
    success: boolean;
    messages?: WorkspaceMessage[];
    total?: number;
    page?: number;
    totalPages?: number;
    error?: string;
  } {
    const isMember = this.isMember(workspaceId, actor.id);
    const isSystemAdmin = actor.role === 'admin';
    if (!isMember && !isSystemAdmin) {
      return {
        success: false,
        error: 'TRUY CẬP BỊ TỪ CHỐI (403): Bạn không có quyền truy cập lịch sử tin nhắn.',
      };
    }

    const allMessages = this.messages
      .filter((m) => m.workspace_id === workspaceId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Auto mark retrieved messages as read by actor
    allMessages.forEach((msg) => {
      if (!msg.read_by.includes(actor.id)) {
        msg.read_by.push(actor.id);
      }
    });

    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const total = allMessages.length;
    const totalPages = Math.ceil(total / limit) || 1;

    const start = Math.max(0, (page - 1) * limit);
    const paginated = allMessages.slice(start, start + limit);

    return {
      success: true,
      messages: paginated,
      total,
      page,
      totalPages,
    };
  }

  public markAsRead(workspaceId: string, messageIds: string[], actor: PulsarUser): boolean {
    if (!this.isMember(workspaceId, actor.id) && actor.role !== 'admin') {
      return false;
    }

    let modified = false;
    this.messages.forEach((msg) => {
      if (msg.workspace_id === workspaceId && messageIds.includes(msg.id)) {
        if (!msg.read_by.includes(actor.id)) {
          msg.read_by.push(actor.id);
          modified = true;
        }
      }
    });
    return modified;
  }

  /**
   * 6. TASKS MANAGEMENT
   */
  public async createTask(
    workspaceId: string,
    input: CreateTaskInput,
    actor: PulsarUser
  ): Promise<{ success: boolean; task?: WorkspaceTask; error?: string }> {
    try {
      const validated = createTaskSchema.parse(input);

      if (!this.isMember(workspaceId, actor.id) && actor.role !== 'admin') {
        return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Không có quyền tạo nhiệm vụ.' };
      }

      const now = new Date().toISOString();
      const newTask: WorkspaceTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        workspace_id: workspaceId,
        title: validated.title,
        description: validated.description || '',
        status: 'todo',
        priority: validated.priority,
        assignee_id: validated.assignee_id || null,
        due_date: validated.due_date || null,
        milestone_id: validated.milestone_id || null,
        created_by: actor.id,
        creator_name: actor.profile.full_name || actor.email,
        created_at: now,
        updated_at: now,
      };

      this.tasks.push(newTask);

      // Log activity
      this.activities.unshift({
        id: `act-${Date.now()}`,
        workspace_id: workspaceId,
        actor_id: actor.id,
        actor_name: actor.profile.full_name || actor.email,
        action: 'task_created',
        target_type: 'task',
        target_id: newTask.id,
        details: `Tạo nhiệm vụ mới: "${newTask.title}" [${newTask.priority}]`,
        created_at: now,
      });

      return { success: true, task: newTask };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi tạo nhiệm vụ' };
    }
  }

  public getTasks(workspaceId: string, actor: PulsarUser): WorkspaceTask[] {
    if (!this.isMember(workspaceId, actor.id) && actor.role !== 'admin') {
      return [];
    }
    return this.tasks.filter((t) => t.workspace_id === workspaceId);
  }

  public updateTaskStatus(
    workspaceId: string,
    taskId: string,
    status: TaskStatus,
    actor: PulsarUser
  ): { success: boolean; task?: WorkspaceTask; error?: string } {
    if (!this.isMember(workspaceId, actor.id) && actor.role !== 'admin') {
      return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403)' };
    }

    const task = this.tasks.find((t) => t.workspace_id === workspaceId && t.id === taskId);
    if (!task) return { success: false, error: 'Không tìm thấy nhiệm vụ.' };

    const oldStatus = task.status;
    task.status = status;
    task.updated_at = new Date().toISOString();

    // Log activity
    this.activities.unshift({
      id: `act-${Date.now()}`,
      workspace_id: workspaceId,
      actor_id: actor.id,
      actor_name: actor.profile.full_name || actor.email,
      action: 'task_status_updated',
      target_type: 'task',
      target_id: task.id,
      details: `Cập nhật nhiệm vụ "${task.title}": ${oldStatus} ➔ ${status}`,
      created_at: new Date().toISOString(),
    });

    return { success: true, task };
  }

  /**
   * 7. MILESTONES & DELIVERABLES MANAGEMENT
   */
  public async createMilestone(
    workspaceId: string,
    input: CreateMilestoneInput,
    actor: PulsarUser
  ): Promise<{ success: boolean; milestone?: WorkspaceMilestone; error?: string }> {
    try {
      const validated = createMilestoneSchema.parse(input);

      const actorRole = this.getMemberRole(workspaceId, actor.id);
      const isAuthorized = actorRole === 'owner' || actorRole === 'reviewer' || actorRole === 'admin' || actor.role === 'admin';
      if (!isAuthorized) {
        return {
          success: false,
          error: 'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ chủ dự án hoặc Reviewer mới được thiết lập Mốc bàn giao.',
        };
      }

      const now = new Date().toISOString();
      const newMs: WorkspaceMilestone = {
        id: `ms-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        workspace_id: workspaceId,
        title: validated.title,
        description: validated.description || '',
        due_date: validated.due_date || null,
        status: 'pending',
        deliverables: [],
        order_index: validated.order_index,
        created_at: now,
        updated_at: now,
      };

      this.milestones.push(newMs);

      this.activities.unshift({
        id: `act-${Date.now()}`,
        workspace_id: workspaceId,
        actor_id: actor.id,
        actor_name: actor.profile.full_name || actor.email,
        action: 'milestone_created',
        target_type: 'milestone',
        target_id: newMs.id,
        details: `Thiết lập mốc bàn giao: "${newMs.title}"`,
        created_at: now,
      });

      return { success: true, milestone: newMs };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi tạo mốc bàn giao' };
    }
  }

  public getMilestones(workspaceId: string, actor: PulsarUser): WorkspaceMilestone[] {
    if (!this.isMember(workspaceId, actor.id) && actor.role !== 'admin') {
      return [];
    }
    return this.milestones
      .filter((m) => m.workspace_id === workspaceId)
      .sort((a, b) => a.order_index - b.order_index);
  }

  public async submitDeliverable(
    workspaceId: string,
    input: SubmitDeliverableInput,
    actor: PulsarUser
  ): Promise<{ success: boolean; milestone?: WorkspaceMilestone; error?: string }> {
    try {
      const validated = submitDeliverableSchema.parse(input);

      if (!this.isMember(workspaceId, actor.id) && actor.role !== 'admin') {
        return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Không có quyền nộp sản phẩm.' };
      }

      const ms = this.milestones.find((m) => m.workspace_id === workspaceId && m.id === validated.milestone_id);
      if (!ms) return { success: false, error: 'Không tìm thấy mốc bàn giao tương ứng.' };

      const now = new Date().toISOString();
      const deliverableItem = {
        id: `del-${Date.now()}`,
        title: validated.title,
        url: validated.url,
        notes: validated.notes || '',
        submitted_at: now,
        submitted_by: actor.id,
        submitter_name: actor.profile.full_name || actor.email,
      };

      ms.deliverables.push(deliverableItem);
      ms.status = 'submitted';
      ms.updated_at = now;

      // Log activity
      this.activities.unshift({
        id: `act-${Date.now()}`,
        workspace_id: workspaceId,
        actor_id: actor.id,
        actor_name: actor.profile.full_name || actor.email,
        action: 'deliverable_submitted',
        target_type: 'milestone',
        target_id: ms.id,
        details: `Nộp sản phẩm "${validated.title}" cho mốc [${ms.title}]`,
        created_at: now,
      });

      // Post chat notification
      this.messages.unshift({
        id: `msg-${Date.now()}`,
        workspace_id: workspaceId,
        sender_id: actor.id,
        sender_name: actor.profile.full_name || actor.email,
        sender_role: this.getMemberRole(workspaceId, actor.id) || 'creator',
        content: `Đã nộp sản phẩm bàn giao cho "${ms.title}": ${validated.title}. Liên kết: ${validated.url}`,
        message_type: 'milestone_update',
        attachments: [
          {
            id: deliverableItem.id,
            name: validated.title,
            url: validated.url,
          },
        ],
        read_by: [actor.id],
        is_pinned: false,
        created_at: now,
      });

      return { success: true, milestone: ms };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi nộp sản phẩm bàn giao' };
    }
  }

  public approveMilestone(
    workspaceId: string,
    milestoneId: string,
    actor: PulsarUser
  ): { success: boolean; milestone?: WorkspaceMilestone; error?: string } {
    const actorRole = this.getMemberRole(workspaceId, actor.id);
    const isAuthorized = actorRole === 'owner' || actorRole === 'reviewer' || actorRole === 'admin' || actor.role === 'admin';
    if (!isAuthorized) {
      return {
        success: false,
        error: 'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ Owner hoặc Reviewer mới có quyền nghiệm thu mốc bàn giao.',
      };
    }

    const ms = this.milestones.find((m) => m.workspace_id === workspaceId && m.id === milestoneId);
    if (!ms) return { success: false, error: 'Không tìm thấy mốc bàn giao.' };

    const now = new Date().toISOString();
    ms.status = 'approved';
    ms.updated_at = now;

    // Check if all milestones are approved
    const allMs = this.milestones.filter((m) => m.workspace_id === workspaceId);
    const allApproved = allMs.every((m) => m.status === 'approved');
    if (allApproved && allMs.length > 0) {
      const ws = this.workspaces.find((w) => w.id === workspaceId);
      if (ws) ws.stage = 'completed';
    }

    // Log activity
    this.activities.unshift({
      id: `act-${Date.now()}`,
      workspace_id: workspaceId,
      actor_id: actor.id,
      actor_name: actor.profile.full_name || actor.email,
      action: 'milestone_approved',
      target_type: 'milestone',
      target_id: ms.id,
      details: `Nghiệm thu thành công mốc bàn giao "${ms.title}"`,
      created_at: now,
    });

    // Chat notification
    this.messages.unshift({
      id: `msg-${Date.now()}`,
      workspace_id: workspaceId,
      sender_id: actor.id,
      sender_name: actor.profile.full_name || actor.email,
      sender_role: actorRole || 'owner',
      content: `Mốc bàn giao [${ms.title}] đã chính thức được nghiệm thu và phê duyệt!`,
      message_type: 'system',
      attachments: [],
      read_by: [actor.id],
      is_pinned: false,
      created_at: now,
    });

    return { success: true, milestone: ms };
  }

  public rejectMilestone(
    workspaceId: string,
    milestoneId: string,
    feedback: string,
    actor: PulsarUser
  ): { success: boolean; milestone?: WorkspaceMilestone; error?: string } {
    const actorRole = this.getMemberRole(workspaceId, actor.id);
    const isAuthorized = actorRole === 'owner' || actorRole === 'reviewer' || actorRole === 'admin' || actor.role === 'admin';
    if (!isAuthorized) {
      return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403)' };
    }

    const ms = this.milestones.find((m) => m.workspace_id === workspaceId && m.id === milestoneId);
    if (!ms) return { success: false, error: 'Không tìm thấy mốc bàn giao.' };

    const now = new Date().toISOString();
    ms.status = 'rejected';
    ms.updated_at = now;

    // Log activity
    this.activities.unshift({
      id: `act-${Date.now()}`,
      workspace_id: workspaceId,
      actor_id: actor.id,
      actor_name: actor.profile.full_name || actor.email,
      action: 'milestone_rejected',
      target_type: 'milestone',
      target_id: ms.id,
      details: `Yêu cầu chỉnh sửa mốc "${ms.title}": ${feedback}`,
      created_at: now,
    });

    // Chat notification
    this.messages.unshift({
      id: `msg-${Date.now()}`,
      workspace_id: workspaceId,
      sender_id: actor.id,
      sender_name: actor.profile.full_name || actor.email,
      sender_role: actorRole || 'reviewer',
      content: `Yêu cầu hoàn thiện mốc [${ms.title}]: ${feedback}`,
      message_type: 'system',
      attachments: [],
      read_by: [actor.id],
      is_pinned: false,
      created_at: now,
    });

    return { success: true, milestone: ms };
  }

  /**
   * 8. WORKSPACE STAGE & STATUS MANAGEMENT
   */
  public updateWorkspaceStage(
    workspaceId: string,
    stage: WorkspaceStage,
    actor: PulsarUser
  ): { success: boolean; workspace?: CollaborationWorkspace; error?: string } {
    const actorRole = this.getMemberRole(workspaceId, actor.id);
    if (actorRole !== 'owner' && actor.role !== 'admin') {
      return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ chủ sở hữu mới được đổi giai đoạn workspace.' };
    }

    const ws = this.workspaces.find((w) => w.id === workspaceId);
    if (!ws) return { success: false, error: 'Không tìm thấy không gian làm việc.' };

    ws.stage = stage;
    ws.updated_at = new Date().toISOString();

    return { success: true, workspace: ws };
  }

  /**
   * 9. AUDIT ACTIVITIES
   */
  public getActivities(workspaceId: string, actor: PulsarUser): WorkspaceActivity[] {
    if (!this.isMember(workspaceId, actor.id) && actor.role !== 'admin') {
      return [];
    }
    return this.activities
      .filter((a) => a.workspace_id === workspaceId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}

export const collaborationService = new CollaborationService();
