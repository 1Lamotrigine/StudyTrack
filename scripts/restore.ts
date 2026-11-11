import { PGlite } from '@electric-sql/pglite';
import { readFile, access, mkdir } from 'node:fs/promises';
import path from 'node:path';
const [file, destination] = process.argv.slice(2);
if (!file || !destination)
  throw new Error('Использование: npm run db:restore -- backups/file.tar.gz ./data/restored');
let exists = false;
try {
  await access(destination);
  exists = true;
} catch {}
if (exists) throw new Error('Каталог назначения уже существует. Выберите новый каталог.');
await mkdir(path.dirname(path.resolve(destination)), { recursive: true });
const db = new PGlite(destination, { loadDataDir: new Blob([await readFile(file)]) });
await db.waitReady;
await db.close();
console.log('Восстановлено в ' + destination);
