---
name: virtual-filesystem
description: Work with the in-memory virtual file system (no disk I/O)
applyTo:
  - src/lib/file-system.ts
  - src/lib/contexts/file-system-context.tsx
  - src/app/api/chat/route.ts
---

# Virtual File System

The virtual file system is **in-memory only** — no files are written to disk. This guide helps you work with this non-standard pattern.

## Core Concepts

### VirtualFileSystem Class

Located in [src/lib/file-system.ts](src/lib/file-system.ts):

- **Storage**: `Map<string, FileNode>` — keys are normalized paths
- **Structure**: Tree of `FileNode` objects (type: 'file' | 'directory')
- **Paths**: Forward slashes, root-relative (e.g., `/components/Button.jsx`)
- **Auto-creation**: Parent directories created automatically

### Key Methods

```ts
// Create/update
createFile(path, content)           // Fails if exists
updateFile(path, content)           // Overwrites existing
createFileWithParents(path, content) // Used by AI tools

// Read
getFile(path): FileNode | undefined
viewFile(path, range?: [start, end]): string

// Edit
replaceInFile(path, oldStr, newStr): string
insertInFile(path, lineNumber, text): string

// Delete/rename
deleteFile(path): boolean
rename(oldPath, newPath): boolean

// List
listDirectory(path): FileNode[]
getAllFiles(): FileNode[]  // Flat list

// Serialization
serialize(): Record<string, FileNode>
deserialize(data: string): void
deserializeFromNodes(nodes: Record<string, FileNode>): void
```

## Usage Patterns

### In AI Tools

Tools receive file system instance and operate directly:

```ts
// In src/lib/tools/str-replace.ts
export const buildStrReplaceTool = (fileSystem: VirtualFileSystem) => {
  return {
    execute: async ({ command, path, file_text, ... }) => {
      switch (command) {
        case "create":
          return fileSystem.createFileWithParents(path, file_text || "");
        case "str_replace":
          return fileSystem.replaceInFile(path, old_str, new_str);
        // ...
      }
    }
  };
};
```

**Key**: Tools mutate shared file system instance. Changes persist through serialization.

### In React Context

[src/lib/contexts/file-system-context.tsx](src/lib/contexts/file-system-context.tsx) wraps file system:

```tsx
const [fileSystem, setFileSystem] = useState(() => new VirtualFileSystem());

// Trigger refresh after changes
const refreshFiles = () => {
  setFiles(fileSystem.getAllFiles());
};
```

**Pattern**: After tool calls, `refreshFiles()` triggers re-render with updated file list.

### In Chat API

[src/app/api/chat/route.ts](src/app/api/chat/route.ts) handles serialization:

```ts
// Deserialize from request
const { files } = await req.json();
const fileSystem = new VirtualFileSystem();
fileSystem.deserializeFromNodes(files);

// ... use in tools ...

// Serialize back on completion
onFinish: async ({ response }) => {
  await prisma.project.update({
    data: {
      data: JSON.stringify(fileSystem.serialize())
    }
  });
}
```

**Flow**: Request → Deserialize → Tools modify → Serialize → Database

## Path Normalization

File system normalizes all paths:

```ts
// Input variations → Normalized
"components/Button.jsx"   → "/components/Button.jsx"
"/components/Button.jsx"  → "/components/Button.jsx"
"\\components\\Button.jsx" → "/components/Button.jsx"
```

**Rule**: Always use forward slashes internally. Leading slash is added if missing.

## Parent Directory Creation

Creating a file auto-creates parent directories:

```ts
fileSystem.createFile("/components/ui/Button.jsx", "...");
// Creates: /components/ and /components/ui/ directories
```

**Benefit**: AI tools don't need to explicitly create folder structure.

## Common Operations

### Reading File Content

```ts
// Get full content
const node = fileSystem.getFile("/App.jsx");
if (node?.type === "file") {
  console.log(node.content);
}

// Get with line range (for viewing)
const view = fileSystem.viewFile("/App.jsx", [1, 10]);
```

### Editing Files

```ts
// String replacement
const result = fileSystem.replaceInFile(
  "/App.jsx",
  "old code",
  "new code"
);

// Insert at line
const result = fileSystem.insertInFile(
  "/App.jsx",
  5,  // 0-based line number
  "import Button from '@/components/Button';\n"
);
```

### Moving Files

```ts
// Rename/move
fileSystem.rename("/components/Button.jsx", "/ui/Button.jsx");
// Old path deleted, new path created with same content
```

### Deleting Files/Directories

```ts
// Delete file
fileSystem.deleteFile("/components/Button.jsx");

// Delete directory (recursive)
fileSystem.deleteFile("/components");
```

## Testing

Example from [src/lib/__tests__/file-system.test.ts](src/lib/__tests__/file-system.test.ts):

```ts
import { VirtualFileSystem } from "../file-system";

test("creates file with parent directories", () => {
  const fs = new VirtualFileSystem();
  fs.createFile("/components/ui/Button.jsx", "content");
  
  expect(fs.getFile("/components")).toBeDefined();
  expect(fs.getFile("/components/ui")).toBeDefined();
  expect(fs.getFile("/components/ui/Button.jsx")?.content).toBe("content");
});
```

## Pitfalls to Avoid

- **Assuming disk I/O**: Files are never written to disk — only stored in memory and database
- **Forgetting serialization**: Changes only persist if serialized and saved to database
- **Path variations**: Always use forward slashes, or let file system normalize
- **Missing refresh**: In React, call `refreshFiles()` after mutations to trigger re-render
- **Concurrent modifications**: File system is not thread-safe (single request only)
- **Large files**: No size limits enforced — be cautious with huge content

## Data Flow

```
User Input → Chat Context
             ↓
          Serialize files → POST /api/chat
                            ↓
                         Deserialize → VirtualFileSystem
                            ↓
                         AI Tools execute → Modify file system
                            ↓
                         Serialize → Database
                            ↓
          Response stream → Chat Context
             ↓
          Update React state → UI refresh
```

## Related Files

- Class implementation: [src/lib/file-system.ts](src/lib/file-system.ts)
- React context: [src/lib/contexts/file-system-context.tsx](src/lib/contexts/file-system-context.tsx)
- Tests: [src/lib/__tests__/file-system.test.ts](src/lib/__tests__/file-system.test.ts)
- AI tools: [src/lib/tools/str-replace.ts](src/lib/tools/str-replace.ts), [src/lib/tools/file-manager.ts](src/lib/tools/file-manager.ts)
