import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: notifications, error } = await admin
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) {
      // If table doesn't exist yet, return empty list gracefully
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        return NextResponse.json({ notifications: [], unreadCount: 0 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const unreadCount = (notifications || []).filter((n) => !n.is_read).length;

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount,
    });
  } catch (err: any) {
    console.error("GET /api/notifications error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const admin = createAdminClient();

    if (body.markAllRead) {
      await admin
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id);
      return NextResponse.json({ success: true });
    }

    if (body.notificationId) {
      await admin
        .from("notifications")
        .update({ is_read: true })
        .eq("id", body.notificationId)
        .eq("user_id", user.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("PATCH /api/notifications error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
