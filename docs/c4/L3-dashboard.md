# Layer 3: Dashboard Components — ClassroomIO

```mermaid
C4Component
    title Component Diagram - Dashboard

    Container_Boundary(dashboard, "Dashboard (SvelteKit)") {
        Component(routes_root, "Root Routes", "SvelteKit", "Layout, auth pages, onboarding")
        Component(routes_courses, "Course Routes", "SvelteKit", "Course CRUD and detail pages")
        Component(routes_org, "Org Routes", "SvelteKit", "Organization settings pages")
        Component(routes_lms, "LMS Routes", "SvelteKit", "Student learning hub pages")
        Component(routes_api, "API Routes", "SvelteKit", "Server endpoints for courses, email, analytics")
        Component(comp_course, "Course Components", "Svelte", "Course editor, lessons, exercises")
        Component(comp_org, "Org Components", "Svelte", "Org settings, members, billing")
        Component(comp_landing, "Landing Page Components", "Svelte", "Public course landing pages")
        Component(comp_courses, "Course List Components", "Svelte", "Course cards and grid views")
        Component(comp_nav, "Navigation", "Svelte", "Sidebar, topbar, breadcrumbs")
        Component(comp_form, "Form Components", "Svelte", "Form builder and inputs")
        Component(comp_question, "Question Components", "Svelte", "Quiz question types")
        Component(comp_apps, "Apps Components", "Svelte", "Third-party app integrations")
        Component(comp_icons, "Icons", "Svelte", "Custom icon library")
        Component(comp_analytics, "Analytics Components", "Svelte", "Dashboard charts and stats")
        Component(comp_ui, "UI Utilities", "Svelte", "Modal, Snackbar, Chip, Buttons, etc.")
        Component(services, "Services", "TypeScript", "API client modules for all entities")
        Component(functions, "Functions", "TypeScript", "50+ utility functions")
        Component(store, "Stores", "Svelte", "User, org, app state management")
        Component(types, "Types", "TypeScript", "Shared type definitions")
        Component(constants, "Constants", "TypeScript", "App-wide constants")
        Component(translations, "Translations", "sveltekit-i18n", "i18n for 11+ languages")
    }

    Container_Ext(api, "API", "Hono", "File uploads, PDFs, emails")
    SystemDb_Ext(supabase, "Supabase", "PostgreSQL + Auth")

    Rel(routes_root, store, "Reads/writes state")
    Rel(routes_root, functions, "Uses utilities")
    Rel(routes_courses, functions, "Uses utilities")
    Rel(routes_org, functions, "Uses utilities")
    Rel(routes_api, functions, "Uses utilities")
    Rel(routes_api, services, "Calls services")

    Rel(services, functions, "Uses utilities")
    Rel(services, constants, "Uses constants")
    Rel(services, store, "Updates state")
    Rel(services, types, "Uses types")
    Rel(functions, constants, "Uses constants")
    Rel(functions, store, "Reads state")
    Rel(store, types, "Uses types")
    Rel(store, constants, "Uses constants")

    Rel(comp_course, functions, "Uses utilities")
    Rel(comp_course, constants, "Uses constants")
    Rel(comp_course, types, "Uses types")
    Rel(comp_courses, functions, "Uses utilities")

    Rel(services, supabase, "CRUD operations")
    Rel(routes_api, api, "File ops, PDFs, emails")

    UpdateLayoutConfig(4, 2)
```
