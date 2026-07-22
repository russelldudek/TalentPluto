import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = 'http://127.0.0.1:4173';
const screenshots = 'qa/screenshots';
const findingsPath = 'qa/browser-findings.txt';
await fs.mkdir(screenshots, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];
const record = (ok, message) => { if (!ok) failures.push(message); };
const meaningfulFailure = request => !request.url().toLowerCase().endsWith('.pdf');

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
  page.on('requestfailed', request => { if (meaningfulFailure(request)) failedRequests.push(`${request.url()} :: ${request.failure()?.errorText}`); });
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
      headerSrc: header?.currentSrc || header?.src || '',
      coreSrc: core?.currentSrc || core?.src || '',
      headerBox: box(header),
      coreBox: box(core),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  record(logoState.headerSrc.endsWith('/assets/brand/talentpluto-logo.jpg') && logoState.coreSrc.endsWith('/assets/brand/talentpluto-logo.jpg'), `${name}: native supplied JPEG was not used`);
  record(logoState.headerNatural === 200 && logoState.coreNatural === 200, `${name}: supplied 200x200 logo did not paint`);
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
    const failedRequests = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('requestfailed', request => { if (meaningfulFailure(request)) failedRequests.push(`${request.url()} :: ${request.failure()?.errorText}`); });
    const response = await page.goto(`${base}/${route}`, { waitUntil: 'networkidle' });
    record(response?.ok(), `${route} ${name}: returned ${response?.status()}`);
    record(await page.locator('.preview').isVisible(), `${route} ${name}: preview surface missing`);
    record(await page.locator('.document-summary').isVisible(), `${route} ${name}: document summary missing`);
    const logo = await page.locator('.brand-lockup img').evaluate(img => ({ naturalWidth: img.naturalWidth, src: img.currentSrc || img.src }));
    record(logo.naturalWidth === 200 && logo.src.endsWith('/assets/brand/talentpluto-logo.jpg'), `${route} ${name}: native TalentPluto logo did not paint`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    record(overflow <= 1, `${route} ${name}: horizontal overflow ${overflow}px`);
    if (width <= 700) {
      record(await page.locator('.mobile-fallback').isVisible(), `${route} ${name}: mobile document fallback missing`);
      record(!(await page.locator('.frame').isVisible()), `${route} ${name}: embedded PDF should be hidden on mobile`);
    } else {
      record(await page.locator('.frame').isVisible(), `${route} ${name}: desktop PDF preview missing`);
    }
    const pdfHref = await page.locator('a[download][href$=".pdf"]').first().getAttribute('href');
    const pdfResponse = await page.request.get(`${base}/${pdfHref}`);
    record(pdfResponse.ok(), `${route} ${name}: PDF returned ${pdfResponse.status()}`);
    record(errors.length === 0, `${route} ${name}: console errors: ${errors.join(' | ')}`);
    record(failedRequests.length === 0, `${route} ${name}: failed requests: ${failedRequests.join(' | ')}`);
    if (name === 'narrow') await page.screenshot({ path: `${screenshots}/${route.replace('.html','')}-narrow.png`, fullPage: true });
    await page.close();
  }
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${base}/resume.html`, { waitUntil: 'networkidle' });
  record(await page.locator('a[href="cover-letter.html"]').first().isVisible(), 'resume lacks visible cover-letter navigation');
  record(await page.locator('a[download][href$="Resume.pdf"]').count() >= 1, 'resume lacks native PDF download');
  await page.goto(`${base}/cover-letter.html`, { waitUntil: 'networkidle' });
  record(await page.locator('a[href="resume.html"]').first().isVisible(), 'cover letter lacks visible resume navigation');
  record(await page.locator('a[download][href$="Cover-Letter.pdf"]').count() >= 1, 'cover letter lacks native PDF download');
  await page.close();
}

await browser.close();
await fs.writeFile(findingsPath, failures.join('\n'), 'utf8');
if (failures.length) {
  console.error(`QA failed with ${failures.length} finding(s):`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Rendered QA passed: native supplied logo, five homepage viewports, interactions, reduced motion, document routes, navigation, and downloads.');
