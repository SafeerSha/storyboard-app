import { createAdminClient } from "./supabase/admin";

export interface AuditEvent {
  action: string;
  actorId: string;
  actorType: "super_admin" | "freelancer" | "team_user" | "client";
  actorName?: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
}

export async function logAudit(event: AuditEvent) {
  try {
    const admin = createAdminClient();
    // Ensure no password or token fields are ever persisted in audit logs
    const safeDetails = event.details ? { ...event.details } : {};
    delete safeDetails.password;
    delete safeDetails.password_hash;
    delete safeDetails.token;
    delete safeDetails.token_hash;

    await admin.from("audit_logs").insert({
      action: event.action,
      actor_id: event.actorId,
      actor_type: event.actorType,
      actor_name: event.actorName || null,
      target_type: event.targetType || null,
      target_id: event.targetId || null,
      details: safeDetails,
    });
  } catch (err) {
    // Audit log failures should not crash the main operation
    console.error("Audit logging error:", err);
  }
}
