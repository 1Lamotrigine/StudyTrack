import type { PGlite } from '@electric-sql/pglite';

// Same scrypt hashes as the original SQL seed: credentials remain stable across cold starts.
export const DEFAULT_USERS = [
  {
    login: 'admin',
    password: 'admin123',
    role: 'admin',
    fullName: 'Администратор системы',
    hash: 'scrypt$16384$8$1$LbrgdIVNs6cizfFrafQRdg==$9Se4z2wSyna9uDz3+7+wCKsUCAn7YsLVaxqsw26sJGY=',
  },
  {
    login: 'teacher',
    password: 'teacher123',
    role: 'teacher',
    fullName: 'Иванов Пётр Сергеевич',
    hash: 'scrypt$16384$8$1$CEKzMKS1oO3Rw8sg9C5BHw==$rbzoUOe0yqzY+FUwhGVTOxkQmFPUduFUrCa2gEtZ4Zc=',
  },
  {
    login: 'student',
    password: 'student123',
    role: 'student',
    fullName: 'Кузнецов Алексей Игоревич',
    hash: 'scrypt$16384$8$1$V5hP8KKQRpl9eY+K61ZiFQ==$AaEp8QEaHXSFCAw94YCo332atuvKT1bYsgJxZL63QaU=',
  },
] as const;

export async function ensureDefaultUsers(db: PGlite) {
  await db.transaction(async (tx) => {
    for (const user of DEFAULT_USERS) {
      await tx.query(
        `INSERT INTO users(full_name,email,role,login,password_hash)
      SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS(SELECT 1 FROM users WHERE login=$4) ON CONFLICT(login) DO NOTHING`,
        [user.fullName, `${user.login}@demo.studytrack.local`, user.role, user.login, user.hash],
      );
    }
  });
}
