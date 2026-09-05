export default function Loading() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-white shadow-soft">
          <span className="text-xl font-bold">◆</span>
          <div className="absolute -inset-1 rounded-2xl border-2 border-indigo-500/40 border-t-indigo-600 animate-spin" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-neutral-800">StoryBoard</p>
          <p className="text-xs text-neutral-500 animate-pulse">Loading workspace...</p>
        </div>
      </div>
    </main>
  );
}
