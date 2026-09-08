import { StoryBoardLogoMark } from "@/components/brand/StoryBoardLogo";

export default function Loading() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F5F2F7]">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative flex items-center justify-center">
          <StoryBoardLogoMark size={44} />
          <div className="absolute -inset-2 rounded-2xl border-2 border-[#B8944E]/20 border-t-[#B8944E] animate-spin" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-[#252331]">
            Story<span className="text-[#B8944E]">Board</span>
          </p>
          <p className="text-xs text-[#706C7D] animate-pulse">Loading workspace...</p>
        </div>
      </div>
    </main>
  );
}
