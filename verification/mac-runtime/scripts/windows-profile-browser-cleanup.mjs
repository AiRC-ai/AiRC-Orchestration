import { spawnSync } from 'node:child_process';
import { win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPathWithin } from './installed-lifecycle-platform.mjs';

function browserPath(entry) {
  return (
    typeof entry.executablePath === 'string' &&
    ['msedge.exe', 'chrome.exe'].includes(win32.basename(entry.executablePath).toLowerCase())
  );
}

function samePath(left, right) {
  return win32.resolve(left).toLowerCase() === win32.resolve(right).toLowerCase();
}

export function selectProfileBrowserRoots(entries, { root, startedAt, finishedAt }) {
  const start = Date.parse(startedAt);
  const end = Date.parse(finishedAt);
  if (
    !win32.isAbsolute(root) ||
    !/^airc-installed-lifecycle-[A-Za-z0-9]+$/.test(win32.basename(root)) ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start
  ) {
    throw new Error('Invalid acceptance browser ownership boundary');
  }
  const bornDuringRun = (entry) => {
    const created = Date.parse(entry.createdAt);
    return Number.isFinite(created) && created >= start && created <= end;
  };
  const roots = new Map();
  for (const child of entries) {
    if (
      child.type !== 'crashpad-handler' ||
      typeof child.database !== 'string' ||
      samePath(root, child.database) ||
      !isPathWithin(root, child.database, 'win32')
    ) {
      continue;
    }
    const parent = entries.find((entry) => entry.pid === child.parentPid);
    if (
      !parent ||
      !browserPath(child) ||
      !browserPath(parent) ||
      !samePath(parent.executablePath, child.executablePath) ||
      parent.type ||
      !parent.ownedByCurrentUser ||
      !child.ownedByCurrentUser ||
      !bornDuringRun(parent) ||
      !bornDuringRun(child) ||
      !Number.isSafeInteger(parent.pid) ||
      parent.pid <= 0 ||
      !Number.isSafeInteger(child.pid) ||
      child.pid <= 0 ||
      Date.parse(parent.createdAt) > Date.parse(child.createdAt)
    ) {
      throw new Error('Refusing browser cleanup without exact acceptance ownership');
    }
    roots.set(parent.pid, { ...parent, proofChild: child });
  }
  return [...roots.values()];
}

function run(action, payload, execute) {
  const result = execute(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      fileURLToPath(new URL('./windows-profile-browser-cleanup.ps1', import.meta.url)),
      '-Action',
      action,
      '-Payload',
      Buffer.from(JSON.stringify(payload), 'utf8').toString('base64'),
    ],
    { encoding: 'utf8', timeout: 20_000, maxBuffer: 1024 * 1024, windowsHide: true }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Acceptance browser cleanup failed (${result.status}): ${result.stderr}`);
  }
  return JSON.parse(result.stdout.replace(/^\uFEFF/, ''));
}

export function prepareProfileOwnership(
  root,
  createdAfter,
  { platform = process.platform, execute = spawnSync, now = Date.now } = {}
) {
  if (platform !== 'win32') return;
  const result = run(
    'Prepare',
    {
      root,
      createdAfter,
      createdBefore: new Date(now() + 1_000).toISOString(),
    },
    execute
  );
  if (result.prepared !== true) throw new Error('Acceptance profile ownership was not prepared');
}

export function cleanupProfileBrowsers(
  root,
  startedAt,
  { platform = process.platform, execute = spawnSync, now = () => new Date().toISOString() } = {}
) {
  if (platform !== 'win32') return [];
  const boundary = { root, startedAt, finishedAt: now() };
  // A browser opened by Windows ShellExecute can outlive the desktop process tree.
  const entries = run('Inspect', boundary, execute);
  const roots = selectProfileBrowserRoots(entries, boundary);
  if (!roots.length) return [];
  return run('Stop', { ...boundary, roots }, execute);
}
