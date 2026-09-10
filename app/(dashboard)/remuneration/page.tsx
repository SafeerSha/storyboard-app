import { redirect } from "next/navigation";

export default function RemunerationPage() {
  redirect("/settings?tab=remuneration");
}
