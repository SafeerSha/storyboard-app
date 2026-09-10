import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedClient } from "@/lib/client-session";
import { ClientEstimateView } from "./ClientEstimateView";

export const dynamic = "force-dynamic";

export default async function ClientEstimatePage() {
  const client = await getAuthenticatedClient({ allowPendingPasswordChange: true });
  if (!client) redirect("/login");
  if (!client.is_password_changed) redirect("/client/set-password");

  return <ClientEstimateView clientName={client.name} />;
}
