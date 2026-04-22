import { and, count, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLogs, users, type AuditAction } from '@/lib/db/schema';

export interface AuditLogFilters {
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  action?: string;
  resourceType?: string;
}

export interface AuditLogItem {
  id: string;
  createdAt: Date;
  userId: string;
  userFullName: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId: string | null;
  details: unknown;
  ipAddress: string | null;
}

export interface AuditLogsPage {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getAuditLogs(
  clinicId: string,
  timezone: string,
  filters: AuditLogFilters = {},
  page = 1,
  limit = 25,
): Promise<AuditLogsPage> {
  const offset = (page - 1) * limit;

  const conditions = [eq(auditLogs.clinicId, clinicId)];

  if (filters.dateFrom) {
    conditions.push(
      sql`(${auditLogs.createdAt} AT TIME ZONE ${timezone})::date >= ${filters.dateFrom}::date`,
    );
  }
  if (filters.dateTo) {
    conditions.push(
      sql`(${auditLogs.createdAt} AT TIME ZONE ${timezone})::date <= ${filters.dateTo}::date`,
    );
  }
  if (filters.userId) {
    conditions.push(eq(auditLogs.userId, filters.userId));
  }
  if (filters.action) {
    conditions.push(eq(auditLogs.action, filters.action as AuditAction));
  }
  if (filters.resourceType) {
    conditions.push(eq(auditLogs.resourceType, filters.resourceType));
  }

  const where = and(...conditions);

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        createdAt: auditLogs.createdAt,
        userId: auditLogs.userId,
        userFullName: users.fullName,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),

    db.select({ value: count() }).from(auditLogs).where(where),
  ]);

  return {
    items: rows as AuditLogItem[],
    total: Number(total),
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(Number(total) / limit)),
  };
}

export async function getClinicUsersForFilter(
  clinicId: string,
): Promise<{ id: string; fullName: string }[]> {
  return db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(eq(users.clinicId, clinicId))
    .orderBy(users.fullName);
}
