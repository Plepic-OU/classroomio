 ---                                                                                                                                                                                                                                                                                                              
Step-by-step Guide: Running E2E Tests & Viewing Reports

Prerequisites

All three services must be running inside the devcontainer before tests will work:

1. Start Supabase (inside devcontainer):                                                                                                                                                                                                                                                                         
   supabase start
2. Start the dev servers (inside devcontainer):                                                                                                                                                                                                                                                                  
   pnpm dev:container
2. Wait until Dashboard (:5173), API (:3002), and Supabase (:54321) are all responding.
3. Install Playwright browsers (one-time, inside devcontainer):                                                                                                                                                                                                                                                  
   cd e2e && pnpm exec playwright install chromium

Running Tests

Option A — Headless (CLI) from the repo root:                                                                                                                                                                                                                                                                    
pnpm test:e2e

Option B — Playwright UI (interactive, great for debugging):                                                                                                                                                                                                                                                     
pnpm test:e2e:ui                                                                                                                                                                                                                                                                                                 
Then open http://localhost:9323 in your host browser. The devcontainer already forwards port 9323.

Viewing the HTML Report

After a headless run, the HTML report is saved to e2e/playwright-report/. To serve it:

cd e2e && pnpm test:ui:report

Then open http://localhost:9400 in your host browser. Port 9400 is also forwarded by the devcontainer.

Port Summary

┌───────┬────────────────────────┐                                                                                                                                                                                                                                                                               
│ Port  │        Service         │           
├───────┼────────────────────────┤                                                                                                                                                                                                                                                                               
│ 5173  │ Dashboard              │
├───────┼────────────────────────┤                                                                                                                                                                                                                                                                               
│ 3002  │ API                    │           
├───────┼────────────────────────┤                                                                                                                                                                                                                                                                               
│ 54321 │ Supabase API           │
├───────┼────────────────────────┤                                                                                                                                                                                                                                                                               
│ 9323  │ Playwright UI          │           
├───────┼────────────────────────┤                                                                                                                                                                                                                                                                               
│ 9400  │ Playwright HTML Report │
└───────┴────────────────────────┘

All these ports are configured in .devcontainer/devcontainer.json under forwardPorts, so they're automatically available on your host.
                                               
---                                                                                                                                                                                                                                                                                                              
Note on the failing test

The course creation test timed out. The screenshot shows it got stuck on the "course type" modal — the selectCourseType locator uses getByRole('button', { name: 'Self Paced' }) but the course type cards may not have the right accessible role/name. This is a test locator issue, not an infrastructure
problem. Want me to fix it?                                                       