import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  ToolInvocationStatus,
  describeToolCall,
} from "../ToolInvocationStatus";

afterEach(() => {
  cleanup();
});

test("describeToolCall: str_replace_editor create", () => {
  expect(
    describeToolCall("str_replace_editor", {
      command: "create",
      path: "/App.jsx",
    })
  ).toBe("Creating /App.jsx");
});

test("describeToolCall: str_replace_editor str_replace", () => {
  expect(
    describeToolCall("str_replace_editor", {
      command: "str_replace",
      path: "/components/Card.jsx",
    })
  ).toBe("Editing /components/Card.jsx");
});

test("describeToolCall: str_replace_editor insert", () => {
  expect(
    describeToolCall("str_replace_editor", {
      command: "insert",
      path: "/App.jsx",
    })
  ).toBe("Editing /App.jsx");
});

test("describeToolCall: str_replace_editor view", () => {
  expect(
    describeToolCall("str_replace_editor", {
      command: "view",
      path: "/App.jsx",
    })
  ).toBe("Viewing /App.jsx");
});

test("describeToolCall: str_replace_editor undo_edit", () => {
  expect(
    describeToolCall("str_replace_editor", {
      command: "undo_edit",
      path: "/App.jsx",
    })
  ).toBe("Undoing edit on /App.jsx");
});

test("describeToolCall: file_manager rename with new_path", () => {
  expect(
    describeToolCall("file_manager", {
      command: "rename",
      path: "/a.jsx",
      new_path: "/b.jsx",
    })
  ).toBe("Renaming /a.jsx to /b.jsx");
});

test("describeToolCall: file_manager rename without new_path", () => {
  expect(
    describeToolCall("file_manager", { command: "rename", path: "/a.jsx" })
  ).toBe("Renaming /a.jsx");
});

test("describeToolCall: file_manager delete", () => {
  expect(
    describeToolCall("file_manager", { command: "delete", path: "/a.jsx" })
  ).toBe("Deleting /a.jsx");
});

test("describeToolCall: known tool, missing command", () => {
  expect(
    describeToolCall("str_replace_editor", { path: "/App.jsx" })
  ).toBe("Working on file…");
});

test("describeToolCall: known tool, missing path", () => {
  expect(
    describeToolCall("str_replace_editor", { command: "create" })
  ).toBe("Working on file…");
});

test("describeToolCall: args as complete JSON string", () => {
  expect(
    describeToolCall(
      "str_replace_editor",
      JSON.stringify({ command: "create", path: "/App.jsx" })
    )
  ).toBe("Creating /App.jsx");
});

test("describeToolCall: args as unparseable string", () => {
  expect(
    describeToolCall("str_replace_editor", '{"command":"cre')
  ).toBe("Working on file…");
});

test("describeToolCall: unknown tool name", () => {
  expect(
    describeToolCall("mystery_tool", { command: "create", path: "/x" })
  ).toBe("mystery_tool");
});

test("describeToolCall: undefined args on known tool", () => {
  expect(describeToolCall("str_replace_editor", undefined)).toBe(
    "Working on file…"
  );
});

test("describeToolCall: undefined args on unknown tool", () => {
  expect(describeToolCall("mystery_tool", undefined)).toBe("mystery_tool");
});

test("ToolInvocationStatus: renders the friendly label", () => {
  render(
    <ToolInvocationStatus
      toolName="str_replace_editor"
      args={{ command: "create", path: "/App.jsx" }}
      state="result"
      result="ok"
    />
  );
  expect(screen.getByText("Creating /App.jsx")).toBeDefined();
});

test("ToolInvocationStatus: state=call shows spinner, no green dot", () => {
  const { container } = render(
    <ToolInvocationStatus
      toolName="str_replace_editor"
      args={{ command: "create", path: "/App.jsx" }}
      state="call"
    />
  );
  expect(container.querySelector(".animate-spin")).not.toBeNull();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("ToolInvocationStatus: state=partial-call shows spinner", () => {
  const { container } = render(
    <ToolInvocationStatus
      toolName="str_replace_editor"
      args={'{"command":"cre'}
      state="partial-call"
    />
  );
  expect(container.querySelector(".animate-spin")).not.toBeNull();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("ToolInvocationStatus: state=result with truthy result shows green dot", () => {
  const { container } = render(
    <ToolInvocationStatus
      toolName="str_replace_editor"
      args={{ command: "create", path: "/App.jsx" }}
      state="result"
      result="created"
    />
  );
  expect(container.querySelector(".bg-emerald-500")).not.toBeNull();
  expect(container.querySelector(".animate-spin")).toBeNull();
});

test("ToolInvocationStatus: state=result with falsy result still shows spinner", () => {
  const { container } = render(
    <ToolInvocationStatus
      toolName="str_replace_editor"
      args={{ command: "create", path: "/App.jsx" }}
      state="result"
      result={null}
    />
  );
  expect(container.querySelector(".animate-spin")).not.toBeNull();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});
