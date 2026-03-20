import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

function loadEnv(): Record<string, string> {
  // Try e2e/.env first, then fall back to apps/dashboard/.env
  const e2eEnv = path.resolve(__dirname, '..', '.env');
  const dashboardEnv = path.resolve(__dirname, '..', '..', 'apps', 'dashboard', '.env');

  if (fs.existsSync(e2eEnv)) {
    return dotenv.parse(fs.readFileSync(e2eEnv));
  }
  if (fs.existsSync(dashboardEnv)) {
    return dotenv.parse(fs.readFileSync(dashboardEnv));
  }
  return {};
}

const env = loadEnv();

const supabaseUrl = env['PUBLIC_SUPABASE_URL'] || 'http://localhost:54321';
const serviceRoleKey = env['PRIVATE_SUPABASE_SERVICE_ROLE'] || '';

export const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
