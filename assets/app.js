const main = document.querySelector('main');
const page = document.body.dataset.page;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function safeUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
function youtubeId(value) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    const host = url.hostname.replace(/^www\./, '');
    const id = host === 'youtu.be' ? url.pathname.slice(1) : ['youtube.com', 'm.youtube.com'].includes(host)
      ? (url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1]) : '';
    return /^[\w-]{11}$/.test(id || '') ? id : '';
  } catch { return ''; }
}
const arrow = '<span aria-hidden="true"> →</span>';
const titles = { home: 'Home', about: 'About', writing: 'Writing & Scripts', poetry: 'Poetry', video: 'On Screen', contact: 'Contact' };

function portrait(person) {
  const url = safeUrl(person.photo);
  return `<figure class="portrait">${url
    ? `<img src="${escape(url)}" alt="${escape(person.photoAlt)}">`
    : `<span class="monogram" aria-hidden="true">${escape(person.monogram)}</span>`
  }</figure>`;
}

function pdfCard(item) {
  const url = safeUrl(item.pdf);
  if (!url) return '';
  return `<a class="card" href="${escape(url)}" data-pdf data-title="${escape(item.title)}">
    <span class="meta">${escape(item.type || 'Poem')}${item.year ? ` · ${escape(item.year)}` : ''}</span>
    <h3>${escape(item.title)}</h3>
    <p>${escape(item.description)}</p>
    <span class="arrow">Read${arrow}</span>
  </a>`;
}

function videoCard(item) {
  const id = youtubeId(item.url);
  if (!id) return '';
  return `<a class="card video-card" href="https://www.youtube.com/watch?v=${id}" data-video="${id}" data-role="${escape(item.role)}" data-title="${escape(item.title)}">
    <div class="video-cover">
      <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy">
      <span class="play" aria-hidden="true">▶</span>
    </div>
    <div class="video-body">
      <span class="meta">${escape(item.channel)}${item.year ? ` · ${escape(item.year)}` : ''}</span>
      <h3>${escape(item.title)}</h3>
      <span class="role">${escape(item.role)}</span>

      <span class="arrow">Watch${arrow}</span>
    </div>
  </a>`;
}

function empty(title, description) {
  return `<div class="empty"><span class="empty-symbol" aria-hidden="true">✳</span><div><h2>${title}</h2><p>${description}</p></div></div>`;
}

function pageHero(label, title, description) {
  return `<div class="page-hero"><p class="eyebrow">${label}</p><h1>${title}</h1>${description ? `<p class="lead">${description}</p>` : ''}</div>`;
}

