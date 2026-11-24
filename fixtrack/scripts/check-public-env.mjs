import { loadEnv } from 'vite';
import { browserConfig } from '../src/lib/config.ts';
const values = loadEnv('production', process.cwd(), 'VITE_');
const forbidden = Object.entries(values).filter(([name, value]) => value && /SECRET|SERVICE_ROLE|ACCESS_TOKEN|DB_PASSWORD/i.test(name));
if (forbidden.length) throw new Error('Private values must not use VITE_ names: ' + forbidden.map(([name]) => name).join(', '));
const config = browserConfig(values.VITE_SUPABASE_URL, values.VITE_SUPABASE_PUBLISHABLE_KEY, false);
// A first deployment may show the setup screen, but a supplied invalid/private key
// must never be compiled into a publicly downloadable JavaScript bundle.
if (values.VITE_SUPABASE_PUBLISHABLE_KEY && config.mode === 'invalid') throw new Error(config.error);
console.log(config.mode === 'connected' ? 'Public Supabase configuration checked.' : 'No publishable key yet: deployed pages will show the setup screen.');
