import { db } from '@/lib/db';
import { auditLogs, type AuditAction } from '@/lib/db/schema';
import { generateId } from '@/lib/utils/generate-id';

export interface AuditLogParams {
  clinicId: string;
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function auditLog(params: AuditLogParams): Promise<void> {
  await db.insert(auditLogs).values({
    id: generateId(),
    clinicId: params.clinicId,
    userId: params.userId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    details: params.details,
    ipAddress: params.ipAddress,
  });
}

// Fire-and-log variant: use ONLY for audit events where failure to log must not
// abort the user-facing action (login, logout). For sensitive CRUD the caller
// should await `auditLog` directly and surface errors.
export async function safeAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await auditLog(params);
  } catch (err) {
    console.error('[audit] Failed to record audit log', {
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      userId: params.userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
