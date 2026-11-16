import { spawnSync } from 'node:child_process';
import { createConnection, createServer } from 'node:net';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { win32, posix } from 'node:path';

function nativePaths(platform) {
  return platform === 'win32' ? win32 : posix;
}

export function installedBinaryPaths(appPath, platform = process.platform) {
  const paths = nativePaths(platform);
  if (platform === 'darwin') {
    return {
      desktop: paths.join(appPath, 'Contents', 'MacOS', 'airc'),
      backend: paths.join(appPath, 'Contents', 'Resources', 'bin', 'airc'),
    };
  }
  if (platform === 'linux' || platform === 'win32') {
    const executable = platform === 'win32' ? 'airc.exe' : 'airc';
    return {
      desktop: paths.join(appPath, executable),
      backend: paths.join(appPath, 'resources', 'bin', executable),
    };
  }
  throw new Error(`Unsupported installed AiRC platform: ${platform}`);
}

export function isolatedWindowsEnvironment(root) {
  return {
    USERPROFILE: win32.join(root, 'home'),
    APPDATA: win32.join(root, 'appdata', 'roaming'),
    LOCALAPPDATA: win32.join(root, 'appdata', 'local'),
  };
}

export function isolatedConfigEnvironment(parent, overrides, platform = process.platform) {
  const normalize = (values) =>
    platform === 'win32'
      ? Object.fromEntries(Object.entries(values).map(([key, value]) => [key.toUpperCase(), value]))
      : values;
  const environment = { ...normalize(parent), ...normalize(overrides) };
  for (const key of [
    'GOOSE_PATH_ROOT',
    'AIRC_ADDITIONAL_CONFIG_FILES',
    'GOOSE_ADDITIONAL_CONFIG_FILES',
  ]) {
    delete environment[key];
  }
  return environment;
}

export async function cleanupOwnedResources(actions) {
  const errors = [];
  for (const [name, action, timeoutMs = 30_000] of actions) {
    let timer;
    try {
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
        throw new Error('A finite positive cleanup deadline is required');
      }
      await Promise.race([
        Promise.resolve().then(action),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const error = new Error(`Cleanup did not settle within ${timeoutMs} ms`);
            error.code = 'ETIMEDOUT';
            reject(error);
          }, timeoutMs);
        }),
      ]);
    } catch (error) {
      errors.push(new Error(`${name}: ${error?.message ?? error}`, { cause: error }));
    } finally {
      clearTimeout(timer);
    }
  }
  if (errors.length) throw new AggregateError(errors, 'Acceptance cleanup failed');
}

export function isPathWithin(parent, candidate, platform = process.platform) {
  const paths = nativePaths(platform);
  const relative = paths.relative(paths.resolve(parent), paths.resolve(candidate));
  return relative !== '..' && !relative.startsWith(`..${paths.sep}`) && !paths.isAbsolute(relative);
}

export function acceptanceProfileRetained(root, options, platform = process.platform) {
  return Boolean(
    options.keepProfile || (options.outputDir && isPathWithin(root, options.outputDir, platform))
  );
}

