import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const base = (process.env.SITE_BASE || 'http://127.0.0.1:4173').replace(/\/$/, '');
const sources = [
  'documents.css', 'brand-tokens.css', 'assets/brand/talentpluto-logo.jpg',
  'resume.html', 'cover-letter.html', 'interview-brief.html', 'entry-plan.html', 'client-product-brief.html',
];
const outputs = [
  ['resume.html', 'docs/Russell-Dudek-TalentPluto-Resume.pdf'],
  ['cover-letter.html', 'docs/Russell-Dudek-TalentPluto-Cover-Letter.pdf'],
  ['interview-brief.html', 'docs/Russell-Dudek-TalentPluto-Interview-Brief.pdf'],
  ['entry-plan.html', 'docs/Russell-Dudek-TalentPluto-90-Day-Plan.pdf'],
  ['client-product-brief.html', 'docs/Russell-Dudek-TalentPluto-Client-Delta-Atlas.pdf'],
];

const hash = crypto.createHash('sha256');
for (const source of sources) {
  hash.update(source);
  hash.update(await fs.readFile(path.join(root, source)));
}
const digest = hash.digest('hex');
const marker = path.join(root, 'docs', '.source-hash');
let current = '';
try { current = (await fs.readFile(marker, 'utf8')).trim(); } catch {}
const allOutputsExist = await Promise.all(outputs.map(async ([, output]) => {
  try { await fs.access(path.join(root, output)); return true; } catch { return false; }
}));
if (current === digest && allOutputsExist.every(Boolean)) {
  console.log(`PDF sources unchanged: ${digest}`);
  process.exit(0);
}

await fs.mkdir(path.join(root, 'docs'), { recursive: true });
const browser = await chromium.launch({ headless: true });
for (const [route, output] of outputs) {
  const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
  await page.emulateMedia({ media: 'print' });
  const response = await page.goto(`${base}/${route}`, { waitUntil: 'networkidle' });
  if (!response?.ok()) throw new Error(`${route} returned ${response?.status()}`);
  await page.pdf({
    path: path.join(root, output),
    width: '8.5in',
    height: '11in',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await page.close();
  console.log(`Generated ${output}`);
}
await browser.close();
await fs.writeFile(marker, `${digest}\n`, 'utf8');
console.log(`Recorded PDF source hash ${digest}`);
