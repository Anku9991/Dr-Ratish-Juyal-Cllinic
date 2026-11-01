import "server-only";
import { supabaseAdmin } from "./supabase/admin";

/**
 * Append-only audit trail. Metadata must never contain passwords, tokens, or clinical content:
 * record WHO did WHAT to WHICH entity, not the medical details.
 */
export async function audit(actorId: string | null, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}): Promise<void> {
  const { error } = await supabaseAdmin().rpc("write_audit", {
    p_actor: actorId,
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_metadata: metadata,
  });
  if (error) console.error("Audit write failed:", error.code ?? "unknown");
}
