import React from "react";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { getTeamUserAssignedProjects } from "@/lib/team-projects";
import { TeamLayoutClient } from "@/components/layout/TeamLayoutClient";

export default async function TeamRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const teamUser = await getAuthenticatedTeamUser();

  // If no team session (e.g. /login), render children directly without sidebar
  if (!teamUser) {
    return <>{children}</>;
  }

  // Fetch all distinct projects assigned to this team member
  const assignedProjects = await getTeamUserAssignedProjects(
    teamUser.id,
    teamUser.project_id
  );
  const defaultProjectName = assignedProjects[0]?.name || "Assigned Project";

  return (
    <TeamLayoutClient
      userName={teamUser.name}
      projectName={defaultProjectName}
      assignedProjects={assignedProjects}
    >
      {children}
    </TeamLayoutClient>
  );
}
