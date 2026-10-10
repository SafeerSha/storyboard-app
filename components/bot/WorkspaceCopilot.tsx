"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  BotMessageSquare,
  X,
  Send,
  Loader2,
  RotateCcw,
  Bot,
  User,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Maximize2,
  Minimize2,
  Plus,
  History,
  Trash2,
  Clock,
  MessageSquare,
  Sparkles,
  Copy,
  Check,
  FolderGit2,
  ArrowUpRight,
  Layers,
  CheckSquare,
  Square,
  LayoutGrid,
  List,
} from "lucide-react";
import { toast } from "@/lib/toast";

export interface ActionReceipt {
  type: "story_created" | "task_created" | "story_updated" | "stories_bulk_created";
  title: string;
  id?: string;
  projectId?: string;
  epicId?: string;
  details?: Record<string, any>;
  url?: string;
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionReceipts?: ActionReceipt[];
  timestamp: string;
}

export interface RecordedConversation {
  id: string;
  title: string;
  project_id?: string | null;
  created_at: string;
  updated_at: string;
}

function renderInlineMarkdown(text: string, onLinkClick?: () => void): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const regex = /(\[.*?\]\(.*?\)|\*\*.*?\*\*|`.*?`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const linkMatch = token.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        const linkText = linkMatch[1];
        const linkUrl = linkMatch[2];
        tokens.push(
          <Link
            key={match.index}
            href={linkUrl}
            onClick={onLinkClick}
            className="text-[#D6BD88] hover:text-[#F3E5C8] underline font-medium inline-flex items-center gap-0.5"
          >
            {linkText}
          </Link>
        );
      } else {
        tokens.push(token);
      }
    } else if (token.startsWith("**") && token.endsWith("**")) {
      tokens.push(
        <strong key={match.index} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      tokens.push(
        <code
          key={match.index}
          className="rounded bg-slate-900/90 px-1.5 py-0.5 font-mono text-[11px] text-[#D6BD88] border border-slate-700/60"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens;
}

function CodeBlockSnippet({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-slate-800 bg-[#0E0C17] shadow-inner text-xs">
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-[#161424] px-3 py-1.5 text-[11px] text-slate-400 font-mono">
        <span>{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-slate-800 hover:text-white transition"
          title="Copy code"
        >
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-slate-200 font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function SmartVisualTable({
  headers,
  rows,
  onLinkClick,
}: {
  headers: string[];
  rows: string[][];
  onLinkClick?: () => void;
}) {
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("ID copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Detect if this table represents workspace projects
  const isProjectTable =
    headers.some((h) => /project/i.test(h)) &&
    (headers.some((h) => /id/i.test(h)) ||
      rows.some((r) => r.some((c) => /[0-9a-f]{8}-[0-9a-f]{4}/i.test(c))));

  if (isProjectTable) {
    const projNameIdx = headers.findIndex((h) => /project.*name|project/i.test(h));
    const descIdx = headers.findIndex((h) => /desc/i.test(h));
    const idIdx = headers.findIndex((h) => /id/i.test(h));
    const updatedIdx = headers.findIndex((h) => /update|date|time/i.test(h));

    const projects = rows.map((row) => {
      const rawName = projNameIdx >= 0 ? row[projNameIdx] : row[0] || "Project";
      const cleanName = rawName
        .replace(/^\*\*|\*\*$/g, "")
        .replace(/^\[(.*?)\]\(.*?\)$/, "$1")
        .trim();

      // Extract ID from ID column or markdown link
      let rawId = idIdx >= 0 ? row[idIdx] : "";
      rawId = rawId.replace(/^`|`$/g, "").trim();
      if (!rawId || rawId === "—") {
        const linkMatch = rawName.match(/\/project\/([a-zA-Z0-9-]+)/);
        if (linkMatch) rawId = linkMatch[1];
      }

      const rawDesc = descIdx >= 0 ? row[descIdx] : "";
      const cleanDesc = rawDesc === "—" || rawDesc === "-" ? "" : rawDesc.trim();

      const rawUpdated = updatedIdx >= 0 ? row[updatedIdx] : "";
      const cleanUpdated = rawUpdated === "—" || rawUpdated === "-" ? "" : rawUpdated.trim();

      return {
        name: cleanName,
        id: rawId,
        description: cleanDesc,
        lastUpdated: cleanUpdated,
      };
    });

    return (
      <div className="my-3 space-y-2.5">
        {/* Header Bar with View Switcher */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <FolderGit2 size={15} className="text-[#D6BD88]" />
            <span>Workspace Projects</span>
            <span className="rounded-full bg-[#B8944E]/20 text-[#D6BD88] px-1.5 py-0.2 text-[10px] font-bold border border-[#B8944E]/30">
              {projects.length}
            </span>
          </div>

          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition cursor-pointer ${viewMode === "cards"
                  ? "bg-[#B8944E] text-white font-semibold shadow-xs"
                  : "text-slate-400 hover:text-white"
                }`}
              title="Cards View"
            >
              <LayoutGrid size={11} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition cursor-pointer ${viewMode === "table"
                  ? "bg-[#B8944E] text-white font-semibold shadow-xs"
                  : "text-slate-400 hover:text-white"
                }`}
              title="Table View"
            >
              <List size={11} />
              <span>Table</span>
            </button>
          </div>
        </div>

        {/* View Mode: Interactive Project Cards */}
        {viewMode === "cards" ? (
          <div className="grid grid-cols-1 gap-2">
            {projects.map((proj, pIdx) => {
              const shortId = proj.id ? proj.id.slice(0, 8) : "";
              const projectUrl = proj.id ? `/project/${proj.id}` : "#";

              return (
                <div
                  key={pIdx}
                  className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-800/90 bg-gradient-to-br from-[#161423] to-[#110F1B] hover:border-[#B8944E]/50 hover:bg-[#1A1729] transition-all duration-200 shadow-sm"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-[#B8944E]/15 border border-[#B8944E]/30 flex items-center justify-center text-[#D6BD88] shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      <FolderGit2 size={16} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className="font-semibold text-white text-xs sm:text-sm tracking-tight truncate group-hover:text-[#F3E5C8] transition-colors">
                          {proj.name}
                        </h5>
                        {shortId && (
                          <button
                            type="button"
                            onClick={(e) => handleCopyId(e, proj.id)}
                            className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-400 bg-slate-900/90 hover:text-[#D6BD88] px-1.5 py-0.5 rounded border border-slate-800 transition cursor-pointer"
                            title={`Click to copy full ID: ${proj.id}`}
                          >
                            <span>#{shortId}</span>
                            {copiedId === proj.id ? (
                              <Check size={10} className="text-emerald-400" />
                            ) : (
                              <Copy size={10} />
                            )}
                          </button>
                        )}
                      </div>

                      {proj.description ? (
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                          {proj.description}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 italic mt-0.5">
                          No description provided
                        </p>
                      )}

                      {proj.lastUpdated && (
                        <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                          Updated {proj.lastUpdated}
                        </span>
                      )}
                    </div>
                  </div>

                  {proj.id && (
                    <Link
                      href={projectUrl}
                      onClick={onLinkClick}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#B8944E]/20 hover:bg-[#B8944E] text-[#F3E5C8] hover:text-white border border-[#B8944E]/40 px-3 py-1.5 text-xs font-semibold transition shrink-0 active:scale-95 shadow-xs self-end sm:self-center cursor-pointer"
                    >
                      <span>Open Project</span>
                      <ArrowUpRight size={13} />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* View Mode: Modern Glassmorphic Table */
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#12101B]/90 shadow-inner">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#B8944E]/20 bg-[#181525]">
                  <th className="px-3 py-2 font-semibold text-[#D6BD88]">Project</th>
                  <th className="px-3 py-2 font-semibold text-slate-300">Description</th>
                  <th className="px-3 py-2 font-semibold text-slate-300">ID</th>
                  <th className="px-3 py-2 font-semibold text-slate-300 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {projects.map((proj, pIdx) => (
                  <tr key={pIdx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-3 py-2 font-semibold text-white truncate max-w-[140px]">
                      {proj.name}
                    </td>
                    <td className="px-3 py-2 text-slate-400 truncate max-w-[160px]">
                      {proj.description || "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-400">
                      {proj.id ? (
                        <button
                          type="button"
                          onClick={(e) => handleCopyId(e, proj.id)}
                          className="hover:text-[#D6BD88] underline inline-flex items-center gap-1 cursor-pointer"
                          title="Copy UUID"
                        >
                          #{proj.id.slice(0, 8)}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {proj.id && (
                        <Link
                          href={`/project/${proj.id}`}
                          onClick={onLinkClick}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D6BD88] hover:text-[#F3E5C8]"
                        >
                          <span>Open</span>
                          <ArrowUpRight size={12} />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Fallback: General Table with smart UUID & status badges
  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-slate-800 bg-[#12101B]/90 shadow-inner">
      <table className="w-full text-xs text-left border-collapse">
        <thead>
          <tr className="border-b border-[#B8944E]/20 bg-[#181525]">
            {headers.map((h, hIdx) => (
              <th key={hIdx} className="px-3 py-2 font-semibold text-[#D6BD88]">
                {renderInlineMarkdown(h, onLinkClick)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-slate-800/30 transition-colors">
              {row.map((cell, cIdx) => {
                const uuidMatch = cell.match(
                  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
                );
                if (uuidMatch) {
                  const uuid = uuidMatch[0];
                  return (
                    <td key={cIdx} className="px-3 py-2 text-slate-300">
                      <button
                        type="button"
                        onClick={(e) => handleCopyId(e, uuid)}
                        className="font-mono text-[10px] text-slate-400 hover:text-[#D6BD88] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 inline-flex items-center gap-1 cursor-pointer"
                        title={`Click to copy: ${uuid}`}
                      >
                        <span>#{uuid.slice(0, 8)}</span>
                        <Copy size={10} />
                      </button>
                    </td>
                  );
                }

                const lower = cell.toLowerCase().trim();
                let statusBadge = null;
                if (lower === "urgent" || lower === "high") {
                  statusBadge = (
                    <span className="rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 text-[10px] font-semibold">
                      {cell}
                    </span>
                  );
                } else if (
                  lower === "medium" ||
                  lower === "in_progress" ||
                  lower === "in progress"
                ) {
                  statusBadge = (
                    <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 text-[10px] font-semibold">
                      {cell}
                    </span>
                  );
                } else if (lower === "done" || lower === "completed") {
                  statusBadge = (
                    <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold">
                      {cell}
                    </span>
                  );
                } else if (lower === "low" || lower === "todo" || lower === "draft") {
                  statusBadge = (
                    <span className="rounded-full bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 text-[10px] font-medium">
                      {cell}
                    </span>
                  );
                }

                return (
                  <td key={cIdx} className="px-3 py-2 text-slate-300">
                    {statusBadge || renderInlineMarkdown(cell, onLinkClick)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormattedMessageContent({
  content,
  onLinkClick,
}: {
  content: string;
  onLinkClick?: () => void;
}) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 1. Detect Fenced Code Blocks: ```lang ... ```
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <CodeBlockSnippet
          key={`code-${i}`}
          code={codeLines.join("\n")}
          language={lang}
        />
      );
      continue;
    }

    // 2. Detect Tables: line starts with '|' and next line has dashes '| :---'
    if (
      line.trim().startsWith("|") &&
      i + 1 < lines.length &&
      lines[i + 1].trim().startsWith("|") &&
      lines[i + 1].includes("---")
    ) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]
          .split("|")
          .slice(1, -1)
          .map((s) => s.trim());
        const dataRows = tableLines
          .slice(2)
          .map((row) => row.split("|").slice(1, -1).map((s) => s.trim()));

        elements.push(
          <SmartVisualTable
            key={`table-${i}`}
            headers={headerRow}
            rows={dataRows}
            onLinkClick={onLinkClick}
          />
        );
        continue;
      }
    }

    // 3. Detect KPI / Metric Sentences (e.g., "You have **10** projects, **45** stories, and **12** open tasks")
    const kpiMatch = line.match(
      /(\d+)\s*(?:\*\*)?\s*projects?,?\s*(\d+)\s*(?:\*\*)?\s*stories?,?\s*(?:and)?\s*(\d+)\s*(?:\*\*)?\s*open tasks?/i
    );
    if (kpiMatch) {
      const [_, pCount, sCount, tCount] = kpiMatch;
      elements.push(
        <div key={`kpi-${i}`} className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-2.5">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#1C182B] to-[#13111F] border border-[#B8944E]/30 flex items-center gap-2.5 shadow-sm">
            <div className="h-8 w-8 rounded-lg bg-[#B8944E]/20 text-[#D6BD88] flex items-center justify-center shrink-0">
              <FolderGit2 size={16} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Projects
              </p>
              <p className="text-sm font-bold text-white font-mono">{pCount}</p>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#1C182B] to-[#13111F] border border-[#B8944E]/30 flex items-center gap-2.5 shadow-sm">
            <div className="h-8 w-8 rounded-lg bg-[#B8944E]/20 text-[#D6BD88] flex items-center justify-center shrink-0">
              <Layers size={16} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Stories
              </p>
              <p className="text-sm font-bold text-white font-mono">{sCount}</p>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#1C182B] to-[#13111F] border border-[#B8944E]/30 flex items-center gap-2.5 shadow-sm">
            <div className="h-8 w-8 rounded-lg bg-[#B8944E]/20 text-[#D6BD88] flex items-center justify-center shrink-0">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Open Tasks
              </p>
              <p className="text-sm font-bold text-white font-mono">{tCount}</p>
            </div>
          </div>
        </div>
      );
      i++;
      continue;
    }

    // 4. Headings
    if (line.startsWith("### ")) {
      elements.push(
        <h4
          key={`h4-${i}`}
          className="text-sm font-bold text-white mt-2.5 mb-1 flex items-center gap-1.5"
        >
          {renderInlineMarkdown(line.slice(4), onLinkClick)}
        </h4>
      );
      i++;
      continue;
    }
    if (line.startsWith("#### ")) {
      elements.push(
        <h5
          key={`h5-${i}`}
          className="text-xs font-bold text-[#D6BD88] mt-2 mb-1 uppercase tracking-wider"
        >
          {renderInlineMarkdown(line.slice(5), onLinkClick)}
        </h5>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ") || line.startsWith("# ")) {
      elements.push(
        <h3
          key={`h3-${i}`}
          className="text-sm font-extrabold text-white mt-3 mb-1.5"
        >
          {renderInlineMarkdown(line.replace(/^#+\s*/, ""), onLinkClick)}
        </h3>
      );
      i++;
      continue;
    }

    // 5. Checklists: - [ ] or - [x]
    if (/^\s*[-*]\s+\[([ xX])\]\s+/.test(line)) {
      const isChecked = /^\s*[-*]\s+\[[xX]\]\s+/.test(line);
      const text = line.replace(/^\s*[-*]\s+\[[ xX]\]\s+/, "");
      elements.push(
        <div key={`chk-${i}`} className="flex items-start gap-2 my-1 pl-1">
          {isChecked ? (
            <CheckSquare size={14} className="text-emerald-400 mt-0.5 shrink-0" />
          ) : (
            <Square size={14} className="text-slate-500 mt-0.5 shrink-0" />
          )}
          <div
            className={`text-xs sm:text-sm leading-relaxed ${isChecked ? "text-slate-400 line-through" : "text-slate-200"
              }`}
          >
            {renderInlineMarkdown(text, onLinkClick)}
          </div>
        </div>
      );
      i++;
      continue;
    }

    // 6. Unordered list: - or *
    if (/^\s*[-*]\s+/.test(line)) {
      const bulletText = line.replace(/^\s*[-*]\s+/, "");
      elements.push(
        <div key={`li-${i}`} className="flex items-start gap-2 my-1 pl-1">
          <span className="text-[#D6BD88] text-xs leading-5 shrink-0">•</span>
          <div className="leading-relaxed text-slate-300 text-xs sm:text-sm">
            {renderInlineMarkdown(bulletText, onLinkClick)}
          </div>
        </div>
      );
      i++;
      continue;
    }

    // 7. Blockquote: > ...
    if (line.trim().startsWith(">")) {
      const quoteText = line.trim().replace(/^>\s*/, "");
      elements.push(
        <div
          key={`quote-${i}`}
          className="my-2 rounded-r-xl border-l-2 border-[#B8944E] bg-[#B8944E]/5 p-2.5 text-xs text-slate-300 italic"
        >
          {renderInlineMarkdown(quoteText, onLinkClick)}
        </div>
      );
      i++;
      continue;
    }

    // 8. Empty line spacer
    if (!line.trim()) {
      elements.push(<div key={`sp-${i}`} className="h-1.5" />);
      i++;
      continue;
    }

    // 9. Standard paragraph line
    elements.push(
      <p
        key={`p-${i}`}
        className="leading-relaxed text-slate-300 text-xs sm:text-sm my-0.5"
      >
        {renderInlineMarkdown(line, onLinkClick)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function AssistantMessageBubble({
  message,
  onLinkClick,
}: {
  message: CopilotMessage;
  onLinkClick?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success("Response copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl rounded-tl-xs bg-gradient-to-b from-[#181526]/95 to-[#12101C]/98 border border-[#B8944E]/25 hover:border-[#B8944E]/45 p-3.5 sm:p-4 text-slate-200 shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-all space-y-2.5">
      {/* Top Header inside Bubble */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-white tracking-tight">REQly Copilot</span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] text-slate-400 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
          title="Copy response text"
        >
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      {/* Formatted Content with Rich Cards and Tables */}
      <div className="text-xs sm:text-sm">
        <FormattedMessageContent
          content={message.content}
          onLinkClick={onLinkClick}
        />
      </div>

      {/* Action Receipts Preview Cards */}
      {message.actionReceipts && message.actionReceipts.length > 0 && (
        <div className="space-y-2 pt-1">
          {message.actionReceipts.map((receipt, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2.5 sm:p-3 text-emerald-200"
            >
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate text-white">
                    {receipt.title}
                  </p>
                  <p className="text-[10px] text-emerald-400/80 uppercase tracking-wider font-mono">
                    {receipt.type.replace(/_/g, " ")}
                  </p>
                </div>
              </div>

              {receipt.url && (
                <Link
                  href={receipt.url}
                  onClick={onLinkClick}
                  className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/30 active:scale-95 transition shrink-0 ml-2 cursor-pointer"
                >
                  <span>Open</span>
                  <ExternalLink size={11} />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bubble Footer */}
      <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 font-mono border-t border-slate-850/60">
        <span>{message.timestamp}</span>
        <span className="text-[#D6BD88]/70">Autonomous Execution</span>
      </div>
    </div>
  );
}

interface WorkspaceCopilotProps {
  initialUser?: { id: string; name: string; email: string; role: string } | null;
}

export function WorkspaceCopilot({ initialUser }: WorkspaceCopilotProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  // Launcher pill state: idle shows robot icon only; hover/focus/click reveals the full labelled button
  const [isLauncherExpanded, setLauncherExpanded] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Conversation history states
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<RecordedConversation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Extract active project ID from URL if inside a project view
  const activeProjectId = React.useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/\/project\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  // Lock body scroll on mobile when drawer is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Global Keyboard Shortcut: Ctrl + J or Cmd + J and custom event trigger
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    const handleCustomTrigger = () => setIsOpen(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("storyboard:open-copilot", handleCustomTrigger);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("storyboard:open-copilot", handleCustomTrigger);
    };
  }, [isOpen]);

  // Focus textarea when opened (on desktop only, to avoid sudden keyboard pop on mobile)
  useEffect(() => {
    if (isOpen && window.innerWidth >= 768 && !showHistory) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen, showHistory]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && !showHistory) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, isOpen, showHistory]);

  // Fetch conversations list when history is toggled or when Copilot opens
  const fetchConversations = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/bot/conversations", {
        headers: { "x-skip-loader": "1" },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      }
    } catch {
      // Ignore background error
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConversations();
    }
  }, [isOpen]);

  // Start a fresh, clean chat session
  const handleStartNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setShowHistory(false);
    toast.success("Started a new chat session");
  };

  // Switch to a recorded conversation from history
  const handleSelectConversation = async (conv: RecordedConversation) => {
    setLoading(true);
    setShowHistory(false);
    setConversationId(conv.id);

    try {
      const res = await fetch(`/api/bot/conversations?id=${conv.id}`, {
        headers: { "x-skip-loader": "1" },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.messages)) {
        const loadedMessages: CopilotMessage[] = data.messages.map((m: any) => ({
          id: m.id,
          role: m.sender_type,
          content: m.content,
          actionReceipts: m.metadata?.actionReceipts || [],
          timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }));
        setMessages(loadedMessages);
      } else {
        toast.error("Could not load recorded messages.");
      }
    } catch {
      toast.error("Failed to load conversation history.");
    } finally {
      setLoading(false);
    }
  };

  // Delete a recorded conversation
  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/bot/conversations?id=${id}`, {
        method: "DELETE",
        headers: { "x-skip-loader": "1" },
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (conversationId === id) {
          setMessages([]);
          setConversationId(null);
        }
        toast.success("Chat deleted from history");
      }
    } catch {
      toast.error("Failed to delete chat");
    }
  };

  // Send message to Copilot
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || loading) return;

    const userMessage: CopilotMessage = {
      id: "usr-" + Date.now(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/bot/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-skip-loader": "1",
        },
        body: JSON.stringify({
          prompt: text,
          conversationId,
          projectId: activeProjectId,
          history: historyPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to communicate with Copilot.");
      }

      if (data.conversationId) {
        setConversationId(data.conversationId);
        // Refresh conversations in background so history reflects new chat
        fetchConversations();
      }

      const botMessage: CopilotMessage = {
        id: "bot-" + Date.now(),
        role: "assistant",
        content: data.content,
        actionReceipts: data.actionReceipts || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMessage]);

      if (data.actionReceipts && data.actionReceipts.length > 0) {
        toast.success(`Copilot executed ${data.actionReceipts.length} action(s)`);
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
      const errorMessage: CopilotMessage = {
        id: "err-" + Date.now(),
        role: "assistant",
        content: `⚠️ **Error:** ${err.message || "Failed to process request."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const starterSuggestions = activeProjectId
    ? [
      "📊 Summarize this project's epics and pending stories",
      "💡 Break down: User can authenticate with Google & Email",
      "📋 Create an urgent task: Set up Stripe webhook handler",
      "🔍 Check open tasks and priority bottlenecks",
    ]
    : [
      "📊 Show high-level overview of all workspace projects",
      "📁 List all active projects in the workspace",
      "💡 How do I structure acceptance criteria for a new MVP?",
      "📋 How many unfinished tasks are currently open?",
    ];

  return (
    <>
      {/* 1. Ambient Floating Trigger Button — idle state shows the robot icon only, peeking from the screen edge */}
      <div
        className="fixed bottom-20 right-2.5 sm:bottom-6 sm:right-4 z-[60] transition-all duration-200"
        onMouseEnter={() => setLauncherExpanded(true)}
        onMouseLeave={() => setLauncherExpanded(false)}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLauncherExpanded(true);
            setIsOpen((prev) => !prev);
          }}
          onFocus={() => setLauncherExpanded(true)}
          onBlur={() => setLauncherExpanded(false)}
          className={`group relative flex items-center justify-center rounded-full bg-[#121118] border border-[#B8944E]/40 hover:border-[#B8944E]/85 text-white shadow-[0_12px_32px_rgba(0,0,0,0.40),0_0_20px_rgba(184,148,78,0.16)] transition-all duration-300 hover:scale-105 hover:shadow-[0_16px_40px_rgba(0,0,0,0.50),0_0_25px_rgba(184,148,78,0.28)] focus:outline-none focus:ring-2 focus:ring-[#B8944E]/60 focus:ring-offset-2 focus:ring-offset-[#121118] active:scale-95 cursor-pointer ${
            isLauncherExpanded ? "gap-2.5 px-4 py-2.5 sm:px-4 sm:py-2.5" : "p-3 sm:p-3.5"
          }`}
          aria-label="Open REQly AI Copilot"
          aria-expanded={isLauncherExpanded}
          title="Open REQly AI Copilot"
        >
          <div className="relative flex items-center justify-center">
            <BotMessageSquare size={19} className="text-[#D6BD88] transition-transform group-hover:scale-110" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
          </div>

          {isLauncherExpanded && (
            <span className="text-xs font-semibold tracking-wide text-white whitespace-nowrap">Copilot</span>
          )}
        </button>
      </div>

      {/* 2. Slide-Over Drawer Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[90] bg-slate-950/65 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 3. Copilot Slide-Over Drawer Container (Full viewport height 100dvh on mobile) */}
      <aside
        className={`fixed inset-y-0 right-0 z-[95] flex flex-col h-[100dvh] max-h-[100dvh] bg-[#100E17] border-l border-[#B8944E]/20 text-slate-100 shadow-2xl transition-all duration-300 ease-out ${isOpen
            ? "translate-x-0 opacity-100 visible pointer-events-auto"
            : "translate-x-full opacity-0 invisible pointer-events-none"
          } ${isExpanded ? "w-full md:w-[760px]" : "w-full sm:w-[480px] md:w-[520px]"
          }`}
        aria-hidden={!isOpen}
      >
        {/* Mobile Pull Indicator */}
        <div className="sm:hidden pt-2 pb-0.5 flex justify-center bg-[#161420]">
          <div className="h-1 w-10 rounded-full bg-[#B8944E]/40" />
        </div>

        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#B8944E]/15 px-3 sm:px-4 py-2.5 sm:py-3 bg-[#161420]/80 backdrop-blur-md">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#80642F] to-[#B8944E] text-white shadow-md shadow-[#B8944E]/25">
              <BotMessageSquare size={17} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center">
                <h3 className="text-xs sm:text-sm font-semibold text-white tracking-tight truncate">REQly Copilot</h3>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                {activeProjectId ? (
                  <span className="text-[#D6BD88]">Scoped to Project</span>
                ) : (
                  "Workspace Mode · Autonomous"
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* + New Chat Button */}
            <button
              type="button"
              onClick={handleStartNewChat}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#B8944E]/30 to-[#80642F]/30 hover:from-[#B8944E]/45 hover:to-[#80642F]/45 text-[#F5E8C8] border border-[#B8944E]/50 px-2.5 py-1 text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
              title="Start a new recorded conversation"
            >
              <Plus size={13} className="text-[#D6BD88]" />
              <span>New Chat</span>
            </button>

            {/* History Toggle Button */}
            <button
              type="button"
              onClick={() => {
                setShowHistory((prev) => !prev);
                if (!showHistory) fetchConversations();
              }}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border transition cursor-pointer ${showHistory
                  ? "bg-[#B8944E] text-white border-[#B8944E]"
                  : "bg-slate-900 text-slate-300 hover:bg-slate-850 hover:text-white border-slate-800"
                }`}
              title="View recorded chat history"
            >
              <History size={13} />
              <span className="hidden sm:inline">History</span>
              {conversations.length > 0 && (
                <span className="ml-0.5 rounded-full bg-black/30 px-1.5 py-0.2 text-[10px] font-bold text-[#D6BD88]">
                  {conversations.length}
                </span>
              )}
            </button>

            {/* Expand / Minimize */}
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="hidden md:inline-flex rounded-lg p-1.5 text-slate-400 hover:bg-slate-850 hover:text-white transition"
              title={isExpanded ? "Standard width" : "Expand drawer"}
            >
              {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-850 hover:text-white transition"
              title="Close Copilot"
              aria-label="Close Copilot"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Sync Status Banner */}
        <div className="bg-[#14121C] border-b border-[#B8944E]/10 px-4 py-1.5 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300">Every chat is automatically recorded & saved to database</span>
          </div>
          {conversationId ? (
            <span className="font-mono text-[#D6BD88]/90 truncate max-w-[140px]">
              Thread: #{conversationId.slice(0, 8)}
            </span>
          ) : (
            <span className="text-emerald-400/90 font-medium">New Thread</span>
          )}
        </div>

        {/* View Mode: Recorded History OR Active Chat Feed */}
        {showHistory ? (
          /* ========================================================================= */
          /* RECORDED CONVERSATIONS SCREEN                                            */
          /* ========================================================================= */
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div>
                <h4 className="text-sm font-semibold text-white">Recorded Conversations</h4>
                <p className="text-[11px] text-slate-400">Select any past conversation to continue</p>
              </div>
              <button
                type="button"
                onClick={handleStartNewChat}
                className="flex items-center gap-1.5 rounded-lg bg-[#B8944E] text-white px-2.5 py-1 text-xs font-semibold hover:bg-[#9F7D3E] transition active:scale-95 shadow-sm shadow-[#B8944E]/25"
              >
                <Plus size={13} />
                <span>New Chat</span>
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 size={18} className="animate-spin text-[#B8944E]" />
                <span>Loading recorded conversations...</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 mx-auto">
                  <MessageSquare size={22} />
                </div>
                <p className="text-xs text-slate-300 font-medium">No recorded chats yet</p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Send your first message or choose a suggestion below to start a recorded discussion.
                </p>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                {conversations.map((conv) => {
                  const isActive = conv.id === conversationId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv)}
                      className={`group flex items-center justify-between rounded-xl p-3 border text-left transition cursor-pointer ${isActive
                          ? "bg-[#1C1828] border-[#B8944E]/60 text-white shadow-sm"
                          : "bg-[#14121D] border-slate-800/80 text-slate-300 hover:border-[#B8944E]/40 hover:bg-[#181524] hover:text-white"
                        }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <MessageSquare
                          size={15}
                          className={`mt-0.5 shrink-0 ${isActive ? "text-[#D6BD88]" : "text-slate-500 group-hover:text-[#D6BD88]"
                            }`}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate text-white">{conv.title}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-mono">
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {new Date(conv.updated_at || conv.created_at).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {isActive && (
                              <span className="text-[#D6BD88] font-sans font-medium">· Active Session</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition opacity-0 group-hover:opacity-100"
                        title="Delete conversation"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* ACTIVE CHAT FEED                                                         */
          /* ========================================================================= */
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 text-xs sm:text-sm">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center pt-2 sm:pt-4 pb-4">
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-[#1E1B28] border border-[#B8944E]/30 text-[#D6BD88] mb-3 sm:mb-4 shadow-inner">
                  <Bot size={26} />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">
                  Hi {initialUser?.name || "there"}, I'm your Workspace Copilot
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mb-4 sm:mb-5 leading-relaxed">
                  I can inspect your workspace, break down requirements into deliverable stories, generate tasks, and update progress. All sessions are saved automatically.
                </p>

                {/* Quick New Chat / Status Action */}
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={handleStartNewChat}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#B8944E]/20 hover:bg-[#B8944E]/30 text-[#F5E8C8] border border-[#B8944E]/40 px-3 py-1.5 text-xs font-semibold transition active:scale-95"
                  >
                    <Plus size={13} className="text-[#D6BD88]" />
                    <span>Start Fresh Chat Session</span>
                  </button>
                </div>

                {/* Recent Recorded Conversations in Empty State */}
                {conversations.length > 0 && (
                  <div className="w-full space-y-2 text-left mb-5">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                        <History size={12} className="text-[#D6BD88]" />
                        <span>Recent Recorded Chats</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowHistory(true)}
                        className="text-[11px] text-[#D6BD88] hover:text-[#F3E5C8] font-medium transition cursor-pointer"
                      >
                        View All ({conversations.length})
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {conversations.slice(0, 3).map((conv) => (
                        <button
                          key={conv.id}
                          type="button"
                          onClick={() => handleSelectConversation(conv)}
                          className="flex w-full items-center justify-between rounded-xl border border-slate-800/90 bg-[#151321] p-2.5 text-xs text-slate-300 hover:border-[#B8944E]/60 hover:bg-[#1C182B] hover:text-white transition group cursor-pointer text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <MessageSquare size={13} className="text-[#D6BD88] shrink-0" />
                            <span className="truncate font-medium">{conv.title}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">
                            {new Date(conv.updated_at || conv.created_at).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                <div className="w-full space-y-2 text-left">
                  <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-1">
                    Suggested Actions
                  </p>
                  {starterSuggestions.map((prompt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSendMessage(prompt)}
                      disabled={loading}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-800/90 bg-slate-900/60 p-3 min-h-[44px] text-xs text-slate-300 hover:border-[#B8944E]/60 hover:bg-slate-850 hover:text-white transition active:bg-slate-800 group"
                    >
                      <span className="line-clamp-2 text-left">{prompt}</span>
                      <ChevronRight size={14} className="text-slate-500 group-hover:text-[#D6BD88] transition shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div key={m.id} className={`flex gap-2.5 sm:gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#181622] border border-[#B8944E]/30 text-[#D6BD88] mt-1 shadow-sm">
                        <BotMessageSquare size={14} />
                      </div>
                    )}

                    <div className="max-w-[92%] sm:max-w-[88%] space-y-2">
                      {isUser ? (
                        <div className="rounded-2xl rounded-tr-xs bg-[#B8944E] text-white px-3.5 sm:px-4 py-2.5 sm:py-3 leading-relaxed shadow-md shadow-[#B8944E]/20 font-medium">
                          <div className="whitespace-pre-wrap font-sans text-xs sm:text-sm break-words">
                            {m.content}
                          </div>
                          <div className="text-[10px] mt-1.5 font-mono text-amber-100/90 text-right">
                            {m.timestamp}
                          </div>
                        </div>
                      ) : (
                        <AssistantMessageBubble
                          message={m}
                          onLinkClick={() => setIsOpen(false)}
                        />
                      )}
                    </div>

                    {isUser && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 mt-1">
                        <User size={13} />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex gap-2.5 sm:gap-3 items-center">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#181622] border border-[#B8944E]/35 text-[#D6BD88] animate-pulse">
                  <BotMessageSquare size={14} />
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-[#161420] px-3.5 py-2 text-xs text-slate-300">
                  <Loader2 size={14} className="animate-spin text-[#B8944E]" />
                  <span>Copilot is reasoning & executing...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Bar (includes dynamic safe-area insets for mobile home indicators) */}
        {!showHistory && (
          <div className="border-t border-slate-800/80 bg-slate-900/80 p-2.5 sm:p-4 backdrop-blur-md pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] sm:pb-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="relative flex items-center rounded-2xl border border-slate-700/80 bg-slate-950 p-1 sm:p-1.5 focus-within:border-[#B8944E] focus-within:ring-1 focus-within:ring-[#B8944E]/40 transition shadow-inner"
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  activeProjectId
                    ? "Ask about this project, create stories or tasks..."
                    : "Ask anything, break down requirements, or create tasks..."
                }
                // 16px font-size (text-base) on mobile prevents iOS Safari auto-zoom
                className="max-h-24 sm:max-h-28 min-h-[38px] flex-1 resize-none bg-transparent px-3 py-2 text-base sm:text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />

              <button
                type="submit"
                disabled={!inputValue.trim() || loading}
                className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-[#B8944E] text-white transition hover:bg-[#9F7D3E] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-sm shadow-[#B8944E]/30"
                aria-label="Send message"
              >
                <Send size={15} />
              </button>
            </form>

            <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-slate-500 font-mono">
              <span>Enter to send · Shift+Enter new line</span>
              <span className="hidden sm:inline">Ctrl + J to toggle</span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
