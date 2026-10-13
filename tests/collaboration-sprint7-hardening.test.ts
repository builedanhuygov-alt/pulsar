import { describe, it, expect } from 'vitest';
import { collaborationService } from '../lib/collaboration/collaborationService';
import { notificationService } from '../lib/collaboration/notificationService';
import { challengeService } from '../lib/challenge/challengeService';
import { submissionService } from '../lib/submission/submissionService';
import type { PulsarUser } from '../types/auth.types';

function makeUser(overrides: Partial<PulsarUser> & { id: string; email: string; role: PulsarUser['role'] }): PulsarUser {
  return {
    organizations: [],
    profile: {
      id: overrides.id,
      full_name: overrides.email,
      headline: '',
      avatar_url: null,
      skills: [],
      bio: '',
      reputation_score: 0,
      role: overrides.role,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    } as any,
    ...overrides,
  } as PulsarUser;
}

const bizOwner: PulsarUser = makeUser({
  id: 'usr-biz-001',
  email: 'business@techcorp.dev',
  role: 'business',
  organizations: [
    {
      membership_role: 'owner',
      organization: {
        id: 'org-tech-01',
        name: 'Việt Nam Tech Hub',
        slug: 'vietnam-tech-hub',
        type: 'enterprise',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      } as any,
    },
  ],
});

const creatorMember: PulsarUser = makeUser({ id: 'usr-creator-001', email: 'creator.developer@pulsar.dev', role: 'creator' });
const outsider: PulsarUser = makeUser({ id: 'usr-outsider-900', email: 'outsider900@pulsar.dev', role: 'creator' });
const crossOrgUser: PulsarUser = makeUser({
  id: 'usr-cross-org-1',
  email: 'cross@other.dev',
  role: 'business',
  organizations: [
    {
      membership_role: 'owner',
      organization: { id: 'org-other-99', name: 'Other Org', slug: 'other-org', type: 'enterprise', created_at: '', updated_at: '' } as any,
    },
  ],
});
const sysAdmin: PulsarUser = makeUser({ id: 'usr-admin-001', email: 'admin@pulsar.dev', role: 'admin' });

