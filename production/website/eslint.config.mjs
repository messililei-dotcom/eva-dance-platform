import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  // Existing React 18 pages do not opt into React Compiler. Surface migration
  // guidance as warnings while retaining rules-of-hooks as an error.
  { rules: {
    'react-hooks/set-state-in-effect': 'warn',
    'react-hooks/refs': 'warn',
    'react-hooks/purity': 'warn',
  } },
  globalIgnores(['.next*/**', 'releases/**', 'local-backups/**', 'next-env.d.ts']),
]);
