import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPost } from './render.mjs';
import { loadQueue, saveQueue, findNextMetaItem, findNextLinkedInItem } from './lib/queue.mjs';
import { publishInstagram, publishFacebookPhoto } from './lib/meta.mjs';
import { publishLinkedInPost } from './lib/linkedin.mjs';
import { commitAndPush, waitForUrl } from './lib/git.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGES_BASE_URL = process.env.PAGES_BASE_URL; // e.g. https://buchalikdigital.github.io/buchalik-social-automation

function env(name, { required = false } = {}) {
  const value = process.env[name];
  if (required && !value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const outDir = path.join(ROOT, 'docs/images');

async function render(item) {
  return renderPost({
    variant: item.variant,
    fields: item.fields,
    photo: item.photo,
    slug: item.id,
    outDir,
  });
}

/**
 * Instagram + Facebook advance together, on their own cursor: the oldest
 * item still missing either one. Needs the image hosted (Meta fetches by
 * URL), so it renders, commits+pushes, and waits for GitHub Pages.
 */
async function publishMeta(item, errors) {
  console.log(`Next Meta item: ${item.id}`);
  const rendered = await render(item);

  if (!PAGES_BASE_URL) {
    throw new Error('PAGES_BASE_URL is not set — needed so Meta can fetch the hosted image.');
  }
  const pushed = await commitAndPush(
    [path.relative(ROOT, rendered.ig), path.relative(ROOT, rendered.fb)],
    `Render graphics for ${item.id}`
  );
  const igImageUrl = `${PAGES_BASE_URL}/images/${item.id}-ig.png`;
  const fbImageUrl = `${PAGES_BASE_URL}/images/${item.id}-fb.png`;
  if (pushed) {
    console.log('Waiting for GitHub Pages to serve the new images...');
    await waitForUrl(igImageUrl);
    await waitForUrl(fbImageUrl);
  }

  if (!item.posted.instagram) {
    try {
      const igToken = env('META_ACCESS_TOKEN', { required: true });
      const igUserId = env('META_IG_USER_ID', { required: true });
      await publishInstagram({ accessToken: igToken, igUserId, imageUrl: igImageUrl, caption: item.captions.instagram });
      item.posted.instagram = true;
      console.log('Instagram: published.');
    } catch (err) {
      errors.push(`Instagram (${item.id}): ${err.message}`);
    }
  }

  if (!item.posted.facebook) {
    try {
      const fbToken = env('META_ACCESS_TOKEN', { required: true });
      const pageId = env('META_PAGE_ID', { required: true });
      await publishFacebookPhoto({ accessToken: fbToken, pageId, imageUrl: fbImageUrl, caption: item.captions.facebook });
      item.posted.facebook = true;
      console.log('Facebook: published.');
    } catch (err) {
      errors.push(`Facebook (${item.id}): ${err.message}`);
    }
  }
}

/**
 * LinkedIn advances on its own cursor, independent of Meta's — see
 * findNextLinkedInItem for why. Uploads the image binary directly, so it
 * only needs a local render, no Pages hosting or wait.
 */
async function publishLinkedIn(item, errors) {
  console.log(`Next LinkedIn item: ${item.id}`);
  // externalImage = a PNG already fully composited elsewhere (e.g. by the
  // sibling social-post-factory repo), committed as-is under assets/external/
  // and posted unchanged — no variant/fields to render.
  const imagePath = item.externalImage
    ? path.join(ROOT, item.externalImage)
    : (await render(item)).fb;

  const liToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const personUrn = process.env.LINKEDIN_PERSON_URN;
  if (!liToken || !personUrn) {
    console.log('LinkedIn: skipped (no LINKEDIN_ACCESS_TOKEN / LINKEDIN_PERSON_URN secret set yet).');
    return;
  }
  try {
    await publishLinkedInPost({ accessToken: liToken, personUrn, imagePath, caption: item.captions.linkedin });
    item.posted.linkedin = true;
    console.log('LinkedIn: published.');
  } catch (err) {
    errors.push(`LinkedIn (${item.id}): ${err.message}`);
  }
}

async function main() {
  const queue = await loadQueue();
  const metaItem = findNextMetaItem(queue);
  const linkedInItem = findNextLinkedInItem(queue);

  if (!metaItem && !linkedInItem) {
    console.log('Queue is empty or fully posted — nothing to do.');
    return;
  }

  const errors = [];
  if (metaItem) await publishMeta(metaItem, errors);
  if (linkedInItem) await publishLinkedIn(linkedInItem, errors);

  // Persist whatever succeeded, even if something else failed — one commit
  // covering both cursors (skipped cleanly if neither item changed).
  await saveQueue(queue);
  const touchedIds = [...new Set([metaItem?.id, linkedInItem?.id].filter(Boolean))].join(', ');
  await commitAndPush(['queue/posts.json'], `Mark progress for ${touchedIds}`);

  if (errors.length) {
    throw new Error(`Completed with errors:\n${errors.join('\n')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