describe('PULSAR Sprint 7 hardening — spec §9 security & workflow guards', () => {
  it('H1: outsider cannot read workspace messages (403)', () => {
    const res = collaborationService.getMessages('ws-demo-001', outsider);
    expect(res.success).toBe(false);
    expect(res.error).toContain('403');
  });

  it('H2: cross-org user blocked by IDOR (no membership, no admin)', () => {
    const res = collaborationService.getWorkspace('ws-demo-001', crossOrgUser);
    expect(res.success).toBe(false);
    expect(res.error).toContain('403');
    const list = collaborationService.listWorkspacesForUser(crossOrgUser);
    expect(list.some((w) => w.id === 'ws-demo-001')).toBe(false);
  });

  it('H3: non-member cannot create task or submit deliverable (403)', async () => {
    const t = await collaborationService.createTask('ws-demo-001', { title: 'Hacker task attempt' }, outsider);
    expect(t.success).toBe(false);
    expect(t.error).toContain('403');
    const d = await collaborationService.submitDeliverable(
      'ws-demo-001',
      { milestone_id: 'ms-002', title: 'Hacker deliverable', url: 'https://evil.dev/x' },
      outsider
    );
    expect(d.success).toBe(false);
    expect(d.error).toContain('403');
  });

  it('H4: revoked member instantly loses access', async () => {
    const tempId = `usr-temp-${Date.now()}`;
    const temp = makeUser({ id: tempId, email: `${tempId}@pulsar.dev`, role: 'creator' });
    const add = await collaborationService.addMember(
      'ws-demo-001',
      { user_id: tempId, name: 'Temp Member', email: `${tempId}@pulsar.dev`, role: 'member' },
      bizOwner
    );
    expect(add.success).toBe(true);
    expect(collaborationService.getMessages('ws-demo-001', temp).success).toBe(true);
    const rm = await collaborationService.removeMember('ws-demo-001', tempId, bizOwner);
    expect(rm.success).toBe(true);
    const after = collaborationService.getMessages('ws-demo-001', temp);
    expect(after.success).toBe(false);
    expect(after.error).toContain('403');
  });

  it('H5: plain member cannot approve milestone; only owner/reviewer/admin', async () => {
    const plainId = `usr-plain-${Date.now()}`;
    const plain = makeUser({ id: plainId, email: `${plainId}@pulsar.dev`, role: 'creator' });
    await collaborationService.addMember(
      'ws-demo-001',
      { user_id: plainId, name: 'Plain Member', email: `${plainId}@pulsar.dev`, role: 'member' },
      bizOwner
    );
    const denied = collaborationService.approveMilestone('ws-demo-001', 'ms-002', plain);
    expect(denied.success).toBe(false);
    expect(denied.error).toContain('403');
    // Reviewer path still works (owner approves a fresh milestone instead of mutating seed twice)
    const ms = await collaborationService.createMilestone('ws-demo-001', { title: `MS H5 ${Date.now()}`, order_index: 90 }, bizOwner);
    expect(ms.success).toBe(true);
    const ok = collaborationService.approveMilestone('ws-demo-001', ms.milestone!.id, bizOwner);
    expect(ok.success).toBe(true);
    expect(ok.milestone?.status).toBe('completed');
  });

  it('H6: creator cannot self-accept own deliverable; reviewer can', async () => {
    const wsRes = await collaborationService.createWorkspace(
      { challenge_id: 'ch-001', name: `WS H6 ${Date.now()}` },
      bizOwner
    );
    expect(wsRes.success).toBe(true);
    const wsId = wsRes.workspace!.id;
    const ms = await collaborationService.createMilestone(wsId, { title: 'MS self-accept', order_index: 1 }, bizOwner);
    expect(ms.success).toBe(true);
    // Creator member submits (winning creator auto-enlisted)
    const sub = await collaborationService.submitDeliverable(
      wsId,
      { milestone_id: ms.milestone!.id, title: 'Creator work v1', url: 'https://repo.dev/work' },
      creatorMember
    );
    expect(sub.success).toBe(true);
    const delId = sub.milestone!.deliverables[sub.milestone!.deliverables.length - 1].id;
    // Creator lacks reviewer rights → denied (role gate, also 403).
    const creatorAttempt = collaborationService.reviewDeliverable(wsId, { deliverable_id: delId, decision: 'accepted' }, creatorMember);
    expect(creatorAttempt.success).toBe(false);
    expect(creatorAttempt.error).toContain('403');
    // Explicit self-accept guard: owner submits their own deliverable, then cannot accept it.
    const ownSub = await collaborationService.submitDeliverable(
      wsId,
      { milestone_id: ms.milestone!.id, title: 'Owner work v1', url: 'https://repo.dev/owner-work' },
      bizOwner
    );
    expect(ownSub.success).toBe(true);
    const ownDelId = ownSub.milestone!.deliverables[ownSub.milestone!.deliverables.length - 1].id;
    const selfAccept = collaborationService.reviewDeliverable(wsId, { deliverable_id: ownDelId, decision: 'accepted' }, bizOwner);
    expect(selfAccept.success).toBe(false);
    expect(selfAccept.error).toMatch(/tự nghiệm thu/i);
    // Reviewer/owner accepts the CREATOR's deliverable → success.
    const reviewerAccept = collaborationService.reviewDeliverable(wsId, { deliverable_id: delId, decision: 'accepted', feedback: 'Tốt.' }, bizOwner);
    expect(reviewerAccept.success).toBe(true);
  });

  it('H7: notifications strictly isolated per recipient', () => {
    notificationService._reset();
    notificationService.create({
      recipient_id: creatorMember.id,
      type: 'task_assigned',
      entity_type: 'task',
      entity_id: 'task-001',
      title: 'Việc của creator',
      body: 'Tóm tắt chung, không bí mật.',
    });
    const mine = notificationService.listForRecipient(creatorMember);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((n) => n.recipient_id === creatorMember.id)).toBe(true);
    const others = notificationService.listForRecipient(outsider);
    expect(others.some((n) => n.recipient_id === creatorMember.id)).toBe(false);
    const mark = notificationService.markRead(mine[0].id, outsider);
    expect(mark.success).toBe(false);
  });

  it('H8: deadline + status validation rejects bad input', async () => {
    const badDate = await collaborationService.createTask('ws-demo-001', { title: 'Bad deadline task', due_date: 'not-a-date' }, creatorMember);
    expect(badDate.success).toBe(false);
    const ok = await collaborationService.createTask('ws-demo-001', { title: `Valid ${Date.now()} task` }, creatorMember);
    expect(ok.success).toBe(true);
    const badStatus = collaborationService.updateTaskStatus(wsDemoId(), ok.task!.id, 'flying' as any, creatorMember);
    expect(badStatus.success).toBe(false);
    function wsDemoId() {
      return 'ws-demo-001';
    }
  });

  it('H9: retry with same idempotency key creates no duplicates', async () => {
    const key = `idem-${Date.now()}`;
    const first = await collaborationService.sendMessage('ws-demo-001', { content: 'Idempotency probe', idempotency_key: key }, creatorMember);
    expect(first.success).toBe(true);
    const second = await collaborationService.sendMessage('ws-demo-001', { content: 'Idempotency probe', idempotency_key: key }, creatorMember);
    expect(second.success).toBe(true);
    expect(second.deduplicated).toBe(true);
    expect(second.message?.id).toBe(first.message?.id);
    const history = collaborationService.getMessages('ws-demo-001', creatorMember, { page: 1, limit: 100 });
    const matches = (history.messages ?? []).filter((m) => m.idempotency_key === key);
    expect(matches.length).toBe(1);
  });

  it('H10: SP1–SP6 workflows unbroken (challenge/submission/outcome smoke)', async () => {
    const ch = (challengeService as any).getChallengeById('ch-demo-001');
    expect(ch.success).toBe(true);
    expect(ch.challenge).toBeDefined();
    const subs = submissionService.getCreatorSubmissions('usr-creator-001');
    expect(Array.isArray(subs)).toBe(true);
    if (subs.length > 0) {
      const mine = subs[0];
      // Creator self-accept must stay blocked in SP3 workflow (owner-only decision).
      const badTransition = submissionService.transitionStatus(mine.id, 'accepted', {
        userId: mine.submitted_by,
        userRole: 'creator',
        isOwner: true,
        isOrgMember: false,
      });
      expect(badTransition.success).toBe(false);
    }
    expect(sysAdmin.role).toBe('admin');
  });
});
