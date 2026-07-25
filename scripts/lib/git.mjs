import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export async function commitAndPush(paths, message) {
  await run('git', ['add', ...paths]);
  const { stdout: staged } = await run('git', ['diff', '--cached', '--name-only']);
  if (!staged.trim()) {
    console.log('Nothing to commit, skipping push.');
    return false;
  }
  await run('git', ['commit', '-m', message]);
  await run('git', ['push']);
  return true;
}

export async function waitForUrl(url, { timeoutMs = 120_000, intervalMs = 5_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) return true;
    } catch {
      // ignore and retry
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for ${url} to become available (GitHub Pages deploy delay?)`);
}
