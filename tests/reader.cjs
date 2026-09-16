const { chromium, expect } = require('playwright/test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = http.createServer((request, response) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404).end(); return;
  }
  const type = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.pdf': 'application/pdf' }[path.extname(file)];
  response.writeHead(200, { 'Content-Type': type || 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
    await page.addInitScript(() => {
      const request = window.requestAnimationFrame.bind(window);
      const cancel = window.cancelAnimationFrame.bind(window);
      window.pendingFrames = new Set();
      window.requestAnimationFrame = callback => {
        const id = request(time => { window.pendingFrames.delete(id); callback(time); });
        window.pendingFrames.add(id);
        return id;
      };
      window.cancelAnimationFrame = id => { window.pendingFrames.delete(id); cancel(id); };
    });
    await page.route('**/assets/app.js', route => route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("Stale unversioned script loaded");' }));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const file of ['index.html', 'about.html', 'contact.html', 'writing.html', 'poetry.html', 'videos.html']) {
        await page.goto(`${origin}/${file}`);
        await expect(page.locator('main h1')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        const links = await page.locator('.nav a').evaluateAll(items => items.map(a => a.getAttribute('href')));
        assert.deepEqual(links, ['index.html#featured', 'about.html', 'contact.html']);
        for (const href of await page.locator('a[href]').evaluateAll(items => items.map(a => a.href))) {
          const url = new URL(href);
          if (url.origin === origin) assert.equal((await page.request.get(href)).status(), 200, href);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, file);
        await expect(page.locator('.nav a')).toHaveText(['Work', 'About', 'Contact']);
        await expect(page.locator('.footer a[href="mailto:hello.destan@gmail.com"]')).toBeVisible();
        await expect(page.locator('.footer a[href="tel:+817090236141"]')).toBeVisible();
        if (file === 'videos.html') {
          await expect(page.locator('.video-card')).toHaveCount(10);
          await expect(page.locator('.video-card .role')).toHaveText(Array(10).fill('Content Creator & Assistant Producer'));
        }
        if (file === 'index.html') {
          assert.equal(await page.locator('a.work-card').count(), 13);
          assert.equal(await page.locator('.work-card[data-pdf]').count(), 3);
          await expect(page.locator('.work-card[data-video]').first()).toHaveAttribute('data-video', 'XrVW9X_RzxI');
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${origin}/writing.html`);
    await page.locator('[data-pdf][data-title="Digital Killer"]').click();
    await expect(page.locator('#page-count')).toHaveText('Page 1 of 3', { timeout: 30000 });
    await expect(page.locator('#previous')).toBeDisabled();
    await expect(page.locator('#next')).toBeEnabled();
    await expect(page.locator('#reader-zoom')).toHaveValue('auto');
    const autoWidth = await page.locator('.book-page').evaluate(el => el.clientWidth);
    assert.ok(autoWidth >= 800, 'Desktop auto view should open at a readable width');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.locator('.book-page').evaluate(el => el.clientWidth)).toBeLessThan(390);
    assert.ok(await page.locator('.book-page').evaluate(el => el.clientWidth) >= 330);
    await expect(page.locator('#reader-zoom')).toHaveValue('auto');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect.poll(() => page.locator('.book-page').evaluate(el => el.clientWidth)).toBe(autoWidth);
    await expect(page.locator('#reader-zoom')).toBeEnabled();
    await page.locator('#reader-zoom').selectOption('fit');
    await expect(page.locator('#reader-zoom')).toBeEnabled();
    assert.ok(await page.locator('.book-page').evaluate(el => el.clientWidth) < autoWidth);
    const bounds = await page.locator('.book-page').boundingBox();
    await page.mouse.move(bounds.x + bounds.width - 8, bounds.y + bounds.height - 8);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * .55, bounds.y + bounds.height * .7, { steps: 15 });
    await expect(page.locator('.book-page')).toHaveAttribute('data-turning', 'true');
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'page-drag.png') });
    await page.mouse.move(bounds.x - 40, bounds.y + bounds.height * .6, { steps: 15 });
    await page.mouse.up();
    await page.mouse.move(20, 20);
    await expect(page.locator('#page-count')).toHaveText('Page 2 of 3');
    await expect(page.locator('#previous')).toBeEnabled();
    await page.locator('#previous').click();
    await expect(page.locator('#page-count')).toHaveText('Page 1 of 3');
    await expect(page.locator('#next')).toBeEnabled();
    const firstWidth = await page.locator('.book-page').evaluate(canvas => canvas.getBoundingClientRect().width);
    await page.locator('#next').click();
    await expect(page.locator('.book-page')).toHaveAttribute('data-turning', 'true');
    if (process.env.SCREENSHOT_DIR) { await page.waitForTimeout(250); await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'page-curl.png') }); }
    await expect(page.locator('#page-count')).toHaveText('Page 2 of 3');
    await expect(page.locator('#next')).toBeEnabled();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#page-count')).toHaveText('Page 3 of 3');
    await expect(page.locator('#previous')).toBeEnabled();
    await expect(page.locator('#next')).toBeDisabled();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#page-count')).toHaveText('Page 3 of 3');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#page-count')).toHaveText('Page 2 of 3');
    await expect(page.locator('#next')).toBeEnabled();
    await page.locator('#reader-zoom').selectOption('1.5');
    await expect(page.locator('#reader-zoom')).toBeEnabled();
    assert.ok(await page.locator('.book-page').evaluate(canvas => canvas.getBoundingClientRect().width) > firstWidth);
    await page.locator('#reader-zoom').selectOption('fit');
    await expect(page.locator('#reader-zoom')).toBeEnabled();
    await page.locator('.page-text summary').click();
    await expect(page.locator('.page-text p')).toBeVisible();
    assert.ok((await page.locator('.page-text p').innerText()).length > 100);
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'book-desktop.png'), animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.locator('.book-page').evaluate(canvas => canvas.getBoundingClientRect().width)).toBeLessThan(390);
    await page.locator('.stf__block').evaluate(el => {
      const start = new Touch({ identifier: 1, target: el, clientX: 280, clientY: 200 });
      const end = new Touch({ identifier: 1, target: el, clientX: 90, clientY: 205 });
      el.dispatchEvent(new TouchEvent('touchstart', { touches: [start], changedTouches: [start], bubbles: true, cancelable: true }));
      el.dispatchEvent(new TouchEvent('touchend', { changedTouches: [end], bubbles: true }));
    });
    await expect(page.locator('#page-count')).toHaveText('Page 3 of 3');
    await expect(page.locator('#previous')).toBeEnabled();
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'book-mobile.png'), animations: 'disabled' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#previous').click();
    await expect(page.locator('#page-count')).toHaveText('Page 2 of 3');
    await expect(page.locator('.book-page')).not.toHaveAttribute('data-turning', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('.reader .book-page')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.pendingFrames.size)).toBe(0);
    await expect(page.locator('[data-pdf][data-title="Digital Killer"]')).toBeFocused();
    await page.locator('[data-pdf][data-title="Digital Killer"]').click();
    await expect(page.locator('#page-count')).toHaveText('Page 1 of 3');
    await expect(page.locator('#next')).toBeEnabled();
    await page.keyboard.press('ArrowRight');
    await page.locator('#reader-close').click();
    await expect(page.locator('.reader .book-page')).toHaveCount(0);
    await page.locator('[data-pdf][data-title="Digital Killer"]').click();
    await expect(page.locator('#page-count')).toHaveText('Page 1 of 3');
    await page.locator('#reader-close').click();
    await page.goto(`${origin}/videos.html`);
    await page.locator('[data-video]').first().click();
    await expect(page.locator('#video-dialog iframe')).toHaveAttribute('src', /youtube-nocookie/);
    await page.locator('#video-dialog button').click();
    await expect(page.locator('#video-dialog iframe')).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${origin}/index.html`);
    await expect(page.locator('.hero')).toBeVisible();
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'home-english.png'), fullPage: true, animations: 'disabled' });
    const offline = await browser.newPage();
    await offline.route('https://cdn.jsdelivr.net/**', route => route.abort());
    await offline.goto(`${origin}/writing.html`);
    await offline.locator('[data-pdf][data-title="Digital Killer"]').click();
    await expect(offline.locator('.reader-message')).toContainText('could not load', { timeout: 25000 });
    await expect(offline.locator('#original-pdf')).toHaveAttribute('href', /digital-killer-en.pdf/);
    await expect(offline.locator('#next')).toBeDisabled();
    const broken = await browser.newPage();
    await broken.route('**/files/*.pdf', route => route.fulfill({ status: 404, body: 'Not found' }));
    await broken.goto(`${origin}/writing.html`);
    await broken.locator('[data-pdf][data-title="Digital Killer"]').click();
    await expect(broken.locator('.reader-message')).toContainText('could not load', { timeout: 25000 });
    await expect(broken.locator('#next')).toBeDisabled();
    await broken.unroute('**/files/*.pdf');
    await broken.locator('#reader-close').click();
    await broken.locator('[data-pdf][data-title="Digital Killer"]').click();
    await expect(broken.locator('#page-count')).toHaveText('Page 1 of 3', { timeout: 25000 });
    assert.deepEqual(errors, []);
    console.log('PASS: English pages, responsive layout, real PDF rendering, page bounds, animation, keyboard, swipe, zoom, text view, reduced motion, reopen/cleanup, YouTube, CDN failure and missing PDF recovery.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
