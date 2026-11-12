import { PGlite } from '@electric-sql/pglite';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { usesEphemeralDatabase } from './runtime';
import { ensureDefaultUsers } from './default-users';
export type Row = Record<string, any>;
export async function initialize(db: PGlite) {
  await db.waitReady;
  const exists = (
    await db.query<{ exists: string | null }>(
      "SELECT to_regclass('public.schema_migrations')::text AS exists",
    )
  ).rows[0].exists;
  if (!exists) {
    const files = [
      '01_schema.sql',
      '02_seed.sql',
      '03_objects.sql',
      '03b_admin_objects.sql',
      '05_indexes.sql',
    ];
    await db.transaction(async (tx) => {
      for (const file of files) {
        const sql = (await readFile(path.join(process.cwd(), 'db', file), 'utf8'))
          .replace(/^\\.*$/gm, '')
          .replace(/^BEGIN;\s*$/gm, '')
          .replace(/^COMMIT;\s*$/gm, '');
        await tx.exec(sql);
      }
      await tx.exec(`CREATE TABLE schema_migrations(version integer PRIMARY KEY); INSERT INTO schema_migrations VALUES (1);
      CREATE TABLE web_sessions(token text PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL);
      CREATE OR REPLACE FUNCTION prevent_category_cycle() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.parent_id IS NOT NULL AND EXISTS (WITH RECURSIVE ancestors AS (SELECT id,parent_id FROM course_categories WHERE id=NEW.parent_id UNION SELECT c.id,c.parent_id FROM course_categories c JOIN ancestors a ON c.id=a.parent_id) SELECT 1 FROM ancestors WHERE id=NEW.id) THEN RAISE EXCEPTION 'Цикл в иерархии категорий запрещён'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER category_cycle BEFORE INSERT OR UPDATE ON course_categories FOR EACH ROW EXECUTE FUNCTION prevent_category_cycle();`);
    });
  }
  const applied = new Set(
    (await db.query<{ version: number }>('SELECT version FROM schema_migrations')).rows.map(
      (r) => r.version,
    ),
  );
  for (const [version, file] of [
    [2, '002_product_rules.sql'],
    [3, '003_consistent_reports.sql'],
  ] as const) {
    if (applied.has(version)) continue;
    const sql = await readFile(path.join(process.cwd(), 'db', 'migrations', file), 'utf8');
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query('INSERT INTO schema_migrations VALUES($1)', [version]);
    });
  }
  await ensureDefaultUsers(db);
  return db;
}
const SCHEMA_REVISION = 4;
const globals = globalThis as unknown as {
  studytrackDb?: Promise<PGlite>;
  studytrackSchema?: number;
};
export function getDb() {
  if (!globals.studytrackDb) {
    globals.studytrackSchema = SCHEMA_REVISION;
    globals.studytrackDb = (async () => {
      let db: PGlite;
      if (usesEphemeralDatabase()) {
        db = new PGlite();
      } else {
        const dir = path.resolve(
          /* turbopackIgnore: true */ process.env.PGLITE_DATA_DIR ||
            path.join(process.cwd(), 'data', 'studytrack'),
        );
        await mkdir(path.dirname(dir), { recursive: true });
        db = new PGlite(dir);
      }
      try {
        return await initialize(db);
      } catch (error) {
        await db.close();
        throw error;
      }
    })();
  } else if (globals.studytrackSchema !== SCHEMA_REVISION) {
    // Reuse the live connection during HMR, but still apply new migrations.
    globals.studytrackSchema = SCHEMA_REVISION;
    globals.studytrackDb = globals.studytrackDb.then(initialize);
  }
  return globals.studytrackDb.catch((error) => {
    globals.studytrackDb = undefined;
    globals.studytrackSchema = undefined;
    throw error;
  });
}
export async function query<T extends Row = Row>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await (await getDb()).query<T>(sql, params)).rows;
}
export async function one(sql: string, params: unknown[] = []) {
  return (await query(sql, params))[0];
}
export async function call(name: string, params: unknown[]) {
  if (!/^[a-z_]+$/.test(name)) throw new Error('Invalid procedure');
  return query(`CALL ${name}(${params.map((_, i) => `$${i + 1}`).join(',')})`, params);
}
