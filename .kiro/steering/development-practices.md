# Development Practices

## Third-Party Package Usage

**Use Context7 MCP server when uncertain about third-party packages.**

- For well-established packages you're confident about (TypeScript, Zod, etc.), you can proceed directly
- When unsure about API signatures, usage patterns, or newer packages:
  - Use the `mcp_Context7_resolve_library_id` tool to find the correct library
  - Use the `mcp_Context7_get_library_docs` tool to get up-to-date documentation
- This prevents hallucinations and ensures accurate implementation based on actual docs

## Task Planning Workflow

**Before starting any task implementation, outline the approach and get approval.**

When a user clicks "Start Task":

1. **Read the task requirements** from the spec documents (requirements.md, design.md, tasks.md)
2. **Create a mental outline** covering:
   - Key implementation points to address
   - Technical approach and architecture decisions
   - Dependencies and integration points
   - Potential challenges or considerations
   - Order of implementation steps
3. **Present the outline** with brief explanations for each point
4. **Ask for approval** before proceeding with implementation
5. **Wait for explicit "yes"** - do not proceed if there are questions or concerns

This ensures alignment on approach before coding begins and prevents wasted effort on incorrect implementations.

## Implementation Philosophy

**Keep implementations simple, robust, and not overengineered.**

- **Safe**: Follow established patterns and best practices
- **Sound**: Ensure the solution is technically correct and maintainable
- **Simple**: Choose the most straightforward approach that meets requirements
- Avoid elaborate architectures when simpler solutions work
- Prefer clarity and readability over clever optimizations
- Build what's needed, not what might be needed someday
