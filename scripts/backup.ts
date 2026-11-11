import './env';
import { PGlite } from '@electric-sql/pglite';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const directory = process.env.PGLITE_DATA_DIR || './data/studytrack';
try {
  await access(path.join(directory, 'PG_VERSION'));
} catch {
  throw new Error('База не найдена. Проверьте PGLITE_DATA_DIR и сначала запустите приложение.');
}
const db = new PGlite(directory);
try {
  await db.waitReady;
  await mkdir('backups', { recursive: true });
  const file = `backups/studytrack-${Date.now()}.tar.gz`;
  await writeFile(file, Buffer.from(await (await db.dumpDataDir('gzip')).arrayBuffer()));
  console.log(file);
} finally {
  await db.close();
}
