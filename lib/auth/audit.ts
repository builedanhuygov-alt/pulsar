import { createAdminClient } from '../supabase/admin';
import { auditLogPayloadSchema, type AuditLogPayload } from '../validation/audit.schema';

export async function recordAuditLog(payload: AuditLogPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const validated = auditLogPayloadSchema.parse(payload);

    // Privileged insertion via server-side service role client
    const adminSupabase = createAdminClient();

    const { error } = await (adminSupabase.from('audit_logs') as any).insert({
      actor_user_id: validated.actorUserId || null,
      action: validated.action,
      resource_type: validated.resourceType,
      resource_id: validated.resourceId || null,
      metadata: validated.metadata as any,
    });

    if (error) {
      console.error('[AUDIT LOG ERROR]', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[AUDIT LOG VALIDATION/EXECUTION ERROR]', err);
    return { success: false, error: err?.message || 'Unknown audit log error' };
  }
}
