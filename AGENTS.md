# UIGen — AI Agent Instructions

AI-powered React component generator with live preview. See [README.md](README.md) for project overview.

## Quick Start

```bash
# First time setup
npm run setup              # Install deps + Prisma generate + migrations

# Development
npm run dev                # Start dev server (Turbopack)
npm test                   # Run tests (Vitest)

# Database
npm run db:reset           # Reset database
```

⚠️ **Never run `npm audit fix`** — dependencies are pinned to compatible versions. Audit warnings are cosmetic for this local-only project.

## Architecture Patterns

### App Router & Component Boundaries
- **Server components** (default): Pages, layouts, server actions
- **Client components**: All interactive UI marked with `"use client"`
- **Dynamic routes**: Use promise-based params: `params: Promise<{ projectId: string }>`
- **Path alias**: `@/*` maps to `src/*`

### Virtual File System (Non-Standard)
- **In-memory only**: [src/lib/file-system.ts](src/lib/file-system.ts) implements `VirtualFileSystem` class with Map-based storage
- **No disk I/O**: Files are serialized as JSON and passed through chat API
- **Tool integration**: File system reconstructed server-side in `/api/chat` before tool execution
- **Key methods**: `createFile()`, `updateFile()`, `deleteFile()`, `replaceInFile()`, `insertInFile()`, `serialize()`/`deserialize()`

### AI Integration (Claude)
- **Provider**: [src/lib/provider.ts](src/lib/provider.ts) — uses `claude-haiku-4-5` via `@ai-sdk/anthropic`
- **Mock mode fallback**: If `ANTHROPIC_API_KEY` not set or still placeholder, returns `MockLanguageModel` with canned Counter/Form/Card components
- **Tools**: 
  - `str_replace_editor`: View/create/edit files (commands: view, create, str_replace, insert — no undo)
  - `file_manager`: Rename/delete files
- **Cache control**: System prompt uses Anthropic-specific `cacheControl: { type: "ephemeral" }` for efficiency
- **Max steps**: 40 for real API, 4 for mock (prevents infinite loops)
- **System prompt**: [src/lib/prompts/generation.tsx](src/lib/prompts/generation.tsx) — keeps responses brief, uses Tailwind, `/App.jsx` as root
- **API route**: [src/app/api/chat/route.ts](src/app/api/chat/route.ts) deserializes file system, streams responses, persists on completion
- **Message handling**: Uses `appendResponseMessages()` from AI SDK to merge conversation history (filters out system messages before save)

For detailed Claude integration guidance, see [.github/copilot-skills/claude-integration.md](.github/copilot-skills/claude-integration.md)

### Authentication (Optional)
- **JWT-based**: [src/lib/auth.ts](src/lib/auth.ts) using `jose` library, httpOnly cookies (7-day expiry)
- **Anonymous mode**: Projects can exist without `userId` (nullable in schema)
- **Anonymous storage**: Uses localStorage ([src/lib/anon-work-tracker.ts](src/lib/anon-work-tracker.ts)) before sign-up
- **Session validation**: Server actions call `getSession()` at entry point

### Data Layer
- **Prisma + SQLite**: Schema at [prisma/schema.prisma](prisma/schema.prisma)
- **Generated client**: Lives in `src/generated/prisma/` (auto-imported)
- **Models**: `User` (email + password) → `Project` (messages, data)
- **JSON serialization**: Complex data stored as strings in `messages` and `data` fields
- **Ownership filter**: All queries filter by `userId` for security

### State Management
- **ChatContext**: Wraps AI SDK's `useChat()`, manages tool calls and file system state
- **FileSystemContext**: Manages virtual file system, selected file, triggers UI refreshes
- **Tool flow**: AI → tool call → `handleToolCall()` → FileSystemContext update → UI refresh

## Testing Conventions

- **Framework**: Vitest + jsdom environment
- **Libraries**: `@testing-library/react` v16, `@testing-library/user-event` v14
- **File location**: Place tests in `__tests__/` directories adjacent to components
- **Naming**: `component.tsx` → `__tests__/component.test.tsx`
- **Mocking**: Use `vi.mock()` for contexts and heavy dependencies
- **User events**: Use `userEvent` (not `fireEvent`) for interactions
- **Cleanup**: Always call `cleanup()` in `afterEach()`
- **Queries**: Prefer semantic queries (`screen.getByRole()`) over test IDs

## Component Organization

```
src/
  app/              # Next.js pages (server components by default)
  actions/          # Server actions ("use server")
  components/
    ui/             # Radix UI primitives (button, dialog, tabs, etc.)
    auth/           # SignIn/SignUp forms
    chat/           # ChatInterface, MessageList, MessageInput, MarkdownRenderer
    editor/         # FileTree, CodeEditor (Monaco)
    preview/        # PreviewFrame (iframe-based)
  lib/
    contexts/       # ChatContext, FileSystemContext
    tools/          # AI tool implementations
    prompts/        # System prompts for AI
```

## Key Conventions

- **Component naming**: PascalCase file names matching exports
- **Server imports**: Files with `"use server"` import `server-only` to prevent client bundling
- **Tool results**: Use AI SDK's `appendResponseMessages()` to merge AI and tool responses
- **Path normalization**: File system uses forward slashes, root-relative paths
- **UI library**: Radix UI primitives styled with Tailwind CSS v4
- **Markdown rendering**: `react-markdown` for chat responses

## Pitfalls to Avoid

- Running `npm audit fix` (breaks pinned dependencies)
- Assuming files are written to disk (they're virtual)
- Forgetting `"use client"` for interactive components
- Direct database access without `userId` filtering
- Using `fireEvent` instead of `userEvent` in tests
- Calling tool functions from client components (they're server-side)

## Related Documentation

- Project overview: [README.md](README.md)
- Database schema: [prisma/schema.prisma](prisma/schema.prisma)
- Testing config: [vitest.config.mts](vitest.config.mts)
- TypeScript config: [tsconfig.json](tsconfig.json)
