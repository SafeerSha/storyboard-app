import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { getStoryFeedback, createFeedbackThread } from "@/lib/feedback-store";
import type { FeedbackAuthorType, FeedbackSectionType } from "@/lib/types";

const postSchema = z.object({
  sectionType: z.enum(["acceptance_criteria", "assumption", "clarification", "general"]),
  itemId: z.string().nullable().optional(),
  itemText: z.string().max(3000).nullable().optional(),
  body: z.string().min(1).max(5000),
});

async function resolveSession(storyId: string) {
  const admin = createAdminClient();
  const { data: story } = await admin
    .from("stories")
    .select("id, project_id, status")
    .eq("id", storyId)
    .maybeSingle();

  if (!story) return { error: "Story not found", status: 404 };

  // 1. Try Team User session
  const teamUser = await getAuthenticatedTeamUser();
  if (teamUser && teamUser.project_id === story.project_id) {
    return {
      story,
      authorType: "team_user" as FeedbackAuthorType,
      authorId: teamUser.id,
      authorName: teamUser.name || "Team Member",
    };
  }

  // 2. Try Freelancer / Super Admin session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "super_admin") {
      return {
        story,
        authorType: "freelancer" as FeedbackAuthorType,
        authorId: user.id,
        authorName: "Super Admin",
      };
    }

    const { data: project } = await admin
      .from("projects")
      .select("id, owner_id")
      .eq("id", story.project_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (project) {
      return {
        story,
        authorType: "freelancer" as FeedbackAuthorType,
        authorId: user.id,
        authorName: "Freelancer",
      };
    }
  }

  // 3. Try Client session
  const client = await getAuthenticatedClient();
  if (client && client.project_id === story.project_id) {
    return {
      story,
      authorType: "client" as FeedbackAuthorType,
      authorId: client.id,
      authorName: client.name || "Client",
    };
  }

  return { error: "Unauthorized", status: 401 };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await resolveSession(id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const threads = await getStoryFeedback(id);
    return NextResponse.json({ threads });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load feedback" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await resolveSession(id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const json = await req.json();
    const input = postSchema.parse(json);

    const thread = await createFeedbackThread({
      storyId: id,
      sectionType: input.sectionType as FeedbackSectionType,
      itemId: input.itemId || null,
      itemText: input.itemText || null,
      body: input.body,
      authorType: auth.authorType,
      authorId: auth.authorId,
      authorName: auth.authorName,
    });

    // If client requested changes, update status
    if (auth.authorType === "client") {
      const admin = createAdminClient();
      await admin
        .from("stories")
        .update({
          status: "changes_requested",
          client_review_status: "changes_requested",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    } else if (auth.authorType === "team_user") {
      const admin = createAdminClient();
      await admin
        .from("stories")
        .update({
          team_review_status: "changes_requested",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }

    return NextResponse.json({ ok: true, thread });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create feedback" },
      { status: 400 }
    );
  }
}