async function start() {
  const response = await fetch('./content.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('Content could not be loaded.');
  const content = await response.json();
  const person = content.person;
  document.title = `${titles[page]} — ${person.name}`;
  document.querySelector('meta[name="description"]').content = person.intro;
  document.querySelector('.brand-name').textContent = person.name;
  document.querySelector('.nav').innerHTML = [
    ['home', 'Work', 'index.html#featured'], ['about', 'About', 'about.html'], ['contact', 'Contact', 'contact.html']
  ].map(([key, title, url]) => `<a href="${url}"${key === page && page !== 'home' ? ' aria-current="page"' : ''}>${title}</a>`).join('');
  document.querySelector('.copyright').textContent = `© ${new Date().getFullYear()} ${person.name}`;
  document.querySelector('.social').innerHTML = person.links.filter(l => safeUrl(l.url))
    .map(l => `<a href="${escape(safeUrl(l.url))}" target="_blank" rel="noopener">${escape(l.title)} ↗</a>`).join('');
  const contactDetails = `<div class="contact-details"><a href="mailto:${escape(person.email)}">${escape(person.email)}</a><a href="tel:${escape(person.phone)}">Tel: ${escape(person.phone)}</a></div>`;
  document.querySelector('.footer-contact').innerHTML = contactDetails;

  if (page === 'home') {
    const featured = content.featured.length ? content.featured : [...content.writing, ...content.videos];
    const workCards = featured.map((work, i) => {
      const url = safeUrl(work.pdf || work.url);
      const video = !work.pdf && youtubeId(work.url);
      const label = work.type || (video ? 'Video' : 'Project');
      const action = work.pdf ? 'Read script ↗' : video ? 'Watch video ▶' : 'View work ↗';
      const tag = url ? 'a' : 'article';
      return `<${tag} class="work-card work-${i % 4}${video ? ' work-video' : ''}"${url ? ` href="${escape(url)}" data-title="${escape(work.title)}"${work.pdf ? ' data-pdf' : video ? ` data-video="${video}" data-role="${escape(work.role)}"` : ''}` : ''}>
        <div class="work-art">${video ? `<img class="work-cover" src="https://i.ytimg.com/vi/${video}/hqdefault.jpg" alt="" loading="lazy">` : ''}<span class="work-number">${String(i + 1).padStart(2, '0')} / ${escape(label)}</span>
          <span class="work-title">${escape(work.title)}</span><span class="work-status">${url ? action : 'Coming soon'}</span></div>
        <div class="work-caption"><h3>${escape(video ? work.role : label)}</h3><span>${escape(work.description || work.channel || '')}</span></div>
      </${tag}>`;
    }).join('');
    main.innerHTML = `<section class="hero shell">
      <div class="hero-copy"><p class="hero-tag">Narrative Consultant &amp; Writer</p><h1>${escape(person.headline)}</h1></div>
      ${portrait(person)}
      </section><div class="pencil-banner" role="img" aria-label="Colourful pencils arranged across a creative workspace"></div>
      <section class="featured shell" id="featured" aria-labelledby="featured-title"><h2 id="featured-title" class="section-title">Featured Work</h2><div class="work-grid">${workCards}</div></section>
      <section class="services shell" aria-labelledby="services-title"><h2 id="services-title" class="section-title">What I Do</h2>
        <ul><li>Narrative Consulting</li><li>Brand Stories</li><li>Screenwriting</li><li>Content Creation</li><li>Character &amp; Dialogue</li><li>Campaign Ideas</li></ul>
      </section><section class="archive shell" aria-label="Explore the archive"><span>More stories, this way</span><div><a href="writing.html">Writing &amp; scripts ↗</a><a href="poetry.html">Poetry ↗</a><a href="videos.html">On screen ↗</a></div></section>`;
  } else if (page === 'about') {
    const cv = safeUrl(person.resumePdf);
    main.innerHTML = `<section class="about-page shell"><h1 class="page-title">About</h1>
      <h2 class="about-headline">${escape(person.aboutHeadline)}</h2>
      <div class="about-body">${portrait(person)}<div class="prose">${person.biography.map(p => `<p>${escape(p)}</p>`).join('')}
      ${cv ? `<a class="button" href="${escape(cv)}" data-pdf data-title="CV — ${escape(person.name)}">Read my CV ↗</a>` : ''}</div></div>
      ${person.experience.length ? `<section class="experience-list"><h2 class="section-title">Experience</h2>${person.experience.map(item => `<article class="experience"><span>${escape(item.period)}</span><div><h3>${escape(item.title)}</h3><p>${escape(item.description)}</p></div></article>`).join('')}</section>` : ''}</section>`;
  } else if (page === 'contact') {
    main.innerHTML = `<section class="contact-page shell"><h1 class="page-title">Get in Touch</h1><div class="contact-layout"><div>${contactDetails}<p class="location">Based in Tokyo.<br>Open to stories everywhere.</p></div><div class="contact-invitation"><h2>Have a project in mind?</h2><p>For writing, narrative consulting, or content production, get in touch.</p><a class="button" href="mailto:${escape(person.email)}">Let's talk ↗</a></div></div></section>`;
  } else if (page === 'writing' || page === 'poetry') {
    const poetry = page === 'poetry';
    const items = (poetry ? content.poetry : content.writing).filter(item => safeUrl(item.pdf));
    main.innerHTML = `<section class="library shell">${poetry ? pageHero('Poetry', 'Poetry.', 'A collection of poems.') : pageHero('Writing & scripts', 'Writing & scripts.', 'Writing and scripts. Open a title and turn the pages at your own pace.')}
      ${!poetry && items.length ? '<div class="filters" role="group" aria-label="Filter by category"><button class="filter" data-filter="All" aria-pressed="true">All</button><button class="filter" data-filter="Essay" aria-pressed="false">Essays</button><button class="filter" data-filter="Script" aria-pressed="false">Scripts</button></div>' : ''}
      <div id="works">${items.length ? `<div class="grid">${items.map(pdfCard).join('')}</div>` : empty('New stories are on their way.', 'New work will appear here as it is added.')}</div></section>`;
    document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      const filtered = items.filter(item => button.dataset.filter === 'All' || item.type === button.dataset.filter);
      document.querySelector('#works').innerHTML = filtered.length ? `<div class="grid">${filtered.map(pdfCard).join('')}</div>` : empty('Nothing here just yet.', 'New work in this category will appear here.');
    }));
  } else if (page === 'video') {
    const videos = content.videos.filter(item => youtubeId(item.url));
    main.innerHTML = `<section class="library shell">${pageHero('On screen', 'Video work.', 'Content Creator &amp; Assistant Producer for Red Bull Gamerszon. This role applies to every video below.')}${safeUrl(content.videoChannel?.url) ? `<p><a href="${escape(safeUrl(content.videoChannel.url))}" target="_blank" rel="noopener">Visit ${escape(content.videoChannel.title)} on YouTube ↗</a></p><br>` : ''}${videos.length ? `<div class="grid">${videos.map(videoCard).join('')}</div>` : empty('The curtain opens soon.', 'New projects will appear here.')}</section>`;
  }
  // Content is rendered asynchronously, so restore direct links to the work section.
  if (location.hash === '#featured') document.querySelector('#featured')?.scrollIntoView();
}

document.addEventListener('click', async event => {
  const link = event.target.closest('a[data-pdf], a[data-video]');
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  if (link.hasAttribute('data-pdf')) {
    try {
      const reader = await import('./reader.js?v=paper-2');
      reader.openPdf(link.href, link.dataset.title);
    } catch { location.href = link.href; }
  } else {
    const dialog = document.querySelector('#video-dialog');
    document.querySelector('#video-title').textContent = [link.dataset.title, link.dataset.role].filter(Boolean).join(' — ');
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${link.dataset.video}`;
    iframe.title = link.dataset.title;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    dialog.querySelector('.video-frame').replaceChildren(iframe);
    dialog.querySelector('.external-video').href = link.href;
    dialog.showModal();
  }
});
const videoDialog = document.querySelector('#video-dialog');
videoDialog.querySelector('button').addEventListener('click', () => videoDialog.close());
videoDialog.addEventListener('close', () => videoDialog.querySelector('.video-frame').replaceChildren());
start().catch(() => {
  main.innerHTML = '<div class="shell"><div class="notice"><h1>Something went wrong.</h1><p>The page content could not be loaded. Please refresh and try again.</p></div></div>';
});
