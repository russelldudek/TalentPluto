import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = (process.env.SITE_BASE || 'http://127.0.0.1:4173').replace(/\/$/, '');
const screenshots = process.env.QA_SCREENSHOTS || 'qa/screenshots';
const findingsPath = process.env.QA_FINDINGS || 'qa/browser-findings.txt';
await fs.mkdir(screenshots, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];
const record = (ok, message) => { if (!ok) failures.push(message); };
const meaningfulFailure = request => !request.url().toLowerCase().endsWith('.pdf');
const homeViewports = [
  ['desktop', 1440, 900], ['laptop', 1280, 800], ['tablet', 768, 1024], ['mobile', 390, 844], ['narrow', 320, 800],
];

for (const [name, width, height] of homeViewports) {
  const page = await browser.newPage({ viewport: { width, height } });
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('requestfailed', request => { if (meaningfulFailure(request)) failedRequests.push(`${request.url()} :: ${request.failure()?.errorText}`); });
  const response = await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  record(response?.ok(), `${name}: homepage returned ${response?.status()}`);
  const state = await page.evaluate(() => {
    const header = document.querySelector('.identity img');
    const core = document.querySelector('.orbit-core img');
    const prototype = document.querySelector('.node-prototype').getBoundingClientRect();
    const caption = document.querySelector('.system-caption').getBoundingClientRect();
    return {
      headerNatural: header?.naturalWidth || 0,
      coreNatural: core?.naturalWidth || 0,
      headerSrc: header?.currentSrc || header?.src || '',
      coreSrc: core?.currentSrc || core?.src || '',
      gap: caption.top - prototype.bottom,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  record(state.headerSrc.endsWith('/assets/brand/talentpluto-logo.jpg') && state.coreSrc.endsWith('/assets/brand/talentpluto-logo.jpg'), `${name}: native supplied JPEG was not used`);
  record(state.headerNatural === 200 && state.coreNatural === 200, `${name}: supplied 200x200 logo did not paint`);
  record(state.gap >= 20, `${name}: Prototype card and caption overlap; gap ${state.gap}px`);
  record(state.overflow <= 1, `${name}: horizontal overflow ${state.overflow}px`);
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
  await buttons.nth(2).click(); await buttons.nth(0).click(); await buttons.nth(3).click();
  record(await buttons.nth(3).getAttribute('aria-pressed') === 'true', 'rapid selection did not settle on final request');
  record((await page.locator('#postureValue').textContent())?.includes('Bound the exception'), 'rapid selection left stale output');
  record(await page.locator('.translation-stage.active').count() === 1, 'scenario update left mixed active stages');
  await buttons.nth(0).focus(); await page.keyboard.press('ArrowRight');
  record(await buttons.nth(1).getAttribute('aria-pressed') === 'true', 'keyboard scenario navigation failed');
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  record(await page.locator('.signal').first().evaluate(el => getComputedStyle(el).display) === 'none', 'reduced motion did not remove orbit packets');
  await page.close();
}

const documentRoutes = [
  ['resume.html', 2], ['cover-letter.html', 1], ['interview-brief.html', 2], ['entry-plan.html', 2], ['client-product-brief.html', 2],
];
for (const [route, expectedPapers] of documentRoutes) {
  for (const [name, width, height] of [['desktop',1280,800],['tablet',768,1024],['mobile',390,844],['narrow',320,800]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    const failedRequests = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('requestfailed', request => { if (meaningfulFailure(request)) failedRequests.push(`${request.url()} :: ${request.failure()?.errorText}`); });
    const response = await page.goto(`${base}/${route}`, { waitUntil: 'networkidle' });
    record(response?.ok(), `${route} ${name}: returned ${response?.status()}`);
    const geometry = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      papers: document.querySelectorAll('.paper').length,
      iframes: document.querySelectorAll('iframe').length,
      textLength: document.querySelector('main')?.innerText.trim().length || 0,
      logoNatural: document.querySelector('.doc-logo')?.naturalWidth || 0,
      logoSrc: document.querySelector('.doc-logo')?.currentSrc || '',
    }));
    record(geometry.papers === expectedPapers, `${route} ${name}: expected ${expectedPapers} online paper surfaces, got ${geometry.papers}`);
    record(geometry.iframes === 0, `${route} ${name}: browser PDF pane remains`);
    record(geometry.textLength > 500, `${route} ${name}: visible online document is blank`);
    record(geometry.logoNatural === 200 && geometry.logoSrc.endsWith('/assets/brand/talentpluto-logo.jpg'), `${route} ${name}: supplied logo did not paint`);
    record(geometry.overflow <= 1, `${route} ${name}: horizontal overflow ${geometry.overflow}px`);
    if (route === 'cover-letter.html') record(geometry.textLength > 1800, `${route} ${name}: cover letter is blank or incomplete`);
    const pdfHref = await page.locator('a[download][href$=".pdf"]').first().getAttribute('href');
    record(Boolean(pdfHref), `${route} ${name}: native PDF download missing`);
    if (pdfHref) {
      const pdfResponse = await page.request.get(`${base}/${pdfHref}`);
      record(pdfResponse.ok(), `${route} ${name}: PDF returned ${pdfResponse.status()}`);
    }
    record(errors.length === 0, `${route} ${name}: console errors: ${errors.join(' | ')}`);
    record(failedRequests.length === 0, `${route} ${name}: failed requests: ${failedRequests.join(' | ')}`);
    if (name === 'desktop' || name === 'narrow') await page.screenshot({ path: `${screenshots}/${route.replace('.html','')}-${name}.png`, fullPage: true });
    await page.close();
  }
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${base}/resume.html`, { waitUntil: 'networkidle' });
  record(await page.locator('a[href="cover-letter.html"]').first().isVisible(), 'resume lacks visible cover-letter navigation');
  await page.goto(`${base}/cover-letter.html`, { waitUntil: 'networkidle' });
  record(await page.locator('a[href="resume.html"]').first().isVisible(), 'cover letter lacks visible resume navigation');
  await page.close();
}

await browser.close();
await fs.writeFile(findingsPath, failures.join('\n'), 'utf8');
if (failures.length) {
  console.error(`QA failed with ${failures.length} finding(s):`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Rendered QA passed: no PDF panes, visible online documents, hero clearance, exact logo, responsive reflow, interaction, navigation, and downloads.');
