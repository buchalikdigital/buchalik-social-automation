import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadQueue } from './lib/queue.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Each format is rendered from templates/<variant>/<format>.html.
const FORMATS = {
  ig: { width: 1080, height: 1080 },
  fb: { width: 1200, height: 630 },
};

async function loadFontsB64() {
  const dir = path.join(ROOT, 'assets/fonts');
  const [playfair700, playfairItalic600, inter200, inter400, inter600] = await Promise.all([
    readFile(path.join(dir, 'playfair-700.ttf')),
    readFile(path.join(dir, 'playfair-italic-600.ttf')),
    readFile(path.join(dir, 'inter-200.ttf')),
    readFile(path.join(dir, 'inter-400.ttf')),
    readFile(path.join(dir, 'inter-600.ttf')),
  ]);
  return {
    PLAYFAIR_700: playfair700.toString('base64'),
    PLAYFAIR_ITALIC_600: playfairItalic600.toString('base64'),
    INTER_200: inter200.toString('base64'),
    INTER_400: inter400.toString('base64'),
    INTER_600: inter600.toString('base64'),
  };
}

function fillTemplate(template, values) {
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}

/**
 * Renders one queue item into both the Instagram (1080x1080) and
 * Facebook/LinkedIn (1200x630) dark-gold-liquid-glass graphic, at 2x pixel
 * density for crisp export.
 *
 * `variant` picks the layout under templates/ (e.g. "headline", "vergleich"),
 * `fields` supplies that layout's {{PLACEHOLDER}} values.
 * Returns { ig: absPath, fb: absPath }.
 */
export async function renderPost({ variant = 'headline', fields = {}, slug, outDir }) {
  const fonts = await loadFontsB64();
  const [fontsCss, baseCss] = await Promise.all([
    readFile(path.join(ROOT, 'templates/_fonts.css'), 'utf8'),
    readFile(path.join(ROOT, 'templates/_base.css'), 'utf8'),
  ]);
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const results = {};

  try {
    for (const [key, format] of Object.entries(FORMATS)) {
      const templatePath = path.join(ROOT, 'templates', variant, `${key}.html`);
      const rawTemplate = await readFile(templatePath, 'utf8');

      // Two passes: the shared stylesheets go in first because they carry
      // font placeholders of their own, which the second pass then resolves.
      const withShared = fillTemplate(rawTemplate, { FONTS_CSS: fontsCss, BASE_CSS: baseCss });
      const html = fillTemplate(withShared, { ...fonts, ...fields });

      const page = await browser.newPage({
        viewport: { width: format.width, height: format.height },
        deviceScaleFactor: 2,
      });
      await page.setContent(html, { waitUntil: 'networkidle' });

      const outPath = path.join(outDir, `${slug}-${key}.png`);
      await page.locator('.canvas').screenshot({ path: outPath });
      await page.close();

      results[key] = outPath;
    }
  } finally {
    await browser.close();
  }

  return results;
}

// Allow running directly to preview graphics without publishing anything:
//   node scripts/render.mjs             → renders every queue item
//   node scripts/render.mjs <post-id>   → renders just that one
// (Compared via pathToFileURL, not a raw string template, so this also works
// on Windows where process.argv[1] uses backslashes.)
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const wantedId = process.argv[2];
  const queue = await loadQueue();
  const items = wantedId ? queue.filter((item) => item.id === wantedId) : queue;

  if (!items.length) {
    console.error(`No queue item matches "${wantedId}". Available: ${queue.map((i) => i.id).join(', ')}`);
    process.exit(1);
  }

  const outDir = path.join(ROOT, 'docs/images');
  for (const item of items) {
    const result = await renderPost({
      variant: item.variant,
      fields: item.fields,
      slug: item.id,
      outDir,
    });
    console.log(`Rendered ${item.id} (${item.variant}):`, result);
  }
}
