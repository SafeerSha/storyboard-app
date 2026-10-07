import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import type { ProjectInboxMemberRole, ProjectInboxUserType } from "./types";

export interface InboxActor {
  id: string;
  name: string;
  emailOrUsername: string;
  type: ProjectInboxUserType;
  isSuperAdmin: boolean;
}

export interface InboxAccessVerification {
  hasAccess: boolean;
  role: ProjectInboxMemberRole | null;
  isOwner: boolean;
  canManageCollaborators: boolean;
  canEditItem: boolean;
  canDeleteItem: boolean;
}

/**
 * Resolve the authenticated user from either Supabase Auth (freelancer/super_admin)
 * or REQly team session cookie (team_user).
 * NEVER trust client-supplied user identity.
 */
export async function getAuthenticatedInboxActor(): Promise<InboxActor | null> {
  const cookieStore = await cookies();

  // 1. Try Supabase Auth (Freelancers & Super Admins)
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const adminClient = createAdminClient();
      let { data: profile } = await adminClient
        .from("freelancer_profiles")
        .select("id, name, email, role, status")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile) {
        const defaultName =
          user.user_metadata?.name ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "Freelancer";

        const { data: createdProfile } = await adminClient
          .from("freelancer_profiles")
          .insert({
            id: user.id,
            email: user.email || "",
            name: defaultName,
            role: "freelancer",
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .select("id, name, email, role, status")
          .maybeSingle();

        profile = createdProfile || {
          id: user.id,
          name: defaultName,
          email: user.email || "",
          role: "freelancer",
          status: "active",
        };
      }

      if (profile && profile.status !== "disabled") {
        return {
          id: user.id,
          name: profile.name || user.email?.split("@")[0] || "Freelancer",
          emailOrUsername: profile.email || user.email || "",
          type: "freelancer",
          isSuperAdmin: profile.role === "super_admin",
        };
      }
    }
  } catch (err) {
    // Continue to check team session
  }

  // 2. Try Team Session (Team Users)
  try {
    const teamUser = await getAuthenticatedTeamUser();
    if (teamUser && teamUser.status === "active") {
      return {
        id: teamUser.id,
        name: teamUser.name,
        emailOrUsername: teamUser.username,
        type: "team_user",
        isSuperAdmin: false,
      };
    }
  } catch (err) {
    // Both failed
  }

  return null;
}

/**
 * Verifies whether the authenticated actor has item-level access to a given inbox item.
 * Owner and Super Admin get full management rights.
 * Explicit collaborators get collaborative participation rights.
 */
export async function verifyInboxItemAccess(
  actor: InboxActor,
  inboxItemId: string
): Promise<InboxAccessVerification> {
  const adminClient = createAdminClient();

  // Fetch the inbox item owner
  const { data: item, error: itemError } = await adminClient
    .from("project_inbox_items")
    .select("id, owner_id")
    .eq("id", inboxItemId)
    .maybeSingle();

  if (itemError || !item) {
    return {
      hasAccess: false,
      role: null,
      isOwner: false,
      canManageCollaborators: false,
      canEditItem: false,
      canDeleteItem: false,
    };
  }

  // Item Owner (the creator)
  if (item.owner_id === actor.id) {
    return {
      hasAccess: true,
      role: "owner",
      isOwner: true,
      canManageCollaborators: true,
      canEditItem: true,
      canDeleteItem: true,
    };
  }

  // Check explicit item-level collaborator in project_inbox_members
  try {
    const { data: member } = await adminClient
      .from("project_inbox_members")
      .select("id, role")
      .eq("inbox_item_id", inboxItemId)
      .eq("user_id", actor.id)
      .maybeSingle();

    if (member) {
      const isOwnerRole = member.role === "owner";
      return {
        hasAccess: true,
        role: member.role,
        isOwner: isOwnerRole,
        canManageCollaborators: isOwnerRole,
        canEditItem: isOwnerRole,
        canDeleteItem: isOwnerRole,
      };
    }
  } catch {
    // In case project_inbox_members is not yet migrated, only owner has access
  }

  return {
    hasAccess: false,
    role: null,
    isOwner: false,
    canManageCollaborators: false,
    canEditItem: false,
    canDeleteItem: false,
  };
}
