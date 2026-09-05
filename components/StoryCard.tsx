import { CheckCircle2, CircleAlert, Clock3 } from "lucide-react";
import type { Story } from "@/lib/types";

const statusMap = {
  draft: ["Draft", "bg-neutral-100 text-neutral-600"],
  review: ["Client review", "bg-amber-50 text-amber-700"],
  changes_requested: ["Changes requested", "bg-rose-50 text-rose-700"],
  approved: ["Approved", "bg-emerald-50 text-emerald-700"],
  in_development: ["In development", "bg-indigo-50 text-indigo-700"],
  completed: ["Completed", "bg-sky-50 text-sky-700"]
} as const;

export function StoryCard({ story, onClick }: { story: Story; onClick?: () => void }) {
  const [label, style] = statusMap[story.status];
  const Icon = story.status === "approved" || story.status === "completed" ? CheckCircle2 : story.status === "changes_requested" ? CircleAlert : Clock3;
  return (
    <button onClick={onClick} className="w-full text-left rounded-2xl border border-line bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-neutral-300">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-neutral-400">
            <span>FEATURE</span><span>•</span><span>{story.acceptance_criteria.length} criteria</span>
          </div>
          <h3 className="text-base font-semibold">{story.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-500">{story.description}</p>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
          <Icon size={13}/>{label}
        </span>
      </div>
    </button>
  );
}
