# C4 Model Conventions

Reference for creating C4 architecture diagrams, based on c4model.com.

## Overview

The C4 model provides four levels of abstraction for describing software architecture:

1. **System Context** (Layer 1) — the big picture
2. **Container** (Layer 2) — high-level technology choices
3. **Component** (Layer 3) — structural building blocks
4. **Code** (Layer 4) — class-level detail (rarely needed)

## Layer 1: System Context

Shows the software system in scope and its relationships with users and other systems.

**Elements:**
- **Person** — a human user of the system (e.g., Teacher, Student, Admin)
- **Software System** — the system being described (shown as a box)
- **External Software System** — systems outside your control that interact with your system

**Guidelines:**
- Keep it simple — this is the "elevator pitch" diagram
- Show who uses the system and what other systems it integrates with
- Don't include technology details at this level
- Typically one diagram per system

## Layer 2: Container

Zooms into the software system to show containers (deployable/runnable units).

**Elements:**
- **Container** — an application or data store (e.g., web app, API, database, message queue)
- **Person** — same as Layer 1 (users interact with containers)
- **External Software System** — same as Layer 1

**Guidelines:**
- A container is something that needs to be running for the system to work
- Show the high-level technology choices (e.g., "SvelteKit app", "Hono API", "PostgreSQL")
- Show how containers communicate (HTTP, WebSocket, SQL, etc.)
- Include port numbers or URLs if helpful

## Layer 3: Component

Zooms into a container to show its major structural building blocks.

**Elements:**
- **Component** — a grouping of related functionality (e.g., "Auth Module", "Course Routes", "Email Service")
- **Container** — sibling containers shown for context
- **External Software System** — external systems this container interacts with

**Guidelines:**
- Components are logical groupings, not individual classes
- Derive from actual code structure (directories, modules, namespaces)
- Show key internal relationships
- Don't try to show every file — focus on major building blocks
- Typically one diagram per container (for the most important containers)

## Relationship Conventions

- Label relationships with verbs: "Uses", "Reads from", "Writes to", "Sends", "Authenticates via"
- Show the direction of the relationship (who initiates)
- Include technology/protocol when helpful: "Makes API calls [HTTPS/JSON]"
- Keep labels concise — if more detail is needed, add a note

## Naming Conventions

- **People**: Use role names (Teacher, Student, Administrator)
- **Systems**: Use proper names (ClassroomIO, Supabase, Cloudflare)
- **Containers**: Use descriptive names with technology (Dashboard [SvelteKit], API [Hono])
- **Components**: Use module/feature names (CourseRoutes, AuthMiddleware, EmailService)

## Boundaries

Use boundaries to group related elements:
- Enterprise boundary — groups systems within an organization
- System boundary — groups containers within a system
- Container boundary — groups components within a container
