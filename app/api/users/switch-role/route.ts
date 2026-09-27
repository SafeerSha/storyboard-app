import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySuperAdmin } from "@/lib/super-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Only Super Admins can switch user roles.", { status: 403 });
  }

  const adminClient = createAdminClient();

  try {
    const body = await req.json();
    const {
      userId,
      currentType,
      targetType,
      name,
      email,
      username,
      password,
      projectIds,
      status,
    } = body;

    if (!userId || !currentType || !targetType) {
      return NextResponse.json({ error: "Missing required role switch parameters." }, { status: 400 });
    }

    if (admin.id === userId && targetType !== "super_admin") {
      return NextResponse.json({ error: "You cannot change or demote your own Super Admin account." }, { status: 400 });
    }

    // =========================================================================
    // CASE 1: Freelancer / Super Admin -> Team Member
    // =========================================================================
    if ((currentType === "freelancer" || currentType === "super_admin") && targetType === "team_user") {
      const cleanUsername = String(username || "").trim().toLowerCase();
      if (!cleanUsername || cleanUsername.length < 3) {
        return NextResponse.json({ error: "A valid username of at least 3 characters is required for Team Member." }, { status: 400 });
      }

      const assignedProjectIds: string[] = Array.isArray(projectIds)
        ? Array.from(new Set(projectIds.map(String).map((s: string) => s.trim()).filter(Boolean)))
        : [];

      if (assignedProjectIds.length === 0) {
        return NextResponse.json({ error: "Please select at least one project for the team member." }, { status: 400 });
      }

      const finalPassword = String(password || "").trim();
      if (!finalPassword || finalPassword.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
      }

      const passwordHash = await bcrypt.hash(finalPassword, 10);
      const cleanName = String(name || "").trim() || cleanUsername;

      // 1. Check if a team user with this username already exists (merge/link scenario)
      const { data: existingTeamUser } = await adminClient
        .from("team_users")
        .select("id, username")
        .eq("username", cleanUsername)
        .maybeSingle();

      let targetTeamUserId = existingTeamUser?.id;

      if (existingTeamUser) {
        // Update existing team user
        await adminClient
          .from("team_users")
          .update({
            name: cleanName,
            password_hash: passwordHash,
            status: status || "active",
            project_id: assignedProjectIds[0] || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingTeamUser.id);
      } else {
        // Create new team user
        const { data: newTeamUser, error: createTuError } = await adminClient
          .from("team_users")
          .insert({
            name: cleanName,
            username: cleanUsername,
            password_hash: passwordHash,
            role: "team_member",
            status: status || "active",
            project_id: assignedProjectIds[0] || null,
            owner_id: admin.id,
          })
          .select()
          .single();

        if (createTuError) throw createTuError;
        targetTeamUserId = newTeamUser.id;
      }

      // 2. Sync project memberships
      if (targetTeamUserId && assignedProjectIds.length > 0) {
        // Clear old memberships for this team user
        await adminClient
          .from("project_team_members")
          .delete()
          .eq("team_user_id", targetTeamUserId);

        const memberRows = assignedProjectIds.map((pId) => ({
          project_id: pId,
          team_user_id: targetTeamUserId!,
        }));
        await adminClient.from("project_team_members").insert(memberRows);
      }

      // 3. Reclaim any projects owned by this freelancer back to super admin
      await adminClient
        .from("projects")
        .update({ owner_id: admin.id })
        .eq("owner_id", userId);

      // 4. Clean up old freelancer profile & auth user to eliminate duplicate
      await adminClient.from("freelancer_profiles").delete().eq("id", userId);
      try {
        await adminClient.auth.admin.deleteUser(userId);
      } catch (authDelErr: any) {
        console.warn("Could not delete auth user during role switch:", authDelErr.message);
      }

      return NextResponse.json({
        success: true,
        message: `${cleanName} is now a Team Member.`,
        credentials: {
          name: cleanName,
          identifier: `@${cleanUsername}`,
          userType: "Team Member",
          password: finalPassword,
        },
      });
    }

    // =========================================================================
    // CASE 2: Team Member -> Freelancer / Super Admin
    // =========================================================================
    if (currentType === "team_user" && (targetType === "freelancer" || targetType === "super_admin")) {
      const cleanEmail = String(email || "").trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes("@")) {
        return NextResponse.json({ error: "A valid email address is required for a Freelancer / Admin account." }, { status: 400 });
      }

      const finalPassword = String(password || "").trim();
      if (!finalPassword || finalPassword.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
      }

      const cleanName = String(name || "").trim() || cleanEmail.split("@")[0];
      const targetRole = targetType === "super_admin" ? "super_admin" : "freelancer";

      // 1. Check if auth user already exists for this email
      let authUserId: string | null = null;

      // Check freelancer_profiles first
      const { data: existingProfile } = await adminClient
        .from("freelancer_profiles")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (existingProfile?.id) {
        const profileId = String(existingProfile.id);
        authUserId = profileId;
        // Update password and profile
        await adminClient.auth.admin.updateUserById(profileId, { password: finalPassword });
        await adminClient
          .from("freelancer_profiles")
          .update({
            name: cleanName,
            role: targetRole,
            status: status || "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", profileId);
      } else {
        // Create new auth user
        const { data: newAuthUser, error: authError } = await adminClient.auth.admin.createUser({
          email: cleanEmail,
          password: finalPassword,
          email_confirm: true,
        });

        if (authError) {
          // If auth user already exists without profile, find it
          if (authError.message.includes("already registered")) {
            const { data: listUsers } = await adminClient.auth.admin.listUsers();
            const matched = listUsers?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
            if (matched?.id) {
              const matchedId = String(matched.id);
              authUserId = matchedId;
              await adminClient.auth.admin.updateUserById(matchedId, { password: finalPassword });
            } else {
              throw authError;
            }
          } else {
            throw authError;
          }
        } else if (newAuthUser?.user?.id) {
          authUserId = String(newAuthUser.user.id);
        }

        // Insert freelancer_profiles
        if (authUserId) {
          await adminClient.from("freelancer_profiles").upsert({
            id: authUserId,
            email: cleanEmail,
            name: cleanName,
            role: targetRole,
            status: status || "active",
            updated_at: new Date().toISOString(),
          });
        }
      }

      if (!authUserId) {
        return NextResponse.json({ error: "Failed to create or link authentication account." }, { status: 500 });
      }

      // 2. Clean up old team_user record and memberships to avoid duplication
      await adminClient.from("project_team_members").delete().eq("team_user_id", userId);
      await adminClient.from("team_users").delete().eq("id", userId);

      // 3. Map projects to this freelancer if provided
      if (authUserId && Array.isArray(projectIds) && projectIds.length > 0) {
        const cleanProjectIds = Array.from(new Set(projectIds.map(String).map((s: string) => s.trim()).filter(Boolean)));
        if (cleanProjectIds.length > 0) {
          await adminClient
            .from("projects")
            .update({ owner_id: authUserId })
            .in("id", cleanProjectIds);
        }
      }

      return NextResponse.json({
        success: true,
        message: `${cleanName} is now a ${targetRole === "super_admin" ? "Super Admin" : "Freelancer"}.`,
        credentials: {
          name: cleanName,
          identifier: cleanEmail,
          userType: targetRole === "super_admin" ? "Super Admin" : "Freelancer",
          password: finalPassword,
        },
      });
    }

    // =========================================================================
    // CASE 3: Freelancer <-> Super Admin (Role toggle)
    // =========================================================================
    if (
      (currentType === "freelancer" && targetType === "super_admin") ||
      (currentType === "super_admin" && targetType === "freelancer")
    ) {
      const { error: updateError } = await adminClient
        .from("freelancer_profiles")
        .update({
          role: targetType,
          name: name ? String(name).trim() : undefined,
          status: status || "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        message: `Account role updated to ${targetType === "super_admin" ? "Super Admin" : "Freelancer"}.`,
      });
    }

    return NextResponse.json({ error: "Unsupported role switch conversion." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to switch user role." }, { status: 500 });
  }
}
