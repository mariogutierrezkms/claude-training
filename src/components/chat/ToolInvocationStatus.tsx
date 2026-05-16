"use client";

import { Loader2 } from "lucide-react";

interface ToolInvocationStatusProps {
  toolName: string;
  args: unknown;
  state: "partial-call" | "call" | "result";
  result?: unknown;
}

const KNOWN_TOOLS = new Set(["str_replace_editor", "file_manager"]);

function readArgs(args: unknown): Record<string, unknown> | null {
  if (args == null) return null;
  if (typeof args === "string") {
    try {
      const parsed = JSON.parse(args);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof args === "object") {
    return args as Record<string, unknown>;
  }
  return null;
}

export function describeToolCall(toolName: string, args: unknown): string {
  const parsed = readArgs(args);
  const isKnownTool = KNOWN_TOOLS.has(toolName);
  const fallback = isKnownTool ? "Working on file…" : toolName;

  if (!parsed) return fallback;

  const command =
    typeof parsed.command === "string" ? parsed.command : undefined;
  const path = typeof parsed.path === "string" ? parsed.path : undefined;

  if (!command || !path) return fallback;

  if (toolName === "str_replace_editor") {
    switch (command) {
      case "create":
        return `Creating ${path}`;
      case "str_replace":
      case "insert":
        return `Editing ${path}`;
      case "view":
        return `Viewing ${path}`;
      case "undo_edit":
        return `Undoing edit on ${path}`;
    }
  }

  if (toolName === "file_manager") {
    if (command === "delete") {
      return `Deleting ${path}`;
    }
    if (command === "rename") {
      const newPath =
        typeof parsed.new_path === "string" ? parsed.new_path : undefined;
      return newPath ? `Renaming ${path} to ${newPath}` : `Renaming ${path}`;
    }
  }

  return fallback;
}

export function ToolInvocationStatus({
  toolName,
  args,
  state,
  result,
}: ToolInvocationStatusProps) {
  const isDone = state === "result" && Boolean(result);
  const label = describeToolCall(toolName, args);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
