---
name: claude-integration
description: Work with Claude AI integration (provider, tools, prompts, mock mode)
applyTo:
  - src/lib/provider.ts
  - src/lib/prompts/**
  - src/lib/tools/**
  - src/app/api/chat/route.ts
---

# Claude AI Integration

Guidance for modifying the Claude AI integration in UIGen.

## Architecture Overview

The AI system has three layers:

1. **Provider Layer** ([src/lib/provider.ts](src/lib/provider.ts))
   - Exports `getLanguageModel()` function
   - Returns `claude-haiku-4-5` via `@ai-sdk/anthropic` if `ANTHROPIC_API_KEY` is set
   - Falls back to `MockLanguageModel` (canned responses) if API key missing/placeholder

2. **Tools Layer** ([src/lib/tools/](src/lib/tools/))
   - `str_replace_editor`: View/create/edit files (no undo support)
   - `file_manager`: Rename/delete files
   - Tools receive `VirtualFileSystem` instance and operate on it directly

3. **Chat API** ([src/app/api/chat/route.ts](src/app/api/chat/route.ts))
   - Deserializes file system from request
   - Injects system prompt with Anthropic cache control
   - Streams responses using `streamText()` from AI SDK
   - Persists messages and files to database on completion

## Key Patterns

### Cache Control (Anthropic-Specific)

System prompt includes cache control for efficiency:

```ts
messages.unshift({
  role: "system",
  content: generationPrompt,
  providerOptions: {
    anthropic: { cacheControl: { type: "ephemeral" } }
  }
});
```

**Important**: Only works with Anthropic models. Other providers ignore this field.

### Mock Provider Behavior

When `ANTHROPIC_API_KEY` is not set:
- Returns `MockLanguageModel` class
- Generates canned Counter/Form/Card components
- Uses step-based logic: counts tool messages to determine conversation state
- Limits `maxSteps: 4` (vs `maxSteps: 40` for real API) to prevent infinite loops

**Key difference**: Mock provider pre-generates entire tool call sequences synchronously, while real API streams responses.

### Tool Implementation Pattern

Tools are built as factories that receive file system instance:

```ts
// In route.ts
const fileSystem = new VirtualFileSystem();
fileSystem.deserializeFromNodes(files);

const result = streamText({
  tools: {
    str_replace_editor: buildStrReplaceTool(fileSystem),
    file_manager: buildFileManagerTool(fileSystem)
  }
});
```

Tools operate on shared file system state. Changes persist through serialization in `onFinish` callback.

### Response Message Handling

Use AI SDK's `appendResponseMessages()` to merge user and AI messages:

```ts
const allMessages = appendResponseMessages({
  messages: [...messages.filter(m => m.role !== "system")],
  responseMessages: response.messages
});
```

**Critical**: Filter out system messages before saving (they're re-injected on each request).

## Modifying Components

### Adding a New Tool

1. Create tool builder in `src/lib/tools/your-tool.ts`:

```ts
import { tool } from "ai";
import { z } from "zod";
import { VirtualFileSystem } from "../file-system";

export function buildYourTool(fileSystem: VirtualFileSystem) {
  return tool({
    description: "What the tool does",
    parameters: z.object({
      // Define parameters
    }),
    execute: async (params) => {
      // Implement logic
    }
  });
}
```

2. Register in [src/app/api/chat/route.ts](src/app/api/chat/route.ts):

```ts
tools: {
  str_replace_editor: buildStrReplaceTool(fileSystem),
  file_manager: buildFileManagerTool(fileSystem),
  your_tool: buildYourTool(fileSystem) // Add here
}
```

### Updating the System Prompt

Edit [src/lib/prompts/generation.tsx](src/lib/prompts/generation.tsx):

- Keep instructions concise and actionable
- Remember: prompt is cached (changes may not take effect immediately in dev)
- All imports must use `@/` alias (not relative paths)
- Root file must be `/App.jsx` with default export

### Switching AI Models

Change `MODEL` constant in [src/lib/provider.ts](src/lib/provider.ts):

```ts
const MODEL = "claude-haiku-4-5";  // Fast, cheap
// or
const MODEL = "claude-sonnet-4-5"; // More capable
```

**Note**: Model must be supported by `@ai-sdk/anthropic` package.

### Extending Mock Provider

Add new component types in `generateMockStream()` method:

1. Add detection logic:
```ts
if (promptLower.includes("your-keyword")) {
  componentType = "your-type";
  componentName = "YourComponent";
}
```

2. Add component template in `getComponentCode()`:
```ts
case "your-type":
  return `export default function YourComponent() { ... }`;
```

## Common Pitfalls

- **Tool results not persisting**: Ensure `onFinish` callback serializes file system correctly
- **Mock provider infinite loops**: Check `maxSteps` is low (4) for mock mode
- **Cache not working**: Cache control only applies to Anthropic models, not others
- **System prompt changes not taking effect**: Clear browser cache or restart dev server
- **Tool errors**: Verify tool returns proper success/error objects matching expected schema
- **Message duplication**: Always filter system messages before saving to database

## Testing AI Features

### Testing with Mock Provider

1. Remove or comment out `ANTHROPIC_API_KEY` in `.env`
2. Run `npm run dev`
3. Create project and send prompts with keywords: "counter", "form", "card"

### Testing with Real API

1. Set valid API key in `.env`: `ANTHROPIC_API_KEY=sk-ant-...`
2. Monitor token usage in Anthropic console
3. Watch for streaming behavior (messages appear character-by-character)

### Debugging Tool Calls

Add logging in `src/app/api/chat/route.ts`:

```ts
onFinish: async ({ response }) => {
  console.log("Final messages:", response.messages);
  console.log("Tool calls:", response.messages.filter(m => m.toolCalls));
  // ... save logic
}
```

## Related Files

- AI SDK docs: https://sdk.vercel.ai/docs
- Anthropic API: https://docs.anthropic.com/
- Virtual file system: [src/lib/file-system.ts](src/lib/file-system.ts)
- Chat context: [src/lib/contexts/chat-context.tsx](src/lib/contexts/chat-context.tsx)
