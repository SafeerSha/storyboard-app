import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAnyFreelancer, verifySuperAdmin } from "@/lib/super-admin";
import type { UnifiedUser, UserType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await verifyAnyFreelancer();
  if (!actor) {
    return new NextResponse("Unauthorized. Please log in.", { status: 401 });
  }

  const adminClient = createAdminClient();

  try {
    // 1. Fetch all projects for reference mapping
    const { data: allProjects } = await adminClient
      .from("projects")
      .select("id, name, owner_id")
      .order("name", { ascending: true });

    const projectsList = allProjects || [];
    const projectMap = new Map<string, { id: string; name: string }>(
      projectsList.map((p) => [p.id, { id: p.id, name: p.name }])
    );

    // Projects owned by freelancer map: owner_id -> array of { id, name }
    const ownedProjectsByFreelancer: Record<string, Array<{ id: string; name: string }>> = {};
    projectsList.forEach((p) => {
      if (p.owner_id) {
        if (!ownedProjectsByFreelancer[p.owner_id]) {
          ownedProjectsByFreelancer[p.owner_id] = [];
        }
        ownedProjectsByFreelancer[p.owner_id].push({ id: p.id, name: p.name });
      }
    });

    const unifiedUsers: UnifiedUser[] = [];

    if (actor.isSuperAdmin) {
      // ==========================================
      // A. Super Admin: Load all user types
      // ==========================================

      // 1. Freelancers & Super Admins (from freelancer_profiles)
      const { data: freelancerProfiles, error: fpError } = await adminClient
        .from("freelancer_profiles")
        .select("id, name, email, role, status, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (fpError) throw fpError;

      (freelancerProfiles || []).forEach((fp) => {
        const isSuper = fp.role === "super_admin";
        const owned = ownedProjectsByFreelancer[fp.id] || [];
        const uniqueProjects = Array.from(new Map(owned.map((p) => [p.id, p])).values());

        unifiedUsers.push({
          id: fp.id,
          userType: isSuper ? "super_admin" : "freelancer",
          name: fp.name || fp.email?.split("@")[0] || (isSuper ? "Super Admin" : "Freelancer"),
          email: fp.email,
          username: null,
          loginId: null,
          role: fp.role,
          roleDisplay: isSuper ? "Super Admin" : "Freelancer",
          status: (fp.status as "active" | "disabled") || "active",
          created_at: fp.created_at,
          updated_at: fp.updated_at,
          projects: uniqueProjects,
          project_ids: uniqueProjects.map((p) => p.id),
          owner_id: fp.id,
          rawRecord: fp,
        });
      });

      // 2. Team Members (from team_users + project_team_members)
      const { data: teamUsers, error: tuError } = await adminClient
        .from("team_users")
        .select("id, project_id, name, username, role, status, created_at, updated_at, owner_id")
        .order("created_at", { ascending: false });

      if (tuError) throw tuError;

      const tuIds = (teamUsers || []).map((u) => u.id);
      const teamUserProjectMap: Record<string, Array<{ id: string; name: string }>> = {};

      if (tuIds.length > 0) {
        const { data: memberships } = await adminClient
          .from("project_team_members")
          .select("team_user_id, project_id, projects(id, name)")
          .in("team_user_id", tuIds);

        (memberships || []).forEach((m: any) => {
          if (!teamUserProjectMap[m.team_user_id]) teamUserProjectMap[m.team_user_id] = [];
          if (m.projects && m.projects.id) {
            teamUserProjectMap[m.team_user_id].push({
              id: m.projects.id,
              name: m.projects.name,
            });
          }
        });
      }

      (teamUsers || []).forEach((tu) => {
        let assigned = teamUserProjectMap[tu.id] || [];
        if (assigned.length === 0 && tu.project_id && projectMap.has(tu.project_id)) {
          assigned = [projectMap.get(tu.project_id)!];
        }
        const uniqueAssigned = Array.from(new Map(assigned.map((p) => [p.id, p])).values());

        unifiedUsers.push({
          id: tu.id,
          userType: "team_user",
          name: tu.name,
          email: null,
          username: tu.username,
          loginId: null,
          role: tu.role || "team_member",
          roleDisplay: "Team Member",
          status: (tu.status as "active" | "disabled") || "active",
          created_at: tu.created_at,
          updated_at: tu.updated_at,
          projects: uniqueAssigned,
          project_ids: uniqueAssigned.map((p) => p.id),
          owner_id: tu.owner_id,
          rawRecord: tu,
        });
      });

      // 3. Clients (from clients table)
      const { data: clientUsers, error: cuError } = await adminClient
        .from("clients")
        .select("id, name, login_id, email, status, created_at, project_id, projects(id, name)")
        .order("created_at", { ascending: false });

      if (cuError && cuError.code !== "42P01") {
        // Log client fetch error gracefully if table exists
        console.error("Error loading clients:", cuError);
      }

      (clientUsers || []).forEach((cu: any) => {
        const clientProjs: Array<{ id: string; name: string }> = [];
        if (cu.projects && cu.projects.id) {
          clientProjs.push({ id: cu.projects.id, name: cu.projects.name });
        } else if (cu.project_id && projectMap.has(cu.project_id)) {
          clientProjs.push(projectMap.get(cu.project_id)!);
        }

        unifiedUsers.push({
          id: cu.id,
          userType: "client",
          name: cu.name,
          email: cu.email || null,
          username: null,
          loginId: cu.login_id || null,
          role: "client",
          roleDisplay: "Client",
          status: (cu.status as "active" | "disabled") || "active",
          created_at: cu.created_at,
          projects: clientProjs,
          project_ids: clientProjs.map((p) => p.id),
          owner_id: null,
          rawRecord: cu,
        });
      });
    } else {
      // ==========================================
      // B. Regular Freelancer: Load scoped team members
      // ==========================================
      const { data: teamUsers, error: tuError } = await adminClient
        .from("team_users")
        .select("id, project_id, name, username, role, status, created_at, updated_at, owner_id")
        .eq("owner_id", actor.id)
        .order("created_at", { ascending: false });

      if (tuError) throw tuError;

      const tuIds = (teamUsers || []).map((u) => u.id);
      const teamUserProjectMap: Record<string, Array<{ id: string; name: string }>> = {};

      if (tuIds.length > 0) {
        const { data: memberships } = await adminClient
          .from("project_team_members")
          .select("team_user_id, project_id, projects(id, name)")
          .in("team_user_id", tuIds);

        (memberships || []).forEach((m: any) => {
          if (!teamUserProjectMap[m.team_user_id]) teamUserProjectMap[m.team_user_id] = [];
          if (m.projects && m.projects.id) {
            teamUserProjectMap[m.team_user_id].push({
              id: m.projects.id,
              name: m.projects.name,
            });
          }
        });
      }

      (teamUsers || []).forEach((tu) => {
        let assigned = teamUserProjectMap[tu.id] || [];
        if (assigned.length === 0 && tu.project_id && projectMap.has(tu.project_id)) {
          assigned = [projectMap.get(tu.project_id)!];
        }
        const uniqueAssigned = Array.from(new Map(assigned.map((p) => [p.id, p])).values());

        unifiedUsers.push({
          id: tu.id,
          userType: "team_user",
          name: tu.name,
          email: null,
          username: tu.username,
          loginId: null,
          role: tu.role || "team_member",
          roleDisplay: "Team Member",
          status: (tu.status as "active" | "disabled") || "active",
          created_at: tu.created_at,
          updated_at: tu.updated_at,
          projects: uniqueAssigned,
          project_ids: uniqueAssigned.map((p) => p.id),
          owner_id: tu.owner_id,
          rawRecord: tu,
        });
      });
    }

    // Sort by creation date descending
    unifiedUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Calculate aggregated counts
    const counts = {
      total: unifiedUsers.length,
      super_admin: unifiedUsers.filter((u) => u.userType === "super_admin").length,
      freelancer: unifiedUsers.filter((u) => u.userType === "freelancer").length,
      team_user: unifiedUsers.filter((u) => u.userType === "team_user").length,
      client: unifiedUsers.filter((u) => u.userType === "client").length,
    };

    return NextResponse.json({
      users: unifiedUsers,
      counts,
      isSuperAdmin: actor.isSuperAdmin,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load users" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const actor = await verifyAnyFreelancer();
  if (!actor) {
    return new NextResponse("Unauthorized. Please log in.", { status: 401 });
  }

  try {
    const body = await req.json();
    const userType: UserType = body.userType || (body.username ? "team_user" : "freelancer");
    const adminClient = createAdminClient();

    // 1. Creating a Freelancer or Super Admin account
    if (userType === "freelancer" || userType === "super_admin") {
      if (!actor.isSuperAdmin) {
        return NextResponse.json(
          { error: "Only Super Admins can create Freelancer or Super Admin accounts." },
          { status: 403 }
        );
      }

      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const name = String(body.name || "").trim() || email.split("@")[0];
      const role = userType === "super_admin" || body.role === "super_admin" ? "super_admin" : "freelancer";

      if (!email || !password || password.length < 6) {
        return NextResponse.json(
          { error: "Valid email and a password of at least 6 characters are required." },
          { status: 400 }
        );
      }

      // 1a. Create Auth User
      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) throw authError;

      // 1b. Create Freelancer Profile
      const { data: profile, error: profileError } = await adminClient
        .from("freelancer_profiles")
        .insert({
          id: authUser.user.id,
          email,
          name,
          role,
          status: "active",
        })
        .select()
        .single();

      if (profileError) {
        await adminClient.auth.admin.deleteUser(authUser.user.id);
        throw profileError;
      }

      let assignedProjs: Array<{ id: string; name: string }> = [];
      const rawProjectIds = body.projectIds || (body.projectId ? [body.projectId] : []);
      const cleanProjectIds: string[] = Array.isArray(rawProjectIds)
        ? Array.from(new Set(rawProjectIds.map(String).map((s: string) => s.trim()).filter(Boolean)))
        : [];

      if (cleanProjectIds.length > 0) {
        await adminClient
          .from("projects")
          .update({ owner_id: profile.id })
          .in("id", cleanProjectIds);

        const { data: projsData } = await adminClient
          .from("projects")
          .select("id, name")
          .in("id", cleanProjectIds);
        assignedProjs = projsData || [];
      }

      const createdUser: UnifiedUser = {
        id: profile.id,
        userType: role === "super_admin" ? "super_admin" : "freelancer",
        name: profile.name,
        email: profile.email,
        username: null,
        loginId: null,
        role: profile.role,
        roleDisplay: role === "super_admin" ? "Super Admin" : "Freelancer",
        status: "active",
        created_at: profile.created_at,
        projects: assignedProjs,
        project_ids: cleanProjectIds,
        owner_id: profile.id,
        rawRecord: profile,
      };

      return NextResponse.json({ success: true, user: createdUser, userId: profile.id });
    }

    // 2. Creating a Team Member account
    if (userType === "team_user") {
      const name = String(body.name || "").trim();
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      const rawProjectIds = body.projectIds || (body.projectId ? [body.projectId] : []);
      const projectIds = Array.isArray(rawProjectIds)
        ? Array.from(new Set(rawProjectIds.map(String).map((s: string) => s.trim()).filter(Boolean)))
        : [];
      const status = body.status === "disabled" ? "disabled" : "active";

      if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
      if (!username || username.length < 3) {
        return NextResponse.json({ error: "Username must be at least 3 characters." }, { status: 400 });
      }
      if (!password || password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
      }

      // Check unique username
      const { data: existingUser } = await adminClient
        .from("team_users")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (existingUser) {
        return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const { data: newTeamUser, error: createError } = await adminClient
        .from("team_users")
        .insert({
          name,
          username,
          password_hash: passwordHash,
          role: "team_member",
          status,
          project_id: projectIds[0] || null,
          owner_id: actor.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Assign project memberships
      if (projectIds.length > 0) {
        const memberRows = projectIds.map((pId: string) => ({
          project_id: pId,
          team_user_id: newTeamUser.id,
        }));
        await adminClient.from("project_team_members").insert(memberRows);
      }

      // Fetch project names
      const { data: assignedProjectsData } = await adminClient
        .from("projects")
        .select("id, name")
        .in("id", projectIds);

      const assignedProjs = assignedProjectsData || [];

      const createdUser: UnifiedUser = {
        id: newTeamUser.id,
        userType: "team_user",
        name: newTeamUser.name,
        email: null,
        username: newTeamUser.username,
        loginId: null,
        role: "team_member",
        roleDisplay: "Team Member",
        status: newTeamUser.status,
        created_at: newTeamUser.created_at,
        projects: assignedProjs,
        project_ids: assignedProjs.map((p) => p.id),
        owner_id: newTeamUser.owner_id,
        rawRecord: newTeamUser,
      };

      return NextResponse.json({ success: true, user: createdUser });
    }

    return NextResponse.json({ error: "Unsupported user type" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create user" }, { status: 500 });
  }
}
