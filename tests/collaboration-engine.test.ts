import { describe, it, expect, beforeEach } from 'vitest';
import { collaborationService } from '../lib/collaboration/collaborationService';
import type { PulsarUser } from '../types/auth.types';

describe('PULSAR Sprint 7 — Collaboration & Communication Engine Suite', () => {
  // Test users
  const businessUser: PulsarUser = {
    id: 'usr-biz-001',
    email: 'business@techcorp.dev',
    role: 'business',
    organizations: [
      {
        membership_role: 'admin',
        organization: {
          id: 'org-tech-01',
          name: 'Việt Nam Tech Hub',
          slug: 'vietnam-tech-hub',
          type: 'enterprise',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      },
    ],
    profile: {
      id: 'usr-biz-001',
      full_name: 'Bảo Trân (Business CEO)',
      headline: 'CEO tại Việt Nam Tech Hub',
      avatar_url: null,
      skills: [],
      bio: '',
      reputation_score: 95,
      role: 'business',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  };

  const winningCreatorUser: PulsarUser = {
    id: 'usr-creator-001',
    email: 'creator.developer@pulsar.dev',
    role: 'creator',
    organizations: [],
    profile: {
      id: 'usr-creator-001',
      full_name: 'Minh Quang (Creator)',
      headline: 'AI & Full-stack Engineer',
      avatar_url: null,
      skills: ['Python', 'PyTorch', 'TypeScript'],
      bio: '',
      reputation_score: 92,
      role: 'creator',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  };

  const outsiderUser: PulsarUser = {
    id: 'usr-outsider-999',
    email: 'outsider@pulsar.dev',
    role: 'creator',
    organizations: [],
    profile: {
      id: 'usr-outsider-999',
      full_name: 'Người Ngoài (Hacker/Unmatched)',
      headline: 'Unverified user',
      avatar_url: null,
      skills: [],
      bio: '',
      reputation_score: 0,
      role: 'creator',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  };

  const systemAdminUser: PulsarUser = {
    id: 'usr-admin-001',
    email: 'admin@pulsar.dev',
    role: 'admin',
    organizations: [],
    profile: {
      id: 'usr-admin-001',
      full_name: 'Quản Trị Viên Hệ Thống',
      headline: 'Super Admin',
      avatar_url: null,
      skills: [],
      bio: '',
      reputation_score: 100,
      role: 'admin',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  };

  describe('1. Workspace Access Eligibility & Creation Safeguards', () => {
    it('SP7-WS-1: Rejects workspace creation by unselected/unmatched outsider creator (403)', async () => {
      const res = await collaborationService.createWorkspace(
        {
          challenge_id: 'ch-001',
          name: 'Hacker Unauthorized Workspace',
          description: 'Cố ý tạo workspace khi chưa được doanh nghiệp chọn',
        },
        outsiderUser
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('TRUY CẬP BỊ TỪ CHỐI (403)');
    });

    it('SP7-WS-2: Allows Organization Owner/Admin to create collaboration workspace', async () => {
      const res = await collaborationService.createWorkspace(
        {
          challenge_id: 'ch-001',
          name: 'Không Gian Triển Khai Pha 2 EcoRoute',
          description: 'Hợp tác phát triển phiên bản thương mại',
          initial_stage: 'in_progress',
        },
        businessUser
      );

      expect(res.success).toBe(true);
      expect(res.workspace).toBeDefined();
      expect(res.workspace?.challenge_id).toBe('ch-001');
      expect(res.workspace?.organization_id).toBe('org-tech-01');
      expect(res.workspace?.created_by).toBe(businessUser.id);
      // Automatically enlists creator if outcome has winner
      const members = res.workspace?.members.map((m) => m.user_id);
      expect(members).toContain(winningCreatorUser.id);
    });

    it('SP7-WS-3: Rejects creation for non-existent challenge ID', async () => {
      const res = await collaborationService.createWorkspace(
        {
          challenge_id: 'ch-non-existent-999',
          name: 'Test Invalid Challenge',
        },
        businessUser
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('Không tìm thấy thử thách tương ứng');
    });
  });

  describe('2. Workspace Authorization & Isolation (IDOR Protection)', () => {
    it('SP7-ISO-1: Permitted member can read workspace details', () => {
      const res = collaborationService.getWorkspace('ws-demo-001', winningCreatorUser);
      expect(res.success).toBe(true);
      expect(res.workspace?.id).toBe('ws-demo-001');
      expect(res.workspace?.name).toContain('EcoRoute AI');
    });

    it('SP7-ISO-2: Outsider non-member is rejected with 403 Forbidden', () => {
      const res = collaborationService.getWorkspace('ws-demo-001', outsiderUser);
      expect(res.success).toBe(false);
      expect(res.error).toContain('TRUY CẬP BỊ TỪ CHỐI (403)');
    });

    it('SP7-ISO-3: System admin has oversight privilege over any workspace', () => {
      const res = collaborationService.getWorkspace('ws-demo-001', systemAdminUser);
      expect(res.success).toBe(true);
      expect(res.workspace?.id).toBe('ws-demo-001');
    });

    it('SP7-ISO-4: listWorkspacesForUser strictly isolates workspaces per user', () => {
      const creatorList = collaborationService.listWorkspacesForUser(winningCreatorUser);
      expect(creatorList.some((w) => w.id === 'ws-demo-001')).toBe(true);

      const outsiderList = collaborationService.listWorkspacesForUser(outsiderUser);
      expect(outsiderList.some((w) => w.id === 'ws-demo-001')).toBe(false);
    });
  });

  describe('3. Messaging Center & Sanitization', () => {
    it('SP7-MSG-1: Member can send valid message and appears in history', async () => {
      const res = await collaborationService.sendMessage(
        'ws-demo-001',
        {
          content: 'Em đã cập nhật latency test đạt 1.8s, vượt kỳ vọng!',
          message_type: 'text',
        },
        winningCreatorUser
      );

      expect(res.success).toBe(true);
      expect(res.message?.sender_id).toBe(winningCreatorUser.id);
      expect(res.message?.read_by).toContain(winningCreatorUser.id);

      // Verify retrieval
      const history = collaborationService.getMessages('ws-demo-001', winningCreatorUser);
      expect(history.success).toBe(true);
      const found = history.messages?.find((m) => m.id === res.message?.id);
      expect(found).toBeDefined();
    });

    it('SP7-MSG-2: Rejects empty or whitespace-only messages', async () => {
      const res = await collaborationService.sendMessage(
        'ws-demo-001',
        {
          content: '    ',
        },
        winningCreatorUser
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('không được để trống');
    });

    it('SP7-MSG-3: Rejects messages exceeding maximum length (> 2000 chars)', async () => {
      const longContent = 'A'.repeat(2005);
      const res = await collaborationService.sendMessage(
        'ws-demo-001',
        {
          content: longContent,
        },
        winningCreatorUser
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('tối đa 2000 ký tự');
    });

    it('SP7-MSG-4: Non-member cannot send messages (403)', async () => {
      const res = await collaborationService.sendMessage(
        'ws-demo-001',
        {
          content: 'Spam from outsider',
        },
        outsiderUser
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('TRUY CẬP BỊ TỪ CHỐI (403)');
    });

    it('SP7-MSG-5: Message retrieval updates read receipts automatically', () => {
      const history = collaborationService.getMessages('ws-demo-001', businessUser);
      expect(history.success).toBe(true);
      history.messages?.forEach((msg) => {
        expect(msg.read_by).toContain(businessUser.id);
      });
    });
  });

  describe('4. Member & Role Management', () => {
    it('SP7-MEM-1: Workspace Owner can invite new reviewer to workspace', async () => {
      const res = await collaborationService.addMember(
        'ws-demo-001',
        {
          user_id: 'usr-audit-expert',
          name: 'Chuyên gia An ninh Mạng',
          email: 'audit.security@pulsar.dev',
          role: 'reviewer',
        },
        businessUser
      );

      expect(res.success).toBe(true);
      expect(res.member?.role).toBe('reviewer');
    });

    it('SP7-MEM-2: Standard Creator member cannot add other members (403)', async () => {
      const res = await collaborationService.addMember(
        'ws-demo-001',
        {
          user_id: 'usr-friend',
          name: 'Bạn Của Creator',
          email: 'friend@pulsar.dev',
          role: 'member',
        },
        winningCreatorUser
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('TRUY CẬP BỊ TỪ CHỐI (403)');
    });

    it('SP7-MEM-3: Cannot remove workspace Owner', async () => {
      const res = await collaborationService.removeMember('ws-demo-001', businessUser.id, businessUser);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Không thể xoá chủ sở hữu (Owner)');
    });
  });

  describe('5. Tasks Management & Progress Tracking', () => {
    it('SP7-TSK-1: Member can create task and update status progression', async () => {
      const res = await collaborationService.createTask(
        'ws-demo-001',
        {
          title: 'Viết unit tests cho Route Optimizer',
          description: 'Đảm bảo test coverage >= 90%',
          priority: 'high',
          due_date: '2026-03-18T00:00:00Z',
        },
        winningCreatorUser
      );

      expect(res.success).toBe(true);
      expect(res.task?.status).toBe('todo');

      const taskId = res.task!.id;

      // Update status to in_progress
      const updateRes = collaborationService.updateTaskStatus(
        'ws-demo-001',
        taskId,
        'in_progress',
        winningCreatorUser
      );
      expect(updateRes.success).toBe(true);
      expect(updateRes.task?.status).toBe('in_progress');

      // Update status to done
      const finishRes = collaborationService.updateTaskStatus(
        'ws-demo-001',
        taskId,
        'done',
        winningCreatorUser
      );
      expect(finishRes.success).toBe(true);
      expect(finishRes.task?.status).toBe('done');
    });
  });

  describe('6. Milestones & Deliverables Approval Lifecycle', () => {
    it('SP7-MLS-1: Creator submits deliverable and milestone advances to submitted', async () => {
      const submitRes = await collaborationService.submitDeliverable(
        'ws-demo-001',
        {
          milestone_id: 'ms-002',
          title: 'GNN Weights & Benchmark Report PDF',
          url: 'https://storage.pulsar.dev/benchmark_gnn.pdf',
          notes: 'Đã hoàn thành đo đạc hiệu năng với 500 nodes',
        },
        winningCreatorUser
      );

      expect(submitRes.success).toBe(true);
      expect(submitRes.milestone?.status).toBe('submitted');
      expect(submitRes.milestone?.deliverables.length).toBeGreaterThan(0);
    });

    it('SP7-MLS-2: Business owner or reviewer approves milestone and posts system announcement', () => {
      const approveRes = collaborationService.approveMilestone(
        'ws-demo-001',
        'ms-002',
        businessUser
      );

      expect(approveRes.success).toBe(true);
      expect(approveRes.milestone?.status).toBe('approved');

      // Verify chat notification posted
      const messages = collaborationService.getMessages('ws-demo-001', businessUser);
      const systemAnnouncement = messages.messages?.find(
        (m) => m.content.includes('đã chính thức được nghiệm thu')
      );
      expect(systemAnnouncement).toBeDefined();
    });

    it('SP7-MLS-3: Workspace activities audit trail logs actions chronologically', () => {
      const activities = collaborationService.getActivities('ws-demo-001', businessUser);
      expect(activities.length).toBeGreaterThan(0);
      expect(activities[0].created_at).toBeDefined();
    });
  });
});
