const fs = require('fs');
const path = require('path');

const targetPath = path.join(process.cwd(), 'src', 'lib', 'SunoApi.ts');
let source = fs.readFileSync(targetPath, 'utf8');

const oldLine = "await page.waitForResponse('**/api/project/**\\\\?**', { timeout: 60000 }); // wait for song list API call";
const newLine = "await page.waitForResponse('**/api/project/**\\\\?**', { timeout: 10000 }).catch(() => logger.warn('Suno project API did not fire; continuing with captcha trigger.')); // non-blocking song list wait";

if (!source.includes(oldLine)) {
  console.log('[patch-suno-project-wait] Target line not found. No patch applied.');
  process.exit(0);
}

source = source.replace(oldLine, newLine);
fs.writeFileSync(targetPath, source, 'utf8');
console.log('[patch-suno-project-wait] Applied non-blocking Suno project wait patch.');
