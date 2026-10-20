import { execFileSync } from 'node:child_process';
import { resetDatabase } from './helpers';

const NOT_RUNNING = 'Supabase local no está corriendo: ejecuta npm run db:start';

// `supabase status -o json` key -> environment variable read by helpers.ts.
const KEYS = {
  API_URL: 'LIGHT_SB_URL',
  PUBLISHABLE_KEY: 'LIGHT_SB_PUBLISHABLE_KEY',
  SERVICE_ROLE_KEY: 'LIGHT_SB_SERVICE_KEY',
} as const;

/**
 * Reads the URL and keys of the running local stack and hands them to the test workers through `process.env`.
 * The returned teardown empties the stack again: the pgTAP tests (`npm run db:test`) assume no other players exist.
 */
export default function setup(): () => Promise<void> {
  let status: Record<string, unknown>;
  try {
    const output = execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 60_000,
    });
    // The CLI can print notices before the JSON.
    status = JSON.parse(output.slice(output.indexOf('{')));
  } catch {
    throw new Error(NOT_RUNNING);
  }

  for (const [key, variable] of Object.entries(KEYS)) {
    const value = status[key];
    if (typeof value !== 'string' || value === '') {
      throw new Error(`"supabase status -o json" no devolvió ${key}`);
    }
    process.env[variable] = value;
  }

  return resetDatabase;
}
