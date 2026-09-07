"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";

export function ClientSignOut() {
  async function handleSignOut() {
    try {
      await fetch("/api/client/logout", { method: "POST" });
    } catch {
      // Proceed
    }
    toast.flash("success", "Signed out successfully");
    window.location.href = "/client/login";
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      leftIcon={<LogOut size={14} />}
      onClick={handleSignOut}
    >
      <span className="hidden min-[380px]:inline">Sign out</span>
    </Button>
  );
}
