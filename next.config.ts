import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite'],
  outputFileTracingIncludes: {
    '/*': [
      './db/**/*.sql',
      './sql/**/*.sql',
      './node_modules/@electric-sql/pglite/dist/*.wasm',
      './node_modules/@electric-sql/pglite/dist/*.data',
    ],
  },
};
export default config;
