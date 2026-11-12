/** Vercel functions have no shared, persistent filesystem for an embedded database. */
export function usesEphemeralDatabase(env: Record<string, string | undefined> = process.env) {
  return env.VERCEL === '1' || env.PGLITE_DATA_DIR === 'memory://';
}
