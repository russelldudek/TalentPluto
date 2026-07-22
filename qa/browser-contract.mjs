import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = 'http://127.0.0.1:4173';
const screenshots = 'qa/screenshots';
const findingsPath = 'qa/browser-findings.txt';
await fs.mkdir(screenshots, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];
const record = (ok, message) => { if (!ok) failures.push(message); };

const homeViewports = [
  ['desktop', 1440, 900],
  ['laptop', 1280, 800],
  ['tablet', 768, 1024],
  ['mobile', 390, 844],
  ['narrow', 320, 800],
];

for (const [name, width, height] of homeViewports) {
  const page = await browser.newPage({ viewport: { width, height } });
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('requestfailed', request => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText}`));
  const response = await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  record(response?.ok(), `${name}: homepage returned ${response?.status()}`);
  record((await page.title()).includes('Strategy & Operations Associate'), `${name}: wrong page title`);
  record(await page.locator('h1').isVisible(), `${name}: hero heading not visible`);
  record(await page.locator('.identity img').isVisible(), `${name}: header TalentPluto logo not visible`);
  record(await page.locator('.orbit-core img').isVisible(), `${name}: hero TalentPluto logo not visible`);
  const logoState = await page.evaluate(() => {
    const header = document.querySelector('.identity img');
    const core = document.querySelector('.orbit-core img');
    const box = el => el?.getBoundingClientRect();
    return {
      headerNatural: header?.naturalWidth || 0,
      coreNatural: core?.naturalWidth || 0,
      headerBox: box(header),
      coreBox: box(core),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  record(logoState.headerNatural > 0 && logoState.coreNatural > 0, `${name}: logo asset did not paint`);
  record((logoState.headerBox?.width || 0) >= (width <= 640 ? 38 : 44), `${name}: header logo is too small`);
  record((logoState.coreBox?.width || 0) >= (width <= 640 ? 84 : 108), `${name}: hero logo is too small`);
  record(logoState.overflow <= 1, `${name}: horizontal overflow ${logoState.overflow}px`);
  record(consoleErrors.length === 0, `${name}: console errors: ${consoleErrors.join(' | ')}`);
  record(failedRequests.length === 0, `${name}: failed requests: ${failedRequests.join(' | ')}`);
  await page.screenshot({ path: `${screenshots}/home-${name}.png`, fullPage: true });
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  const buttons = page.locator('[data-scenario]');
  record(await buttons.count() === 4, 'scenario control count is not four');
  await buttons.nth(1).click();
  record(await buttons.nth(1).getAttribute('aria-pressed') === 'true', 'attribution scenario did not become authoritative');
  record((await page.locator('#postureValue').textContent())?.includes('attribution layer'), 'attribution posture did not update');
  await buttons.nth(2).click();
  await buttons.nth(0).click();
  await buttons.nth(3).click();
  record(await buttons.nth(3).getAttribute('aria-pressed') === 'true', 'rapid selection did not settle on final request');
  record((await page.locator('#postureValue').textContent())?.includes('Bound the exception'), 'rapid selection left stale output');
  record(await page.locator('.translation-stage.active').count() === 1, 'scenario update left mixed active stages');
  await buttons.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  record(await buttons.nth(1).getAttribute('aria-pressed') === 'true', 'keyboard scenario navigation failed');
  await page.screenshot({ path: `${screenshots}/interaction-attribution.png`, fullPage: false });
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  record(await page.locator('.signal').first().evaluate(el => getComputedStyle(el).display) === 'none', 'reduced motion did not remove orbit packets');
  await page.close();
}

const documentRoutes = ['resume.html','cover-letter.html','interview-brief.html','entry-plan.html','client-product-brief.html'];
for (const route of documentRoutes) {
  for (const [name, width, height] of [['tablet',768,1024],['mobile',390,844],['narrow',320,800]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    const response = await page.goto(`${base}/${route}`, { waitUntil: 'networkidle' });
    record(response?.ok(), `${route} ${name}: returned ${response?.status()}`);
    const geometry = await page.evaluate(() => {
      const sheets = [...document.querySelectorAll('.sheet')];
      const maxOverflow = document.documentElement.scrollWidth - window.innerWidth;
      const clipped = sheets.some(sheet => {
        const rect = sheet.getBoundingClientRect();
        return [...sheet.children].some(child => child.getBoundingClientRect().bottom > rect.bottom + 2);
      });
      return { maxOverflow, clipped, sheets: sheets.length };
    });
    record(geometry.sheets > 0, `${route} ${name}: no document sheets`);
    record(geometry.maxOverflow <= 1, `${route} ${name}: horizontal overflow ${geometry.maxOverflow}px`);
    record(!geometry.clipped, `${route} ${name}: content extends beyond visible sheet`);
    record(errors.length === 0, `${route} ${name}: console errors: ${errors.join(' | ')}`);
    if (name === 'narrow') await page.screenshot({ path: `${screenshots}/${route.replace('.html','')}-narrow.png`, fullPage: true });
    await page.close();
  }
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${base}/resume.html`, { waitUntil: 'networkidle' });
  record(await page.locator('a[href="cover-letter.html"]').isVisible(), 'resume lacks visible cover-letter navigation');
  record(await page.locator('a[download][href$="Resume.pdf"]').count() === 1, 'resume lacks native PDF download');
  await page.goto(`${base}/cover-letter.html`, { waitUntil: 'networkidle' });
  record(await page.locator('a[href="resume.html"]').isVisible(), 'cover letter lacks visible resume navigation');
  record(await page.locator('a[download][href$="Cover-Letter.pdf"]').count() === 1, 'cover letter lacks native PDF download');
  await page.close();
}

await browser.close();
await fs.writeFile(findingsPath, failures.join('\n'), 'utf8');
if (failures.length) {
  console.error(`QA failed with ${failures.length} finding(s):`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Rendered QA passed: logo, five homepage viewports, interactions, reduced motion, document reflow, navigation, and downloads.');
