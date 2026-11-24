import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const entry = resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
// Keep browser tests independent of the developer's actual cloud credentials.
const cloud = process.argv.includes('--cloud');
const child = spawn(process.execPath, [entry, '--host', '127.0.0.1', '--port', cloud ? '5176' : '5174', '--strictPort'], { stdio: 'inherit', env: { ...process.env, VITE_SUPABASE_URL: cloud ? 'https://abcdefghijklmnopqrst.supabase.co' : '', VITE_SUPABASE_PUBLISHABLE_KEY: cloud ? 'sb_publishable_browser_test_only' : '' } });
process.on('SIGINT', () => child.kill()); process.on('SIGTERM', () => child.kill()); child.on('exit', code => process.exit(code || 0));
