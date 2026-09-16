const PDF_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/';
const FLIP_MODULE = './vendor/page-flip.js';
document.body.insertAdjacentHTML('beforeend', `
  <dialog class="reader" aria-labelledby="reader-title">
    <div class="dialog-bar"><h2 id="reader-title"></h2><button class="icon-button" id="reader-close" aria-label="Close reader" autofocus>✕</button></div>
    <div class="reader-tools"><label for="reader-zoom">View</label><select id="reader-zoom"><option value="auto">Auto</option><option value="fit">Fit page</option><option value="1">100%</option><option value="1.5">150%</option><option value="2">200%</option></select><a id="original-pdf" target="_blank" rel="noopener">Open PDF ↗</a><a id="download-pdf" download>Download ↓</a></div>
    <p class="reader-message" role="status"></p>
    <div class="reader-stage"><div class="book-mount"></div><details class="page-text" hidden><summary>Read this page as text</summary><p></p></details></div>
    <div class="reader-bottom"><button class="button secondary" id="previous">← Previous</button><span id="page-count" aria-live="polite"></span><button class="button secondary" id="next">Next →</button></div>
  </dialog>`);
const dialog = document.querySelector('.reader');
const stage = dialog.querySelector('.reader-stage');
const mount = dialog.querySelector('.book-mount');
const message = dialog.querySelector('.reader-message');
const previous = dialog.querySelector('#previous');
const next = dialog.querySelector('#next');
const zoom = dialog.querySelector('#reader-zoom');
const textView = dialog.querySelector('.page-text');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let state;
let resizeTimer;

function controls() {
  const ready = state?.flip && !state.busy && !state.turning;
  previous.disabled = !ready || state.page === 0;
  next.disabled = !ready || state.page === state.pdf.numPages - 1;
  zoom.disabled = !ready;
  mount.style.pointerEvents = state?.busy || reducedMotion.matches || zoom.value !== 'fit' ? 'none' : '';
  stage.setAttribute('aria-busy', String(Boolean(state?.busy)));
}

async function prepare(s) {
  s.busy = true;
  controls();
  try {
    for (let index = Math.max(0, s.page - 2); index <= Math.min(s.pdf.numPages - 1, s.page + 2); index++) {
      if (state !== s) return;
      if (s.cache.has(index)) continue;
      const page = await s.pdf.getPage(index + 1);
      if (state !== s) return;
      const base = page.getViewport({ scale: 1 });
      const density = Math.min(devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: Math.min(s.width / base.width, s.height / base.height) * density });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      s.renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport });
      await s.renderTask.promise;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const text = await page.getTextContent().catch(() => ({ items: [] }));
      if (state !== s) return;
      if (!blob) throw new Error('Page image unavailable');
      const url = URL.createObjectURL(blob);
      const img = document.createElement('img');
      img.src = url;
      img.alt = `Page ${index + 1}`;
      img.draggable = false;
      s.cache.set(index, { url, text: text.items.map(item => (item.str || '') + (item.hasEOL ? '\n' : ' ')).join('') });
      await img.decode();
      if (state !== s) return;
      s.sheets[index].replaceChildren(img);
    }
    if (state !== s) return;
    for (const [index, entry] of s.cache) {
      if (Math.abs(index - s.page) > 2) {
        URL.revokeObjectURL(entry.url);
        s.cache.delete(index);
        s.sheets[index].replaceChildren();
      }
    }
    const text = s.cache.get(s.page)?.text || '';
    textView.querySelector('p').textContent = text;
    textView.hidden = !text.trim();
    message.textContent = zoom.value !== 'fit' ? 'Scroll to read. Use the arrows to turn pages.' : reducedMotion.matches ? '' : 'Drag a page corner, or use the arrows.';
  } catch {
    if (state === s) message.textContent = 'This page could not be displayed. Please use Open PDF above.';
  } finally {
    if (state === s) { s.busy = false; controls(); }
  }
}

function clearBook(s) {
  s.flip?.destroy();
  s.flip = null;
  for (const entry of s.cache.values()) URL.revokeObjectURL(entry.url);
  s.cache.clear();
  mount.replaceChildren();
}

