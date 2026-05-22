// Compile-time contract for the Hono RPC client.
//
// Design doc: docs/plans/2026-05-15-bdd-coverage-and-self-improving-skill-design.md §2 Wave 5, §5.
// Runtime BDD scenarios cannot catch breakage of the `hc<typeof app>()` chain — that is a
// TypeScript construct only. This file references every Hono route mounted in
// apps/api/src/app.ts so that the dashboard build fails if the chain in app.ts is split
// across statements (which drops the inferred type) or a route is removed/renamed.
//
// Gate: `pnpm typecheck:api-contract` (root package.json) runs tsc against just this file with
// strict mode and bundler module resolution. Also covered by `pnpm build --filter @cio/dashboard`,
// which depends on `@cio/api#build` per turbo.json and runs the full SvelteKit/Vite type-check.
// A project-wide `pnpm typecheck` is impractical today (~167 pre-existing svelte-check errors
// in unrelated files); narrow the scope to this contract instead.
//
// Routes mirrored here (mount points in apps/api/src/app.ts:32–38):
//   GET  /                                       (root welcome)
//   POST /course/download/certificate
//   POST /course/download/content
//   GET  /course/katex
//   POST /course/lesson/download/pdf
//   POST /course/presign/video/upload
//   POST /course/presign/document/upload
//   POST /course/presign/video/download
//   POST /course/presign/document/download
//   POST /course/clone
//   POST /mail/send

import type { Client } from '@cio/api/rpc-types';

// Tuple of every mounted route. Each element is the typed handler for one path; if any
// path is removed from apps/api/src/app.ts or the rpc chain drops its type, tsc fails here.
type _MountedRoutes = [
  Client['index']['$get'],
  Client['course']['download']['certificate']['$post'],
  Client['course']['download']['content']['$post'],
  Client['course']['katex']['$get'],
  Client['course']['lesson']['download']['pdf']['$post'],
  Client['course']['presign']['video']['upload']['$post'],
  Client['course']['presign']['document']['upload']['$post'],
  Client['course']['presign']['video']['download']['$post'],
  Client['course']['presign']['document']['download']['$post'],
  Client['course']['clone']['$post'],
  Client['mail']['send']['$post']
];

// Force TypeScript to evaluate the tuple even though it is unused at runtime.
export type __APIContractCheck = _MountedRoutes;
