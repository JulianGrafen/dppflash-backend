#!/usr/bin/env node
/**
 * Deploy 100 % readiness demo DPP to the running Next server store.
 *
 * Usage:
 *   npm run dev
 *   npm run deploy:demo-dpp
 *
 * Optional: DEPLOY_URL=http://localhost:3000
 */

const baseUrl = (process.env.DEPLOY_URL ?? 'http://localhost:3000').replace(/\/$/, '');

async function main() {
  const res = await fetch(`${baseUrl}/api/dashboard/v2/demo-deploy`, { method: 'POST' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    console.error('Deploy failed:', res.status, body);
    process.exit(1);
  }
  console.log('Demo DPP deployed.');
  console.log('  Pass ID:   ', body.passId);
  console.log('  Public URL:', body.publicUrl);
  console.log('  Editor:    ', `${baseUrl}${body.editorPath}`);
  console.log('');
  console.log('Optional — seed browser draft (devtools on app origin):');
  console.log(
    "  import { seedDemoReady100Draft } from '@/app/dashboard/v2/mock/storage'; seedDemoReady100Draft();",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
