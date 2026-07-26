import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPost } from './render.mjs';
import { loadQueue, saveQueue, findNextItem } from './lib/queue.mjs';
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

async function main() {
  const queue = await loadQueue();
  const item = findNextItem(queue);

  if (!item) {
    console.log('Queue is empty or fully posted — nothing to do.');
    return;
  }

  console.log(`Next queue item: ${item.id}`);

  // 1. Render both graphics.
  const outDir = path.join(ROOT, 'docs/images');
  const rendered = await renderPost({
    variant: item.variant,
    fields: item.fields,
    slug: item.id,
    outDir,
  });

  // 2. Publish the rendered images so Instagram/Facebook can fetch them by URL.
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

  // 3. Publish to each platform independently — a failure on one must not
  //    block or duplicate the others on a re-run.
  const errors = [];

  if (!item.posted.instagram) {
    try {
      const igToken = env('META_ACCESS_TOKEN', { required: true });
      const igUserId = env('META_IG_USER_ID', { required: true });
      await publishInstagram({
        accessToken: igToken,
        igUserId,
        imageUrl: igImageUrl,
        caption: item.captions.instagram,
      });
      item.posted.instagram = true;
      console.log('Instagram: published.');
    } catch (err) {
      errors.push(`Instagram: ${err.message}`);
    }
  }

  if (!item.posted.facebook) {
    try {
      const fbToken = env('META_ACCESS_TOKEN', { required: true });
      const pageId = env('META_PAGE_ID', { required: true });
      await publishFacebookPhoto({
        accessToken: fbToken,
        pageId,
        imageUrl: fbImageUrl,
        caption: item.captions.facebook,
      });
      item.posted.facebook = true;
      console.log('Facebook: published.');
    } catch (err) {
      errors.push(`Facebook: ${err.message}`);
    }
  }

  if (item.captions.linkedin && !item.posted.linkedin) {
    const liToken = process.env.LINKEDIN_ACCESS_TOKEN;
    const personUrn = process.env.LINKEDIN_PERSON_URN;
    if (!liToken || !personUrn) {
      console.log('LinkedIn: skipped (no LINKEDIN_ACCESS_TOKEN / LINKEDIN_PERSON_URN secret set yet).');
    } else {
      try {
        await publishLinkedInPost({
          accessToken: liToken,
          personUrn,
          imagePath: rendered.fb,
          caption: item.captions.linkedin,
        });
        item.posted.linkedin = true;
        console.log('LinkedIn: published.');
      } catch (err) {
        errors.push(`LinkedIn: ${err.message}`);
      }
    }
  }

  // 4. Persist whatever succeeded, even if something else failed.
  await saveQueue(queue);
  await commitAndPush(['queue/posts.json'], `Mark progress for ${item.id}`);

  if (errors.length) {
    throw new Error(`Completed with errors:\n${errors.join('\n')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
