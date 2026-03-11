---
name: dev
description: Start the container dev servers for the ClassroomIO project. Use when user says "start dev servers", "run dev", "start the app", "pnpm dev", or asks to launch the development environment.
metadata:
  version: 1.0.0
  category: development
---

# Dev Servers

Start the container dev servers by running `pnpm dev:container` in the background.

## Instructions

### Step 1: Start Dev Servers

Run `pnpm dev:container` in the background from the project root.

### Step 2: Verify Servers

After starting, check the output to confirm all servers are up:

- **Dashboard**: port 5173 (`apps/dashboard`)
- **Website (classroomio-com)**: port 5174 (`apps/classroomio-com`)
- **API**: port 3002 (`apps/api`)

### Restarting an Individual Server

To restart a specific dev server (e.g. the website on port 5174):

1. Find and kill the Vite process:
   ```bash
   ps aux | grep 'vite.*5174' | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null
   ```
2. Clear Vite cache and restart:
   ```bash
   cd /workspaces/classroomio/apps/classroomio-com && rm -rf node_modules/.vite && npx vite dev --port 5174 --host
   ```

Adjust the port and app directory for other servers (dashboard = 5173, etc.).

## Troubleshooting

### Port Already in Use

If a port is already in use, find and kill the process occupying it:

```bash
lsof -i :5173 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null
```

### HMR Not Updating Static Text

Static text in Svelte components gets marked with `data-svelte-h` and won't hot-reload. Wrap text in a Svelte expression:

```svelte
<!-- Won't HMR -->
<h1>Static Text</h1>

<!-- Will HMR -->
<h1>{'Dynamic Text'}</h1>
```
