import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve(process.cwd(), 'apps/checkout-portal/src/views/checkout.html');
const dest = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : src;

console.log('Verifying / Syncing checkout.html...');
if (src !== dest) {
  fs.copyFileSync(src, dest);
  const stat = fs.statSync(dest);
  console.log(`[✓] Successfully synced checkout.html (${stat.size} bytes) to ${dest}`);
} else {
  const stat = fs.statSync(src);
  console.log(`[✓] checkout.html verified (${stat.size} bytes) at ${src}`);
}
