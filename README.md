# Destan Guler

A static portfolio for GitHub Pages. No build step required.

## Update content

Edit `content.json`. Put photos and PDFs in `files/`, using lowercase English filenames without spaces.

- **About:** edit `person`. Set `photo` and `resumePdf` to file paths, or leave them empty to hide them. Each `biography` entry is a paragraph.
- **Experience:** add `{"period":"2024–2026","title":"Role / organization","description":"A short description"}` to `person.experience`.
- **Writing:** copy an entry in `writing`. Use `Essay`, `Script`, or `Short Story` for `type`.
- **Poetry:** add `{"title":"Poem title","description":"A short description","pdf":"files/poem.pdf"}` to `poetry`.
- **Videos:** copy an entry in `videos`. Set the YouTube `url`, your `role` (for example, `Consultant`), and your `contribution`.
- **Links:** add `{"title":"Instagram","url":"https://..."}` to `person.links`.
- **Featured Work:** `featured` explicitly selects archive entries by `pdf` or `url`, for example `{"pdf":"files/digital-killer-en.pdf"}`. Titles and roles are inherited from the archive. An empty list shows no featured cards. All projects remain in their archive pages.
- **Contact:** edit `person.email` and `person.phone`; these appear on `contact.html` and in every footer. `person.aboutHeadline` is the large About statement. The portrait shows initials until `person.photo` is supplied.

Separate entries with commas. List order determines display order. Empty lists can remain `[]`. Keep PDFs in this repository.

## Preview and checks

Run `python -m http.server 8000` in the repository and open `http://localhost:8000`. Use this address instead of opening HTML files directly.

Run `python check.py` to validate content and local files. With Playwright and Edge installed, run `node tests/reader.cjs` for browser checks; it starts its own local server. A push to `main` updates GitHub Pages.

## Structure

`index.html`, `about.html`, `contact.html`, `writing.html`, `poetry.html`, and `videos.html` share `assets/site.css` and `assets/app.js`. The PDF reader loads PDF.js 6.3.289 from a CDN on demand. Local StPageFlip 2.0.7 (MIT) provides page curling; its animation-frame and resize-listener cleanup is patched. Only the current page and two pages on either side are rendered. Keyboard navigation, zoom, text view, reduced motion, and direct PDF links are supported. YouTube players load when clicked.

The light layout follows the supplied Wix Copywriter template (3062). `assets/pencils.jpg` is the decorative pencil photograph from that reference: https://static.wixstatic.com/media/11062b_b5694538c2eb4f028cc14ff890617424~mv2.jpg . Project placeholders are drawn with CSS; no sample client work or stock portrait is presented as Destan's work or identity.
