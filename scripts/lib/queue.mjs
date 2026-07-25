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
 * Next item to work on: the first one where at least one platform
 * hasn't been posted yet. This makes re-runs after a partial failure
 * safe — platforms already marked posted are skipped, not re-posted.
 */
export function findNextItem(items) {
  return items.find(
    (item) => !item.posted.instagram || !item.posted.facebook || (item.captions.linkedin && !item.posted.linkedin)
  );
}
