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
  const { data: project } = await admin
    .from("projects")
    .select("name")
    .eq("id", teamUser.project_id)
    .maybeSingle();

  const projectName = project?.name || "Assigned Project";

  return (
    <TeamLayoutClient userName={teamUser.name} projectName={projectName}>
      {children}
    </TeamLayoutClient>
  );
}