export function writeAcceptanceReceipt(evidenceDir, result) {
  writeFileSync(join(evidenceDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, {
    mode: 0o600,
  });
}

function command(binary, args, execute) {
  const result = execute(binary, args, {
    encoding: 'utf8',
    timeout: 15_000,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Process inspection/control failed (${result.status}): ${result.stderr}`);
  }
  return result.stdout;
}

export function readProcessSnapshot(platform = process.platform, execute = spawnSync) {
  let entries;
  if (platform === 'win32') {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      '@(Get-CimInstance Win32_Process | ForEach-Object {',
      '  [ordered]@{pid=[long]$_.ProcessId; parentPid=[long]$_.ParentProcessId;',
      '    rssKb=[math]::Ceiling([double]$_.WorkingSetSize / 1024);',
      '    executablePath=$_.ExecutablePath; name=$_.Name}',
      '}) | ConvertTo-Json -Compress',
    ].join('\n');
    const output = command(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(script, 'utf16le').toString('base64'),
      ],
      execute
    );
    const decoded = JSON.parse(output.replace(/^\uFEFF/, ''));
    entries = Array.isArray(decoded) ? decoded : [decoded];
  } else {
    const output = command('ps', ['-axo', 'pid=,ppid=,rss='], execute);
    entries = output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [pid, parentPid, rssKb] = line.trim().split(/\s+/).map(Number);
        return { pid, parentPid, rssKb };
      });
  }
  for (const entry of entries) {
    if (
      !entry ||
      !Number.isSafeInteger(entry.pid) ||
      entry.pid < 0 ||
      !Number.isSafeInteger(entry.parentPid) ||
      entry.parentPid < 0 ||
      !Number.isFinite(entry.rssKb) ||
      entry.rssKb < 0
    ) {
      throw new Error('Invalid process inspection result');
    }
  }
  return entries;
}

export function processTreeRssKb(rootPid, platform = process.platform, execute = spawnSync) {
  const entries = readProcessSnapshot(platform, execute);
  if (!entries.some((entry) => entry.pid === rootPid)) {
    throw new Error('The acceptance process exited before its memory measurement');
  }
  const descendants = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of entries) {
      if (descendants.has(entry.parentPid) && !descendants.has(entry.pid)) {
        descendants.add(entry.pid);
        changed = true;
      }
    }
  }
  return entries
    .filter((entry) => descendants.has(entry.pid))
    .reduce((total, entry) => total + entry.rssKb, 0);
}

function sameWindowsPath(left, right) {
  return (
    typeof left === 'string' &&
    typeof right === 'string' &&
    win32.normalize(left).toLowerCase() === win32.normalize(right).toLowerCase()
  );
}

export function assertNoExistingInstalledApp(
  binary,
  platform = process.platform,
  execute = spawnSync
) {
  if (platform === 'win32') {
    const entries = readProcessSnapshot(platform, execute);
    if (
      entries.some((entry) => entry.name?.toLowerCase() === 'airc.exe' && !entry.executablePath)
    ) {
      throw new Error('Could not identify an existing AiRC process; refusing isolated acceptance');
    }
    const existing = entries.filter((entry) => sameWindowsPath(entry.executablePath, binary));
    if (existing.length) {
      throw new Error(
        `AiRC is already running (${existing.map((entry) => entry.pid).join(', ')}). Quit it before this isolated acceptance run.`
      );
    }
    return;
  }
  const result = execute('pgrep', ['-f', binary], { encoding: 'utf8', timeout: 15_000 });
  if (result.error) throw result.error;
  if (result.status === 0 && result.stdout.trim()) {
    throw new Error(
      `AiRC is already running (${result.stdout.trim().split(/\s+/).join(', ')}). Quit it before this isolated acceptance run.`
    );
  }
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`Could not inspect running AiRC processes: ${result.stderr}`);
  }
}

export function signalOwnedProcess(
  record,
  signal,
  {
    platform = process.platform,
    execute = spawnSync,
    kill = process.kill,
    ownerPid = process.pid,
  } = {}
) {
  const child = record?.child;
  if (!Number.isSafeInteger(child?.pid) || child.pid <= 0) return false;
  if (platform === 'win32') {
    if (signal !== 'SIGTERM' && signal !== 'SIGKILL') {
      throw new Error(`Windows acceptance does not support ${signal}`);
    }
    if (child.exitCode !== null || child.signalCode !== null) return false;
    const root = readProcessSnapshot(platform, execute).find((entry) => entry.pid === child.pid);
    if (!root) return false;
    if (root.parentPid !== ownerPid || !sameWindowsPath(root.executablePath, child.spawnfile)) {
      throw new Error('Refusing to terminate a process not owned by this acceptance run');
    }
    command('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], execute);
    return true;
  }
  try {
    kill(-child.pid, signal);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    throw error;
  }
}

// Backpressure delays real backend replies without freezing any OS process.
export async function startBackendResponseGate(backendPort) {
  if (!Number.isSafeInteger(backendPort) || backendPort < 1 || backendPort > 65535) {
    throw new Error('A loopback backend port is required');
  }
  const sockets = new Set();
  const upstreams = new Set();
  let paused = false;
  const server = createServer((client) => {
    const upstream = createConnection({ host: '127.0.0.1', port: backendPort });
    sockets.add(client);
    sockets.add(upstream);
    upstreams.add(upstream);
    client.on('error', () => upstream.destroy());
    upstream.on('error', () => client.destroy());
    client.on('close', () => {
      sockets.delete(client);
      upstream.destroy();
    });
    upstream.on('close', () => {
      sockets.delete(upstream);
      upstreams.delete(upstream);
      client.destroy();
    });
    client.pipe(upstream);
    upstream.pipe(client);
    if (paused) upstream.pause();
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    port: server.address().port,
    pauseResponses() {
      paused = true;
      for (const socket of upstreams) socket.pause();
    },
    resumeResponses() {
      paused = false;
      for (const socket of upstreams) socket.resume();
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    },
  };
}
