import { readFile, writeFile } from 'node:fs/promises';

const QUEUE_PATH = new URL('../../queue/posts.json', import.meta.url);

export async function loadQueue() {
  const raw = await readFile(QUEUE_PATH, 'utf8');
  return JSON.parse(raw);
}

export async function saveQueue(items) {
  await writeFile(QUEUE_PATH, JSON.stringify(items, null, 2) + '\n', 'utf8');
}

/**
 * Next item still missing at least one of Instagram/Facebook (the two
 * always move together, since Meta needs the same hosted-image step).
 */
export function findNextMetaItem(items) {
  return items.find((item) => !item.posted.instagram || !item.posted.facebook);
}

/**
 * Next item still missing LinkedIn. Deliberately a SEPARATE cursor from
 * findNextMetaItem: if Meta is down (missing credentials, rate limits),
 * the oldest item can sit unfinished on Instagram/Facebook indefinitely.
 * Without its own cursor, LinkedIn would get stuck retrying that same
 * oldest item's Meta-only gap forever instead of moving on to newer posts
 * — which is exactly what happened 2026-08-01 (post-08 blocked post-09
 * from ever going out on LinkedIn, even though LinkedIn itself was fine).
 */
export function findNextLinkedInItem(items) {
  return items.find((item) => item.captions.linkedin && !item.posted.linkedin);
}
