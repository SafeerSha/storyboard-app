import React from "react";
import { getAuthenticatedClient } from "@/lib/client-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientLayoutClient } from "@/components/layout/ClientLayoutClient";

export default async function ClientRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = await getAuthenticatedClient({ allowPendingPasswordChange: true });

  // If unauthenticated or password setup pending (e.g. /client/login or /client/set-password),
  // render children directly without sidebar
  if (!client || !client.is_password_changed) {
    return <>{children}</>;
  }

  // Fetch assigned project name
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("name, description")
    .eq("id", client.project_id)
    .maybeSingle();

  const projectName = project?.name || "Assigned Project";

  return (
    <ClientLayoutClient clientName={client.name} projectName={projectName}>
      {children}
    </ClientLayoutClient>
  );
}
