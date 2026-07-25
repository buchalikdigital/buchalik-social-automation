import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const FORMATS = {
  ig: { template: 'templates/ig.html', width: 1080, height: 1080 },
  fb: { template: 'templates/fb.html', width: 1200, height: 630 },
};

async function loadFontsB64() {
  const dir = path.join(ROOT, 'assets/fonts');
  const [playfair700, playfairItalic600, inter600] = await Promise.all([
    readFile(path.join(dir, 'playfair-700.ttf')),
    readFile(path.join(dir, 'playfair-italic-600.ttf')),
    readFile(path.join(dir, 'inter-600.ttf')),
  ]);
  return {
    PLAYFAIR_700: playfair700.toString('base64'),
    PLAYFAIR_ITALIC_600: playfairItalic600.toString('base64'),
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
 * Renders one queue item's headline into both the Instagram (1080x1080) and
 * Facebook/LinkedIn (1200x630) dark-gold-liquid-glass graphic, at 2x pixel
 * density for crisp export. Returns { ig: absPath, fb: absPath }.
 */
export async function renderPost({ headlineHtml, slug, outDir }) {
  const fonts = await loadFontsB64();
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const results = {};

  try {
    for (const [key, format] of Object.entries(FORMATS)) {
      const rawTemplate = await readFile(path.join(ROOT, format.template), 'utf8');
      const html = fillTemplate(rawTemplate, { ...fonts, HEADLINE: headlineHtml });

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

// Allow running directly: node scripts/render.mjs <slug> "<headlineHtml>"
// (Compared via pathToFileURL, not a raw string template, so this also works
// on Windows where process.argv[1] uses backslashes.)
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [slug, headlineHtml] = process.argv.slice(2);
  if (!slug || !headlineHtml) {
    console.error('Usage: node scripts/render.mjs <slug> "<headlineHtml>"');
    process.exit(1);
  }
  const outDir = path.join(ROOT, 'docs/images');
  const result = await renderPost({ headlineHtml, slug, outDir });
  console.log('Rendered:', result);
}