async function build(s) {
  if (state !== s || !s.pdf) return;
  s.busy = true;
  controls();
  clearBook(s);
  const padding = innerWidth <= 600 ? 32 : 64;
  const scale = zoom.value === 'auto'
    ? Math.max(.1, Math.min(1.5, (stage.clientWidth - padding) / s.base.width))
    : zoom.value === 'fit'
    ? Math.max(.1, Math.min((stage.clientWidth - padding) / s.base.width, (stage.clientHeight - padding) / s.base.height))
    : Number(zoom.value);
  s.width = Math.floor(s.base.width * scale);
  s.height = Math.floor(s.base.height * scale);
  const book = document.createElement('div');
  book.className = 'book-page';
  book.style.width = `${s.width}px`;
  book.style.height = `${s.height}px`;
  mount.append(book);
  s.sheets = Array.from({ length: s.pdf.numPages }, () => {
    const sheet = document.createElement('div');
    sheet.className = 'book-sheet';
    sheet.dataset.density = 'soft';
    book.append(sheet);
    return sheet;
  });
  await prepare(s);
  if (state !== s) return;
  s.flip = new s.PageFlip(book, {
    width: s.width, height: s.height, size: 'fixed', autoSize: false,
    usePortrait: true, showCover: false, startPage: s.page,
    flippingTime: 1000, maxShadowOpacity: .3, drawShadow: true,
    showPageCorners: !reducedMotion.matches, useMouseEvents: !reducedMotion.matches,
    mobileScrollSupport: true, swipeDistance: 40
  });
  s.flip.on('flip', event => {
    if (state !== s) return;
    s.page = event.data;
    dialog.querySelector('#page-count').textContent = `Page ${s.page + 1} of ${s.pdf.numPages}`;
    textView.open = false;
    stage.scrollTo(0, 0);
    prepare(s);
  });
  s.flip.on('changeState', event => {
    if (state !== s) return;
    s.turning = event.data !== 'read';
    book.dataset.turning = String(s.turning);
    controls();
  });
  s.flip.loadFromHTML(s.sheets);
  s.busy = false;
  s.turning = false;
  controls();
  stage.scrollTo(0, 0);
}

export async function openPdf(url, title) {
  if (dialog.open) return;
  const s = { page: 0, busy: true, cache: new Map() };
  state = s;
  zoom.value = 'auto';
  textView.hidden = true;
  dialog.querySelector('#reader-title').textContent = title;
  dialog.querySelector('#original-pdf').href = url;
  dialog.querySelector('#download-pdf').href = url;
  dialog.querySelector('#page-count').textContent = '';
  message.textContent = 'Opening your book…';
  controls();
  dialog.showModal();
  let timeout;
  try {
    await Promise.race([
      (async () => {
        const [library, flipLibrary] = await Promise.all([import(`${PDF_CDN}build/pdf.min.mjs`), import(FLIP_MODULE)]);
        if (state !== s || s.failed) return;
        s.PageFlip = flipLibrary.PageFlip;
        library.GlobalWorkerOptions.workerSrc = `${PDF_CDN}build/pdf.worker.min.mjs`;
        s.loading = library.getDocument({ url, cMapUrl: `${PDF_CDN}cmaps/`, cMapPacked: true, standardFontDataUrl: `${PDF_CDN}standard_fonts/`, wasmUrl: `${PDF_CDN}wasm/`, isEvalSupported: false });
        s.pdf = await s.loading.promise;
        s.base = (await s.pdf.getPage(1)).getViewport({ scale: 1 });
      })(),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Timeout')), 20000); })
    ]);
    if (state === s) await build(s);
  } catch {
    s.failed = true;
    s.loading?.destroy().catch(() => {});
    if (state === s) {
      clearBook(s);
      s.busy = false;
      message.textContent = 'The reader could not load this PDF. You can still open or download it using the links above.';
      controls();
    }
  } finally { clearTimeout(timeout); }
}

function turn(direction) {
  const s = state;
  if (!s?.flip || s.busy || s.turning || s.page + direction < 0 || s.page + direction >= s.pdf.numPages) return;
  if (reducedMotion.matches) s.flip.turnToPage(s.page + direction);
  else if (direction > 0) s.flip.flipNext('bottom');
  else s.flip.flipPrev('bottom');
}
previous.addEventListener('click', () => turn(-1));
next.addEventListener('click', () => turn(1));
zoom.addEventListener('change', () => build(state));
dialog.querySelector('#reader-close').addEventListener('click', () => dialog.close());
document.addEventListener('keydown', event => {
  if (!dialog.open || event.target.matches('select, input, textarea') || event.ctrlKey || event.metaKey || event.altKey) return;
  if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    turn(event.key === 'ArrowRight' ? 1 : -1);
  }
});
dialog.addEventListener('close', () => {
  if (dialog.open) return;
  const s = state;
  state = null;
  s?.renderTask?.cancel();
  s?.loading?.destroy().catch(() => {});
  if (s) clearBook(s);
  textView.querySelector('p').textContent = '';
  clearTimeout(resizeTimer);
});
function resize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!state?.pdf || !state.flip) return;
    if (state.busy || state.turning) { resize(); return; }
    build(state);
  }, 180);
}
window.addEventListener('resize', resize);
reducedMotion.addEventListener('change', resize);
