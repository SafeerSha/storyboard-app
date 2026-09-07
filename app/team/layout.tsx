import React from "react";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamLayoutClient } from "@/components/layout/TeamLayoutClient";

export default async function TeamRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const teamUser = await getAuthenticatedTeamUser();

  // If no team session (e.g. /team/login), render children directly without sidebar
  if (!teamUser) {
    return <>{children}</>;
  }

  // Fetch assigned project name
  const admin = createAdminClient();
  let projectName = "Assigned Project";

  if (teamUser.project_id) {
    const { data: project } = await admin
      .from("projects")
      .select("name")
      .eq("id", teamUser.project_id)
      .maybeSingle();
    if (project?.name) projectName = project.name;
  } else {
    const { data: membership } = await admin
      .from("project_team_members")
      .select("project_id")
      .eq("team_user_id", teamUser.id)
      .limit(1)
      .maybeSingle();
    if (membership?.project_id) {
      const { data: p } = await admin
        .from("projects")
        .select("name")
        .eq("id", membership.project_id)
        .maybeSingle();
      if (p?.name) projectName = p.name;
    }
  }

  return (
    <TeamLayoutClient userName={teamUser.name} projectName={projectName}>
      {children}
    </TeamLayoutClient>
  );
}
