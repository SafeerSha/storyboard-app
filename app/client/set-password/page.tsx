import { redirect } from "next/navigation";
import { getAuthenticatedClient } from "@/lib/client-session";
import { SetPasswordForm } from "./SetPasswordForm";
import { StoryBoardLogoMark } from "@/components/brand/StoryBoardLogo";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  // Server-side guard: allow session with pending password change
  const client = await getAuthenticatedClient({ allowPendingPasswordChange: true });

  // 1. If not authenticated, bounce to login
  if (!client) {
    redirect("/client/login");
  }

  // 2. If password has already been set, forbid accessing onboarding; bounce to client portal
  if (client.is_password_changed) {
    redirect("/client");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-8 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 sm:mb-8 text-center">
          <div className="flex justify-center mb-4">
            <StoryBoardLogoMark size={44} />
          </div>
          <h1 className="mt-4 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Create a new password
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-zinc-500">
            For security, please create a new password before continuing.
          </p>
        </div>

        <SetPasswordForm clientName={client.name} />
      </div>
    </main>
  );
}
