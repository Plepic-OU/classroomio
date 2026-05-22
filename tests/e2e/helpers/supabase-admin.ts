import { execSync } from 'node:child_process';

const CONTAINER = 'supabase_db_classroomio';

export function userExistsInAuth(email: string): boolean {
  const sql = `SELECT 1 FROM auth.users WHERE email = '${email.replace(/'/g, "''")}' LIMIT 1;`;
  const out = execSync(`docker exec -i ${CONTAINER} psql -U postgres -tA`, {
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).toString();
  return out.trim() === '1';
}
