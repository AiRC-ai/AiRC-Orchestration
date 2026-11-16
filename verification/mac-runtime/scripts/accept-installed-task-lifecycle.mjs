#!/usr/bin/env node

import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import {
  assertNoExistingInstalledApp,
  acceptanceProfileRetained,
  cleanupOwnedResources,
  installedBinaryPaths,
  isolatedConfigEnvironment,
  isolatedWindowsEnvironment,
  processTreeRssKb,
  signalOwnedProcess,
  startBackendResponseGate,
  writeAcceptanceReceipt,
} from './installed-lifecycle-platform.mjs';
import {
  cleanupProfileBrowsers,
  prepareProfileOwnership,
} from './windows-profile-browser-cleanup.mjs';

const DEFAULT_APP_PATH = process.platform === 'darwin' ? '/Applications/AiRC.app' : null;
const DEFAULT_MESSAGE_COUNT = 4_000;
const READY_TIMEOUT_MS = 60_000;
const LOAD_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_RSS_GROWTH_MIB = 768;
const DESKTOP_RELEASE_VERSION = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
).version;
const FIXTURE_NAME = 'AiRC installed replay acceptance';
const SINGLE_SEND_FIXTURE_NAME = 'AiRC single-send acceptance';
const ORCHESTRATOR_FIXTURE_NAME = 'AiRC Orchestrator lifecycle acceptance';
const DRAFT_TEXT = 'Draft retained while AiRC validates this task';
const INITIAL_WORKFLOW_OBJECTIVE = 'Keep the installed AiRC workflow stable';
const UPDATED_WORKFLOW_OBJECTIVE = 'Keep the installed AiRC workflow stable after restart';
const AUTOMATION_ID = 'installed-automation-lifecycle';
const AUTOMATION_RESPONSE_MARKER = 'AIRC_AUTOMATION_LIFECYCLE_COMPLETE';
const INTERACTIVE_RESPONSE_MARKER = 'AIRC_SINGLE_SEND_RESPONSE_COMPLETE';
const ORCHESTRATOR_SECRET_CANARY = 'top-secret';
const ORCHESTRATOR_OBJECTIVE =
  'Verify the recorded task evidence, correct the missing validation, and re-check the result.';
const ORCHESTRATOR_FIRST_REVIEW_SUMMARY =
  'The implementation is recorded, but independent validation is still missing.';
const ORCHESTRATOR_RECOMMENDATION =
  'Preserve the implementation, run one independent validation, record the result, and summarize the verified outcome.';
const ORCHESTRATOR_CORRECTION_RESPONSE_MARKER = 'AIRC_ORCHESTRATOR_CORRECTION_APPLIED';
const ORCHESTRATOR_RECHECK_SUMMARY =
  'The correction was applied once and the recorded validation now supports the goal.';
const ORCHESTRATOR_CORRECTION_PACKET_PREFIX = 'AiRC Orchestrator supervisory packet (';
const MAX_SYNTHETIC_REQUEST_BYTES = 16 * 1024 * 1024;

function fail(message) {
  throw new Error(message);
}

function parsePositiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    fail(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = {
    appPath: DEFAULT_APP_PATH,
    messageCount: DEFAULT_MESSAGE_COUNT,
    outputDir: null,
    keepProfile: false,
    skipRendererRecovery: false,
    maxRssGrowthMiB: DEFAULT_MAX_RSS_GROWTH_MIB,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') {
      continue;
    } else if (argument === '--app') {
      options.appPath = argv[++index];
    } else if (argument === '--message-count') {
      options.messageCount = parsePositiveInteger(argv[++index], '--message-count');
    } else if (argument === '--output') {
      options.outputDir = argv[++index];
    } else if (argument === '--keep-profile') {
      options.keepProfile = true;
    } else if (argument === '--skip-renderer-recovery') {
      options.skipRendererRecovery = true;
    } else if (argument === '--max-rss-growth-mib') {
      options.maxRssGrowthMiB = parsePositiveInteger(argv[++index], '--max-rss-growth-mib');
    } else if (argument === '--help' || argument === '-h') {
      process.stdout.write('Usage: node scripts/accept-installed-task-lifecycle.mjs [options]\n\n');
      process.stdout.write('  --app PATH                 Installed AiRC application path\n');
      process.stdout.write(
        '  --message-count NUMBER     Synthetic transcript size (default 4000)\n'
      );
      process.stdout.write('  --output PATH              Retained evidence directory\n');
      process.stdout.write('  --keep-profile             Retain the disposable runtime profile\n');
      process.stdout.write('  --skip-renderer-recovery   Skip the renderer crash/recovery gate\n');
      process.stdout.write(
        `  --max-rss-growth-mib N     Maximum process-tree RSS growth (default ${DEFAULT_MAX_RSS_GROWTH_MIB})\n`
      );
      process.exit(0);
    } else {
      fail(`Unknown argument: ${argument}`);
    }
  }

  if (!options.appPath) fail('--app requires a path');
  if (options.messageCount < 2) fail('--message-count must be at least 2');
  return options;
}

function assertSafeTemporaryRoot(path) {
  const realTmp = resolve(tmpdir());
  const realPath = resolve(path);
  if (
    dirname(realPath) !== realTmp ||
    !basename(realPath).startsWith('airc-installed-lifecycle-')
  ) {
    fail(`Refusing to manage an unexpected acceptance root: ${realPath}`);
  }
}

async function reservePort() {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not reserve a loopback port'));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

function readJsonRequest(request) {
  return new Promise((resolveRequest, reject) => {
    const chunks = [];
    let bytes = 0;
    request.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_SYNTHETIC_REQUEST_BYTES) {
        reject(new Error('Synthetic Ollama request exceeded the acceptance limit'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.once('error', reject);
    request.once('end', () => {
      try {
        resolveRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function messageContentText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      if (typeof item.text === 'string') return item.text;
      if (typeof item.content === 'string') return item.content;
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function latestUserPromptText(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.messages)) return '';
  for (let index = payload.messages.length - 1; index >= 0; index -= 1) {
    const message = payload.messages[index];
    if (message?.role !== 'user') continue;
    return messageContentText(message.content);
  }
  return '';
}

function finishSyntheticCompletion(response, marker, id, options = {}) {
  const model = options.model ?? 'airc:latest';
  const promptTokens = options.promptTokens ?? 8;
  const completionTokens = options.completionTokens ?? 4;
  if (!response.headersSent) {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
  }
  response.write(
    `data: ${JSON.stringify({
      id,
      object: 'chat.completion.chunk',
      created: 0,
      model,
      choices: [
        {
          index: 0,
          delta: { role: 'assistant', content: marker },
          finish_reason: null,
        },
      ],
      usage: null,
    })}\n\n`
  );
  response.write(
    `data: ${JSON.stringify({
      id,
      object: 'chat.completion.chunk',
      created: 0,
      model,
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    })}\n\n`
  );
  response.end('data: [DONE]\n\n');
}

function expectedOrchestratorEvidenceIds(promptText) {
  const prefix = '\nEXPECTED EVIDENCE IDS\n';
  const suffix = '\n\nEVIDENCE JSONL\n';
  const start = promptText.indexOf(prefix);
  if (start < 0) return [];
  const valueStart = start + prefix.length;
  const end = promptText.indexOf(suffix, valueStart);
  if (end < 0) return [];
  return promptText
    .slice(valueStart, end)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function orchestratorReviewResponse(requestIndex, evidenceIds) {
  if (requestIndex === 1) {
    return JSON.stringify({
      verdict: 'fail',
      summary: ORCHESTRATOR_FIRST_REVIEW_SUMMARY,
      findings: [
        {
          severity: 'error',
          title: 'Validation is incomplete',
          detail: 'The evidence records implementation work but no independent validation result.',
          evidenceIds: evidenceIds.slice(0, 1),
          recommendation: ORCHESTRATOR_RECOMMENDATION,
        },
      ],
      recommendation: ORCHESTRATOR_RECOMMENDATION,
      coveredEvidenceIds: evidenceIds,
      coverageGaps: [],
    });
  }
  return JSON.stringify({
    verdict: 'pass',
    summary: ORCHESTRATOR_RECHECK_SUMMARY,
    findings: [],
    recommendation: null,
    coveredEvidenceIds: evidenceIds,
    coverageGaps: [],
  });
}

async function startSyntheticOllama(port, singleSendText) {
  const requests = [];
  const activeAutomationResponses = new Set();
  const activeOrchestratorResponses = new Map();
  const interactivePromptTexts = [];
  const interactivePromptOccurrenceCounts = [];
  const orchestratorRequests = [];
  const correctionRequests = [];
  const goalContinuationRequests = [];
  let automationRequestCount = 0;
  let automationResponseCloseCount = 0;
  let interactiveRequestCount = 0;
  let orchestratorResponseCloseCount = 0;
  const server = createHttpServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
    requests.push({ method: request.method ?? 'GET', path: url.pathname });
    response.setHeader('Content-Type', 'application/json');

    if (url.pathname === '/api/tags') {
      response.end(
        JSON.stringify({
          models: [
            {
              name: 'airc:latest',
              model: 'airc:latest',
              modified_at: '2026-08-29T00:00:00Z',
              size: 1,
              digest: `sha256:${'a'.repeat(64)}`,
              details: {
                format: 'gguf',
                family: 'qwen3.5',
                families: ['qwen3.5'],
                parameter_size: '27B',
                quantization_level: 'Q4_K_M',
              },
            },
            {
              name: 'airc-reviewer:latest',
              model: 'airc-reviewer:latest',
              modified_at: '2026-08-29T00:00:00Z',
              size: 1,
              digest: `sha256:${'b'.repeat(64)}`,
              details: {
                format: 'gguf',
                family: 'qwen3.5',
                families: ['qwen3.5'],
                parameter_size: '27B',
                quantization_level: 'Q4_K_M',
              },
            },
          ],
        })
      );
      return;
    }

    if (url.pathname === '/api/show') {
      response.end(
        JSON.stringify({
          modelfile: 'FROM synthetic-acceptance-fixture',
          parameters: 'num_ctx 262144',
          template: '{{ .Prompt }}',
          details: {
            format: 'gguf',
            family: 'qwen3.5',
            families: ['qwen3.5'],
            parameter_size: '27B',
            quantization_level: 'Q4_K_M',
          },
          model_info: { 'qwen35.context_length': 262_144 },
          capabilities: ['completion', 'tools', 'thinking'],
        })
      );
      return;
    }

    if (url.pathname === '/v1/models') {
      response.end(
        JSON.stringify({
          object: 'list',
          data: [
            { id: 'airc:latest', object: 'model' },
            { id: 'airc-reviewer:latest', object: 'model' },
          ],
        })
      );
      return;
    }

    if (url.pathname === '/v1/chat/completions') {
      let payload;
      try {
        payload = await readJsonRequest(request);
      } catch (error) {
        if (!response.headersSent) response.statusCode = 400;
        response.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'Invalid synthetic request',
          })
        );
        return;
      }
      const promptText = latestUserPromptText(payload);
      const model = typeof payload?.model === 'string' ? payload.model : '';
      const singleSendOccurrences = promptText.split(singleSendText).length - 1;
      if (singleSendOccurrences > 0) {
        interactiveRequestCount += 1;
        interactivePromptTexts.push(promptText);
        interactivePromptOccurrenceCounts.push(singleSendOccurrences);
        finishSyntheticCompletion(
          response,
          INTERACTIVE_RESPONSE_MARKER,
          'chatcmpl-single-send-acceptance'
        );
        return;
      }
      if (promptText.includes(AUTOMATION_RESPONSE_MARKER)) {
        automationRequestCount += 1;
        response.setHeader('Content-Type', 'text/event-stream');
        response.setHeader('Cache-Control', 'no-cache');
        response.flushHeaders();
        activeAutomationResponses.add(response);
        response.once('close', () => {
          automationResponseCloseCount += 1;
          activeAutomationResponses.delete(response);
        });
        return;
      }
      if (
        promptText.includes('SUPERVISORY OBJECTIVE') &&
        promptText.includes('EXPECTED EVIDENCE IDS')
      ) {
        const evidenceIds = expectedOrchestratorEvidenceIds(promptText);
        const requestIndex = orchestratorRequests.length + 1;
        orchestratorRequests.push({
          requestIndex,
          model,
          evidenceIdCount: evidenceIds.length,
          hadTools: Array.isArray(payload.tools) && payload.tools.length > 0,
          containedSecret: promptText.includes(ORCHESTRATOR_SECRET_CANARY),
          containedRedaction: promptText.includes('[REDACTED]'),
        });
        response.setHeader('Content-Type', 'text/event-stream');
        response.setHeader('Cache-Control', 'no-cache');
        response.flushHeaders();
        activeOrchestratorResponses.set(response, { requestIndex, evidenceIds, model });
        response.once('close', () => {
          orchestratorResponseCloseCount += 1;
          activeOrchestratorResponses.delete(response);
        });
        return;
      }
      if (promptText.includes(ORCHESTRATOR_CORRECTION_PACKET_PREFIX)) {
        correctionRequests.push({
          model,
          occurrenceCount: promptText.split(ORCHESTRATOR_CORRECTION_PACKET_PREFIX).length - 1,
        });
        finishSyntheticCompletion(
          response,
          ORCHESTRATOR_CORRECTION_RESPONSE_MARKER,
          'chatcmpl-orchestrator-correction-acceptance',
          { model, promptTokens: 25_000, completionTokens: 25_000 }
        );
        return;
      }
      if (
        promptText.includes('The durable goal remains active:') &&
        promptText.includes('complete_goal')
      ) {
        const requestIndex = goalContinuationRequests.length + 1;
        goalContinuationRequests.push({ model, requestIndex });
        finishSyntheticCompletion(
          response,
          `AIRC_ORCHESTRATOR_GOAL_PROGRESS_RECORDED_${requestIndex}`,
          `chatcmpl-orchestrator-goal-progress-${requestIndex}`,
          { model, promptTokens: 8, completionTokens: 4 }
        );
        return;
      }
      response.statusCode = 400;
      response.end(JSON.stringify({ error: 'Unexpected synthetic acceptance prompt' }));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'Synthetic acceptance endpoint not implemented' }));
  });

  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolveListen);
  });
  return {
    server,
    requests,
    get activeAutomationRunCount() {
      return activeAutomationResponses.size;
    },
    get automationRequestCount() {
      return automationRequestCount;
    },
    get automationResponseCloseCount() {
      return automationResponseCloseCount;
    },
    get interactivePromptTexts() {
      return [...interactivePromptTexts];
    },
    get interactivePromptOccurrenceCounts() {
      return [...interactivePromptOccurrenceCounts];
    },
    get interactiveRequestCount() {
      return interactiveRequestCount;
    },
    get activeOrchestratorReviewCount() {
      return activeOrchestratorResponses.size;
    },
    get orchestratorRequests() {
      return orchestratorRequests.map((entry) => ({ ...entry }));
    },
    get orchestratorResponseCloseCount() {
      return orchestratorResponseCloseCount;
    },
    get correctionRequests() {
      return correctionRequests.map((entry) => ({ ...entry }));
    },
    get goalContinuationRequests() {
      return goalContinuationRequests.map((entry) => ({ ...entry }));
    },
    finishAutomationRuns() {
      for (const response of [...activeAutomationResponses]) {
        if (response.destroyed || response.writableEnded) continue;
        finishSyntheticCompletion(
          response,
          AUTOMATION_RESPONSE_MARKER,
          'chatcmpl-automation-acceptance'
        );
      }
    },
    finishOrchestratorReviews() {
      for (const [response, review] of [...activeOrchestratorResponses]) {
        if (response.destroyed || response.writableEnded) continue;
        finishSyntheticCompletion(
          response,
          orchestratorReviewResponse(review.requestIndex, review.evidenceIds),
          `chatcmpl-orchestrator-review-${review.requestIndex}`,
          {
            model: review.model || 'airc-reviewer:latest',
            promptTokens: review.requestIndex === 1 ? 300 : 200,
            completionTokens: review.requestIndex === 1 ? 80 : 40,
          }
        );
      }
    },
  };
}

async function stopServer(server) {
  if (!server) return;
  await new Promise((resolveClose) => server.close(() => resolveClose()));
}

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function waitFor(description, operation, timeoutMs = READY_TIMEOUT_MS, delayMs = 150) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await operation();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await wait(delayMs);
  }
  const detail = lastError instanceof Error ? `: ${lastError.message}` : '';
  fail(`Timed out waiting for ${description}${detail}`);
}

function createFixture(path, messageCount, workingDir) {
  const now = Date.now();
  const nowSeconds = Math.floor(now / 1_000);
  const firstMarker = `AIRC_ACCEPT_FIRST_${randomBytes(6).toString('hex')}`;
  const lastMarker = `AIRC_ACCEPT_LAST_${randomBytes(6).toString('hex')}`;
  const body = 'Synthetic installed-app replay evidence. '.repeat(18);
  const messages = [];

  for (let index = 0; index < messageCount; index += 1) {
    const marker = index === 0 ? firstMarker : index === messageCount - 1 ? lastMarker : '';
    messages.push({
      id: `accept-${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      created: nowSeconds - (messageCount - index),
      content: [
        {
          type: 'text',
          text: `${marker}${marker ? ' ' : ''}${body}Message ${index + 1} of ${messageCount}.`,
        },
      ],
      metadata: { userVisible: true, agentVisible: true },
    });
  }

  const timestamp = new Date(now).toISOString();
  const fixture = {
    id: 'installed-lifecycle-fixture',
    working_dir: workingDir,
    name: FIXTURE_NAME,
    user_set_name: true,
    session_type: 'user',
    created_at: timestamp,
    updated_at: timestamp,
    extension_data: {},
    accumulated_cost: null,
    schedule_id: null,
    recipe: null,
    user_recipe_values: null,
    conversation: messages,
    message_count: messages.length,
    provider_name: 'ollama',
    model_config: {
      model_name: 'airc:latest',
      context_limit: 262_144,
      temperature: null,
      max_tokens: null,
      toolshim: false,
      toolshim_model: null,
      reasoning: true,
    },
    goose_mode: 'auto',
    workflow: {
      goal: { objective: INITIAL_WORKFLOW_OBJECTIVE, status: 'active' },
      planMode: false,
      plan: {
        explanation: 'Exercise installed workflow persistence',
        items: [
          { step: 'Load the saved workflow', status: 'completed' },
          { step: 'Preserve the goal while clearing the plan', status: 'in_progress' },
        ],
      },
    },
  };

  writeFileSync(path, `${JSON.stringify(fixture)}\n`, { mode: 0o600 });
  return { firstMarker, lastMarker, bytes: statSync(path).size };
}

function createSingleSendFixture(path, workingDir) {
  const now = Date.now();
  const timestamp = new Date(now).toISOString();
  const initialMarker = `AIRC_SINGLE_SEND_READY_${randomBytes(6).toString('hex')}`;
  const fixture = {
    id: 'single-send-fixture',
    working_dir: workingDir,
    name: SINGLE_SEND_FIXTURE_NAME,
    user_set_name: true,
    session_type: 'user',
    created_at: timestamp,
    updated_at: timestamp,
    extension_data: {},
    accumulated_cost: null,
    schedule_id: null,
    recipe: null,
    user_recipe_values: null,
    conversation: [
      {
        id: 'single-send-user-ready',
        role: 'user',
        created: Math.floor(now / 1_000) - 1,
        content: [{ type: 'text', text: 'Prepare the single-send acceptance task.' }],
        metadata: { userVisible: true, agentVisible: true },
      },
      {
        id: 'single-send-assistant-ready',
        role: 'assistant',
        created: Math.floor(now / 1_000),
        content: [{ type: 'text', text: initialMarker }],
        metadata: { userVisible: true, agentVisible: true },
      },
    ],
    message_count: 2,
    provider_name: 'ollama',
    model_config: {
      model_name: 'airc:latest',
      context_limit: 262_144,
      temperature: null,
      max_tokens: null,
      toolshim: false,
      toolshim_model: null,
      reasoning: true,
    },
    goose_mode: 'auto',
    workflow: {},
  };

  writeFileSync(path, `${JSON.stringify(fixture)}\n`, { mode: 0o600 });
  return { initialMarker, bytes: statSync(path).size };
}

function createOrchestratorFixture(path, workingDir) {
  const now = Date.now();
  const timestamp = new Date(now).toISOString();
  const initialMarker = `AIRC_ORCHESTRATOR_READY_${randomBytes(6).toString('hex')}`;
  const fixture = {
    id: 'orchestrator-lifecycle-fixture',
    working_dir: workingDir,
    name: ORCHESTRATOR_FIXTURE_NAME,
    user_set_name: true,
    session_type: 'user',
    created_at: timestamp,
    updated_at: timestamp,
    extension_data: {},
    usage: {},
    accumulated_usage: {
      input_tokens: 40_000,
      output_tokens: 10_000,
      total_tokens: 50_000,
    },
    accumulated_cost: null,
    schedule_id: null,
    recipe: null,
    user_recipe_values: null,
    conversation: [
      {
        id: 'orchestrator-user-request',
        role: 'user',
        created: Math.floor(now / 1_000) - 1,
        content: [
          {
            type: 'text',
            text: `Complete the implementation and validate it independently. api_key=${ORCHESTRATOR_SECRET_CANARY}`,
          },
        ],
        metadata: { userVisible: true, agentVisible: true },
      },
      {
        id: 'orchestrator-assistant-result',
        role: 'assistant',
        created: Math.floor(now / 1_000),
        content: [
          {
            type: 'text',
            text: `${initialMarker} The implementation is recorded, but validation was not run.`,
          },
        ],
        metadata: { userVisible: true, agentVisible: true },
      },
    ],
    message_count: 2,
    provider_name: 'ollama',
    model_config: {
      model_name: 'airc:latest',
      context_limit: 262_144,
      temperature: null,
      max_tokens: null,
      toolshim: false,
      toolshim_model: null,
      reasoning: true,
    },
    goose_mode: 'auto',
    workflow: {
      goal: {
        objective: 'Complete and independently validate the installed Orchestrator fixture',
        status: 'active',
      },
      planMode: false,
      plan: {
        explanation: 'Require evidence before declaring the fixture complete',
        items: [
          { step: 'Record the implementation', status: 'completed' },
          { step: 'Run independent validation', status: 'in_progress' },
        ],
      },
    },
    orchestrator: {
      overrideConfig: {
        enabled: true,
        reviewer: {
          providerId: 'ollama',
          modelId: 'airc-reviewer:latest',
        },
        cadence: 'manual',
        correctionPolicy: 'ask_working_agent',
        reviewBudget: 'efficient',
        maxCorrectionCycles: 2,
      },
    },
  };

  writeFileSync(path, `${JSON.stringify(fixture)}\n`, { mode: 0o600 });
  return { initialMarker, bytes: statSync(path).size };
}

function createAutomationRecipe(path) {
  writeFileSync(
    path,
    [
      'version: 1.0.0',
      'title: Installed automation lifecycle acceptance',
      'description: Verifies scheduler ownership across renderer recovery',
      `prompt: Return exactly ${AUTOMATION_RESPONSE_MARKER}`,
      '',
    ].join('\n'),
    { mode: 0o600 }
  );
}

function isolatedEnvironment(root, extra = {}) {
  const home = join(root, 'home');
  const xdg = join(root, 'xdg');
  mkdirSync(home, { recursive: true, mode: 0o700 });
  mkdirSync(join(xdg, 'config'), { recursive: true, mode: 0o700 });
  mkdirSync(join(xdg, 'data'), { recursive: true, mode: 0o700 });
  mkdirSync(join(xdg, 'state'), { recursive: true, mode: 0o700 });
  mkdirSync(join(xdg, 'cache'), { recursive: true, mode: 0o700 });

  const environment = isolatedConfigEnvironment(process.env, {
    HOME: home,
    SHELL: '/bin/sh',
    XDG_CONFIG_HOME: join(xdg, 'config'),
    XDG_DATA_HOME: join(xdg, 'data'),
    XDG_STATE_HOME: join(xdg, 'state'),
    XDG_CACHE_HOME: join(xdg, 'cache'),
    AIRC_PATH_ROOT: join(root, 'airc-root'),
    GOOSE_DISABLE_KEYRING: '1',
    AIRC_DISABLE_KEYRING: '1',
    ...(process.platform === 'win32' ? isolatedWindowsEnvironment(root) : {}),
    ...extra,
  });
  if (process.platform === 'win32') {
    for (const path of [environment.APPDATA, environment.LOCALAPPDATA]) {
      mkdirSync(path, { recursive: true, mode: 0o700 });
    }
  }
  return environment;
}

function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    encoding: 'utf8',
    env: options.env ?? process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    fail(
      `${binary} ${args.join(' ')} failed (${result.status})\n${result.stdout ?? ''}${result.stderr ?? ''}`
    );
  }
  return result.stdout;
}

function spawnLogged(name, binary, args, environment, logDir) {
  const stdoutPath = join(logDir, `${name}.stdout.log`);
  const stderrPath = join(logDir, `${name}.stderr.log`);
  const stdout = openSync(stdoutPath, 'w', 0o600);
  const stderr = openSync(stderrPath, 'w', 0o600);
  const child = spawn(binary, args, {
    env: environment,
    detached: process.platform !== 'win32',
    windowsHide: true,
    stdio: ['ignore', stdout, stderr],
  });
  closeSync(stdout);
  closeSync(stderr);
  child.once('error', (error) => {
    process.stderr.write(`${name} failed to start: ${error.message}\n`);
  });
  return { child, stdoutPath, stderrPath };
}

function signalProcessGroup(processRecord, signal) {
  return signalOwnedProcess(processRecord, signal);
}

async function stopProcess(processRecord) {
  if (!processRecord?.child?.pid) return;
  const exit =
    processRecord.child.exitCode !== null || processRecord.child.signalCode !== null
      ? Promise.resolve(true)
      : new Promise((resolveExit) => processRecord.child.once('exit', () => resolveExit(true)));
  if (process.platform !== 'win32') signalProcessGroup(processRecord, 'SIGCONT');
  signalProcessGroup(processRecord, 'SIGTERM');
  const exited = await Promise.race([exit, wait(5_000).then(() => false)]);
  if (!exited) {
    signalProcessGroup(processRecord, 'SIGKILL');
    await wait(250);
  }
}

async function waitForBackend(port) {
  const url = `http://127.0.0.1:${port}/status`;
  return waitFor('the packaged backend', async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
    return response.ok;
  });
}

async function connectToElectron(port) {
  return waitFor(
    'the installed Electron CDP endpoint',
    () => chromium.connectOverCDP(`http://127.0.0.1:${port}`),
    READY_TIMEOUT_MS,
    250
  );
}

async function readyPage(browser) {
  return waitFor(
    'a ready AiRC renderer page',
    async () => {
      for (const context of browser.contexts()) {
        for (const candidate of context.pages()) {
          if (candidate.isClosed()) continue;
          const ready = await candidate
            .evaluate(() => Boolean(document.getElementById('root')?.children.length))
            .catch(() => false);
          if (ready) return candidate;
        }
      }
      return null;
    },
    READY_TIMEOUT_MS,
    250
  );
}

async function rendererTargetCount(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(1_000),
    });
    if (!response.ok) return 0;
    const targets = await response.json();
    return Array.isArray(targets) ? targets.filter((target) => target?.type === 'page').length : 0;
  } catch {
    return 0;
  }
}

async function waitForRendererTargetsToStayAbsent(port, stableMs = 5_000, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let absentSince = null;
  while (Date.now() < deadline) {
    if ((await rendererTargetCount(port)) === 0) {
      absentSince ??= Date.now();
      if (Date.now() - absentSince >= stableMs) return;
    } else {
      absentSince = null;
    }
    await wait(150);
  }
  fail('The third rapid renderer failure reopened a page instead of closing the failing window');
}

async function visibleTextCount(page, text, exact = false) {
  const matches = page.getByText(text, { exact });
  let visible = 0;
  for (let index = 0; index < (await matches.count()); index += 1) {
    if (
      await matches
        .nth(index)
        .isVisible()
        .catch(() => false)
    )
      visible += 1;
  }
  return visible;
}

async function assertNoTaskFailureSurface(page) {
  for (const text of ['Failed to Load Task', 'Connection lost']) {
    if ((await visibleTextCount(page, text)) > 0) {
      fail(`Unexpected task failure surface was visible: ${text}`);
    }
  }
}

async function openWorkflowPanel(page) {
  const trigger = page.getByRole('button', { name: 'Goal', exact: true });
  await trigger.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
  await trigger.click();
  const panel = page.getByRole('dialog', { name: 'Goal and Plan Mode' });
  await panel.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
  return panel;
}

async function assertWorkflowPanel(page, objective, expectPlan) {
  const panel = await openWorkflowPanel(page);
  const input = panel.getByRole('textbox', { name: 'Goal objective' });
  if ((await input.inputValue()) !== objective) {
    fail(`Installed workflow objective did not persist: ${await input.inputValue()}`);
  }
  const clearPlan = panel.getByRole('button', { name: 'Clear plan', exact: true });
  if ((await clearPlan.count()) !== (expectPlan ? 1 : 0)) {
    fail(`Installed workflow plan persistence did not match the expected state`);
  }
  return { input, panel };
}

async function ensureFixtureTaskOpen(page, lastMarker) {
  if (
    await page
      .getByText(lastMarker, { exact: false })
      .isVisible()
      .catch(() => false)
  )
    return;
  const taskEntry = page.getByText(FIXTURE_NAME, { exact: true }).first();
  await taskEntry.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
  await taskEntry.click();
  await page.getByText(lastMarker, { exact: false }).waitFor({
    state: 'visible',
    timeout: LOAD_TIMEOUT_MS,
  });
}

async function ensureNamedTaskOpen(page, name, visibleMarker) {
  if (
    await page
      .getByText(visibleMarker, { exact: false })
      .isVisible()
      .catch(() => false)
  )
    return;
  const taskEntry = page.getByText(name, { exact: true }).first();
  await taskEntry.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
  await taskEntry.click();
  await page.getByText(visibleMarker, { exact: false }).waitFor({
    state: 'visible',
    timeout: LOAD_TIMEOUT_MS,
  });
}

function userMessageText(message) {
  if (!message || message.role !== 'user' || !Array.isArray(message.content)) return '';
  return message.content
    .filter((content) => content?.type === 'text' && typeof content.text === 'string')
    .map((content) => content.text)
    .join('');
}

function assertSingleSendPersistence(backendBinary, sessionId, environment, singleSendText) {
  const exported = JSON.parse(
    run(backendBinary, ['session', 'export', '--session-id', sessionId, '--format', 'json'], {
      env: environment,
    })
  );
  const messages = Array.isArray(exported.conversation) ? exported.conversation : [];
  const exactMatches = messages.filter((message) => userMessageText(message) === singleSendText);
  if (exactMatches.length !== 1) {
    fail(`Expected one persisted single-send prompt, found ${exactMatches.length}`);
  }
  const repeatedText = `${singleSendText} ${singleSendText}`;
  if (messages.some((message) => userMessageText(message) === repeatedText)) {
    fail('The single-send prompt was persisted twice inside one message');
  }
  return exactMatches[0].id;
}

function messageText(message) {
  if (!message || !Array.isArray(message.content)) return '';
  return message.content
    .filter((content) => content?.type === 'text' && typeof content.text === 'string')
    .map((content) => content.text)
    .join('');
}

function assertOrchestratorPersistence(backendBinary, sessionId, environment) {
  const exported = JSON.parse(
    run(backendBinary, ['session', 'export', '--session-id', sessionId, '--format', 'json'], {
      env: environment,
    })
  );
  const messages = Array.isArray(exported.conversation) ? exported.conversation : [];
  const correctionPackets = messages.filter(
    (message) =>
      message.role === 'user' &&
      messageText(message).includes(ORCHESTRATOR_CORRECTION_PACKET_PREFIX)
  );
  const correctionResponses = messages.filter(
    (message) =>
      message.role === 'assistant' &&
      messageText(message).includes(ORCHESTRATOR_CORRECTION_RESPONSE_MARKER)
  );
  if (correctionPackets.length !== 1) {
    fail(
      `Expected one persisted Orchestrator correction packet, found ${correctionPackets.length}`
    );
  }
  if (correctionResponses.length !== 1) {
    fail(
      `Expected one persisted Orchestrator correction response, found ${correctionResponses.length}`
    );
  }

  const orchestrator = exported.orchestrator ?? {};
  const overrideConfig = orchestrator.overrideConfig ?? {};
  const lastRun = orchestrator.lastRun ?? null;
  if (overrideConfig.enabled !== true) fail('The Orchestrator task opt-in did not persist');
  if (overrideConfig.reviewer?.providerId !== 'ollama') {
    fail('The persisted Orchestrator reviewer provider changed');
  }
  if (overrideConfig.reviewer?.modelId !== 'airc-reviewer:latest') {
    fail('The persisted Orchestrator reviewer model changed');
  }
  if (exported.provider_name !== 'ollama' || exported.model_config?.model_name !== 'airc:latest') {
    fail('The working task model changed while the Orchestrator ran');
  }
  if (
    !lastRun ||
    lastRun.trigger !== 'correction' ||
    lastRun.verdict !== 'pass' ||
    lastRun.summary !== ORCHESTRATOR_RECHECK_SUMMARY ||
    lastRun.objective !== ORCHESTRATOR_OBJECTIVE ||
    lastRun.stale
  ) {
    fail('The persisted Orchestrator re-check did not contain the expected verified result');
  }
  if ((lastRun.usage?.reviewToWorkingBasisPoints ?? Number.MAX_SAFE_INTEGER) > 1_000) {
    fail('The automatic Orchestrator re-check exceeded the 10% worker-token guardrail');
  }
  if (orchestrator.correctionCycleCount !== 1) {
    fail(
      `Expected one committed correction cycle, found ${orchestrator.correctionCycleCount ?? 0}`
    );
  }
  if (orchestrator.accumulatedReviewRequestCount !== 2) {
    fail(
      `Expected two persisted reviewer requests, found ${orchestrator.accumulatedReviewRequestCount ?? 0}`
    );
  }
  if (orchestrator.pendingRecommendation != null || orchestrator.reviewRunning) {
    fail('The completed Orchestrator re-check left pending or running state');
  }
  for (const privateField of [
    'reviewOwnerId',
    'reviewLeaseExpiresAt',
    'correctionReservationId',
    'correctionReservationOwnerId',
    'correctionReservationExpiresAt',
  ]) {
    if (Object.hasOwn(orchestrator, privateField)) {
      fail(`Private Orchestrator ownership leaked through task export: ${privateField}`);
    }
  }
  return {
    packetMessageId: correctionPackets[0].id,
    correctionResponseMessageId: correctionResponses[0].id,
    reviewToWorkingBasisPoints: lastRun.usage.reviewToWorkingBasisPoints,
    reviewerRequestCount: orchestrator.accumulatedReviewRequestCount,
  };
}

async function assertSingleSendUi(page, singleSendText) {
  await page.getByText(INTERACTIVE_RESPONSE_MARKER, { exact: true }).waitFor({
    state: 'visible',
    timeout: READY_TIMEOUT_MS,
  });
  const prompt = page.getByText(singleSendText, { exact: true });
  if ((await prompt.count()) !== 1) {
    fail(`Expected one visible single-send prompt, found ${await prompt.count()}`);
  }
  await prompt.scrollIntoViewIfNeeded();
  await prompt.hover();
  const preview = `${singleSendText.substring(0, 50)}...`;
  const edit = page.getByRole('button', { name: `Edit message: ${preview}`, exact: true });
  await edit.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
  await edit.focus();
  await edit.press('Enter');
  const editor = page.getByRole('textbox', { name: 'Edit message content', exact: true });
  await editor.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
  if ((await editor.inputValue()) !== singleSendText) {
    fail('The Edit field did not preserve the single-send prompt exactly once');
  }
  await page.getByRole('button', { name: 'Cancel editing', exact: true }).click();
  await editor.waitFor({ state: 'detached', timeout: READY_TIMEOUT_MS });
}

async function ensureAutomationDetailOpen(page) {
  const runNow = page.getByRole('button', { name: 'Run now', exact: true });
  if (await runNow.isVisible().catch(() => false)) return;

  const automations = page.getByText('Automations', { exact: true }).first();
  await automations.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
  await automations.click();
  const automation = page.getByRole('button', {
    name: `Open automation: ${AUTOMATION_ID}`,
    exact: true,
  });
  await automation.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
  await automation.click();
  await runNow.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
}

async function crashRenderer(page) {
  const session = await page.context().newCDPSession(page);
  const crashResult = await Promise.race([
    session.send('Page.crash').then(
      () => null,
      (error) => error
    ),
    wait(2_000).then(() => null),
  ]);
  if (crashResult) {
    const error = crashResult;
    const message = error instanceof Error ? error.message : String(error);
    if (!/crash|closed|target/i.test(message)) throw error;
  }
}

function resolveDesktopBinary(appPath) {
  const { desktop } = installedBinaryPaths(appPath);
  if (existsSync(desktop)) return desktop;
  if (process.platform === 'darwin') {
    const capitalized = join(appPath, 'Contents', 'MacOS', 'AiRC');
    if (existsSync(capitalized)) return capitalized;
  }
  fail(`Installed AiRC executable is missing: ${desktop}`);
}

async function assertInstalledUpdaterCheck(page, evidenceDir) {
  if (process.platform !== 'darwin') return;

  await page.screenshot({ path: join(evidenceDir, '00-updater-before-input.png'), timeout: 5000 });
  writeFileSync(join(evidenceDir, 'updater-input-geometry.json'), JSON.stringify(await page.getByRole('button', { name: 'Settings', exact: true }).evaluate(element => ({rect:element.getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight],visibility:document.visibilityState,focus:document.hasFocus()})),null,2));
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const appTab = page.getByRole('tab', { name: 'App', exact: true });
  await appTab.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
  await appTab.click();
  await page.getByText(DESKTOP_RELEASE_VERSION, { exact: true }).waitFor({
    state: 'visible',
    timeout: READY_TIMEOUT_MS,
  });

  const checkForUpdates = page.getByRole('button', {
    name: 'Check for Updates',
    exact: true,
  });
  await checkForUpdates.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
  await checkForUpdates.click();
  await waitFor(
    'the installed updater check to start',
    async () =>
      (await checkForUpdates.isDisabled()) ||
      (await page
        .getByText('Checking for updates...', { exact: true })
        .isVisible()
        .catch(() => false)),
    10_000,
    50
  );
  await waitFor(
    'the installed updater check to finish without an alert',
    async () => {
      const alert = page.getByRole('alert');
      if (await alert.isVisible().catch(() => false)) {
        fail(`Installed updater check failed: ${(await alert.innerText()).slice(0, 500)}`);
      }
      return (
        (await checkForUpdates.isEnabled()) &&
        (await page
          .getByText('(up to date)', { exact: true })
          .isVisible()
          .catch(() => false))
      );
    },
    READY_TIMEOUT_MS,
    100
  );
  await page.screenshot({
    path: join(evidenceDir, '00-updater-check.png'),
    fullPage: false,
  });
}


async function assertNativeProjectTerminal(page, workingDirectory) {
  const result = await page.evaluate(async (cwd) => {
    const api = window.electron;
    return await new Promise((resolve, reject) => {
      let session;
      let output = '';
      let exit;
      let settled = false;
      let dataListener;
      let exitListener;
      const cleanup = () => {
        clearTimeout(timer);
        api.off('project-terminal-data', dataListener);
        api.off('project-terminal-exit', exitListener);
      };
      const failed = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (session) void api.stopProjectTerminal({ sessionId: session.sessionId });
        reject(error);
      };
      const complete = () => {
        if (settled || !output.includes('AIRC_NATIVE_PTY_OK') || !exit) return;
        if (exit.exitCode !== 0) return failed(new Error('Native terminal did not exit successfully'));
        settled = true;
        cleanup();
        resolve({ shell: session.shell, cwd: session.cwd, outputVerified: true, exitCode: exit.exitCode });
      };
      const timer = setTimeout(() => failed(new Error('Native terminal output timed out')), 35_000);
      dataListener = api.on('project-terminal-data', (event) => {
        if (session && event.sessionId === session.sessionId) {
          output = (output + event.data).slice(-32_768);
          complete();
        }
      });
      exitListener = api.on('project-terminal-exit', (event) => {
        if (session && event.sessionId === session.sessionId) {
          exit = event;
          complete();
        }
      });
      void api.startProjectTerminal({ workingDirectory: cwd, columns: 80, rows: 24 }).then((started) => {
        session = started;
        if (settled) {
          void api.stopProjectTerminal({ sessionId: session.sessionId });
          return;
        }
        api.writeProjectTerminal({ sessionId: session.sessionId, data: "printf 'AIRC_NATIVE_%s_%s\\n' PTY OK; exit\r" });
      }, failed);
    });
  }, workingDirectory);
  if (!result.outputVerified || result.exitCode !== 0 || result.shell !== 'sh' ||
      realpathSync(result.cwd) !== realpathSync(workingDirectory)) {
    fail('Packaged native terminal did not preserve its isolated shell and directory');
  }
  return { passed: true, shell: result.shell, outputVerified: true, exitCode: result.exitCode };
}

async function runAcceptance(options) {
  if (!['darwin', 'linux', 'win32'].includes(process.platform)) {
    fail('This harness targets installed macOS, Linux or Windows AiRC applications');
  }

  const appPath = resolve(options.appPath);
  const desktopBinary = resolveDesktopBinary(appPath);
  const { backend: backendBinary } = installedBinaryPaths(appPath);
  for (const path of [appPath, desktopBinary, backendBinary]) {
    if (!existsSync(path)) fail(`Installed AiRC path does not exist: ${path}`);
  }
  assertNoExistingInstalledApp(desktopBinary);

  const profileCreatedAfter = new Date(Date.now() - 1_000).toISOString();
  const root = mkdtempSync(join(tmpdir(), 'airc-installed-lifecycle-'));
  assertSafeTemporaryRoot(root);
  try {
    prepareProfileOwnership(root, profileCreatedAfter);
  } catch (error) {
    rmSync(root, { recursive: true, force: false });
    throw error;
  }
  const logDir = join(root, 'logs');
  const profileDir = join(root, 'electron-profile');
  mkdirSync(logDir, { recursive: true, mode: 0o700 });
  mkdirSync(profileDir, { recursive: true, mode: 0o700 });
  const desktopArguments = [`--user-data-dir=${profileDir}`];
  if (process.platform === 'linux') {
    desktopArguments.push(
      '--ozone-platform=x11',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    );
  }

  const evidenceDir = options.outputDir ? resolve(options.outputDir) : join(root, 'evidence');
  mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
  writeAcceptanceReceipt(evidenceDir, {
    status: 'running',
    root,
    startedAt: new Date().toISOString(),
  });
  const retainProfile = acceptanceProfileRetained(root, options);
  const projectDir = join(root, 'airc-installed-lifecycle-project');
  mkdirSync(projectDir, { recursive: true, mode: 0o700 });
  const fixturePath = join(root, 'session.json');
  const fixture = createFixture(fixturePath, options.messageCount, projectDir);
  const singleSendFixturePath = join(root, 'single-send-session.json');
  const singleSendFixture = createSingleSendFixture(singleSendFixturePath, projectDir);
  const orchestratorFixturePath = join(root, 'orchestrator-session.json');
  const orchestratorFixture = createOrchestratorFixture(orchestratorFixturePath, projectDir);
  const singleSendText = `AiRC single-send acceptance ${randomBytes(8).toString('hex')}: preserve this complete prompt exactly once when it is sent, replayed, and opened for editing.`;
  const automationRecipePath = join(root, 'automation.yaml');
  createAutomationRecipe(automationRecipePath);
  const secret = randomBytes(32).toString('hex');
  const baseEnvironment = isolatedEnvironment(root);
  let backend = null;
  let desktop = null;
  let browser = null;
  const browserConnections = [];
  let page = null;
  let syntheticOllama = null;
  let responseGate = null;
  const consoleErrors = [];
  const pageErrors = [];
  const startedAt = new Date().toISOString();
  const measurements = {};
  let passed = false;
  let result;

  try {
    run(backendBinary, ['session', 'import', fixturePath], { env: baseEnvironment });
    run(backendBinary, ['session', 'import', singleSendFixturePath], { env: baseEnvironment });
    run(backendBinary, ['session', 'import', orchestratorFixturePath], { env: baseEnvironment });
    run(
      backendBinary,
      [
        'schedule',
        'add',
        '--schedule-id',
        AUTOMATION_ID,
        '--cron',
        '0 0 0 1 1 *',
        '--recipe-source',
        automationRecipePath,
      ],
      { env: baseEnvironment }
    );
    const sessions = JSON.parse(
      run(backendBinary, ['session', 'list', '--format', 'json'], { env: baseEnvironment })
    );
    const imported = sessions.find((session) => session.name === FIXTURE_NAME);
    if (!imported?.id)
      fail('Imported acceptance task was not present in the isolated session list');
    const sessionId = imported.id;
    const importedSingleSend = sessions.find(
      (session) => session.name === SINGLE_SEND_FIXTURE_NAME
    );
    if (!importedSingleSend?.id) {
      fail('Imported single-send task was not present in the isolated session list');
    }
    const singleSendSessionId = importedSingleSend.id;
    const importedOrchestrator = sessions.find(
      (session) => session.name === ORCHESTRATOR_FIXTURE_NAME
    );
    if (!importedOrchestrator?.id) {
      fail('Imported Orchestrator task was not present in the isolated session list');
    }
    const orchestratorSessionId = importedOrchestrator.id;

    const backendPort = await reservePort();
    const debugPort = await reservePort();
    const ollamaPort = await reservePort();
    syntheticOllama = await startSyntheticOllama(ollamaPort, singleSendText);
    const runtimeEnvironment = isolatedEnvironment(root, {
      AIRC_SERVER__SECRET_KEY: secret,
      AIRC_PROVIDER: 'ollama',
      AIRC_MODEL: 'airc:latest',
      AIRC_TELEMETRY_ENABLED: 'false',
      OLLAMA_HOST: `http://127.0.0.1:${ollamaPort}`,
      RUST_LOG: 'info',
    });

    backend = spawnLogged(
      'backend',
      backendBinary,
      [
        'serve',
        '--platform',
        'desktop',
        '--host',
        '127.0.0.1',
        '--port',
        String(backendPort),
        '--enable-scheduler',
      ],
      runtimeEnvironment,
      logDir
    );
    await waitForBackend(backendPort);
    if (process.platform === 'win32') {
      responseGate = await startBackendResponseGate(backendPort);
    }
    const desktopBackendPort = responseGate?.port ?? backendPort;
    measurements.delayedValidationMethod = responseGate
      ? 'loopback-response-backpressure'
      : 'owned-backend-signal';

    desktop = spawnLogged(
      'desktop',
      desktopBinary,
      desktopArguments,
      {
        ...runtimeEnvironment,
        AIRC_EXTERNAL_BACKEND: '1',
        AIRC_EXTERNAL_BACKEND_URL: `http://127.0.0.1:${desktopBackendPort}`,
        ENABLE_PLAYWRIGHT: '1',
        PLAYWRIGHT_DEBUG_PORT: String(debugPort),
        ELECTRON_ENABLE_LOGGING: '1',
      },
      logDir
    );

    browser = await connectToElectron(debugPort);
    browserConnections.push(browser);
    page = await readyPage(browser);
    const registerPageDiagnostics = (targetPage) => {
      targetPage.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      targetPage.on('pageerror', (error) => pageErrors.push(error.message));
    };
    registerPageDiagnostics(page);
    measurements.desktopTreeRssKbBeforeReplay = processTreeRssKb(desktop.child.pid);

    const telemetryOptOut = page.getByRole('button', { name: 'No thanks' });
    if (await telemetryOptOut.isVisible().catch(() => false)) {
      await telemetryOptOut.click();
      await telemetryOptOut.waitFor({ state: 'hidden', timeout: READY_TIMEOUT_MS });
    }

    await assertInstalledUpdaterCheck(page, evidenceDir);
    measurements.packagedUpdaterCheckPassed = process.platform === 'darwin';

    const projectToggle = page
      .locator('[data-project-toggle]')
      .filter({ hasText: 'airc-installed-lifecycle-project' });
    await projectToggle.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    if ((await projectToggle.getAttribute('aria-expanded')) !== 'true') {
      await projectToggle.evaluate((element) => element.click());
      await waitFor(
        'the imported project to expand',
        async () => (await projectToggle.getAttribute('aria-expanded')) === 'true'
      );
    }

    const taskEntry = page.getByText(FIXTURE_NAME, { exact: true }).first();
    await taskEntry.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    await page.screenshot({ path: join(evidenceDir, '00-home.png'), fullPage: false });
    measurements.sidebarFixtureVisible = true;

    if (responseGate) responseGate.pauseResponses();
    else signalProcessGroup(backend, 'SIGSTOP');
    const validationStartedAt = Date.now();
    await taskEntry.click();
    await page.getByText('AiRC is loading the conversation...', { exact: true }).waitFor({
      state: 'visible',
      timeout: READY_TIMEOUT_MS,
    });
    if ((await visibleTextCount(page, 'AiRC is loading the conversation...', true)) !== 1) {
      fail('The conversation loading status appeared more than once');
    }
    await assertNoTaskFailureSurface(page);

    const composer = page.getByTestId('chat-input');
    await composer.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    await composer.fill(DRAFT_TEXT);
    if ((await composer.inputValue()) !== DRAFT_TEXT) {
      fail('The validation-time draft was not preserved in the composer');
    }

    const sendButton = page.getByRole('button', { name: 'Send', exact: true });
    if (!(await sendButton.isDisabled())) {
      fail('Send was enabled before cached-task validation completed');
    }
    if ((await page.getByRole('button', { name: 'Stop' }).count()) !== 0) {
      fail('A plain conversation replay exposed a Stop button without a running model');
    }
    await page.screenshot({ path: join(evidenceDir, '01-validation-paused.png'), fullPage: false });

    if (responseGate) responseGate.resumeResponses();
    else signalProcessGroup(backend, 'SIGCONT');
    await page.getByText(fixture.lastMarker, { exact: false }).waitFor({
      state: 'visible',
      timeout: LOAD_TIMEOUT_MS,
    });
    await page.getByText('AiRC is loading the conversation...', { exact: true }).waitFor({
      state: 'hidden',
      timeout: READY_TIMEOUT_MS,
    });
    await waitFor(
      'Send to become available after validation',
      async () => !(await sendButton.isDisabled())
    );
    if ((await composer.inputValue()) !== DRAFT_TEXT) {
      fail('The draft changed while conversation replay completed');
    }
    if ((await page.getByText(fixture.lastMarker, { exact: false }).count()) !== 1) {
      fail('The final fixture message appeared more than once after replay');
    }
    await page.getByText(/262k/i).last().waitFor({
      state: 'visible',
      timeout: READY_TIMEOUT_MS,
    });
    await assertNoTaskFailureSurface(page);
    measurements.delayedValidationMs = Date.now() - validationStartedAt;
    measurements.desktopTreeRssKbAfterReplay = processTreeRssKb(desktop.child.pid);
    if (
      measurements.desktopTreeRssKbBeforeReplay !== null &&
      measurements.desktopTreeRssKbAfterReplay !== null
    ) {
      measurements.desktopTreeRssGrowthKb =
        measurements.desktopTreeRssKbAfterReplay - measurements.desktopTreeRssKbBeforeReplay;
      const maximumGrowthKb = options.maxRssGrowthMiB * 1024;
      if (measurements.desktopTreeRssGrowthKb > maximumGrowthKb) {
        fail(
          `Desktop process-tree RSS grew by ${measurements.desktopTreeRssGrowthKb} KiB, above the ${maximumGrowthKb} KiB acceptance limit`
        );
      }
    }
    await page.screenshot({ path: join(evidenceDir, '02-replay-complete.png'), fullPage: false });

    measurements.nativeTerminal = await assertNativeProjectTerminal(page, projectDir);

    const initialWorkflow = await assertWorkflowPanel(page, INITIAL_WORKFLOW_OBJECTIVE, true);
    await initialWorkflow.input.fill(UPDATED_WORKFLOW_OBJECTIVE);
    await initialWorkflow.panel.getByRole('button', { name: 'Update goal' }).click();
    await initialWorkflow.panel.getByRole('button', { name: 'Clear plan', exact: true }).click();
    await initialWorkflow.panel
      .getByRole('button', { name: 'Clear plan', exact: true })
      .waitFor({ state: 'detached', timeout: READY_TIMEOUT_MS });
    if ((await initialWorkflow.input.inputValue()) !== UPDATED_WORKFLOW_OBJECTIVE) {
      fail('The installed workflow goal changed while its plan was cleared');
    }
    await page.screenshot({
      path: join(evidenceDir, '03-workflow-updated.png'),
      fullPage: false,
    });
    await initialWorkflow.panel.getByRole('button', { name: 'Close' }).click();
    measurements.workflowEdited = true;

    await ensureNamedTaskOpen(page, SINGLE_SEND_FIXTURE_NAME, singleSendFixture.initialMarker);
    await assertNoTaskFailureSurface(page);
    const singleSendComposer = page.getByTestId('chat-input');
    await singleSendComposer.fill(singleSendText);
    if ((await singleSendComposer.inputValue()) !== singleSendText) {
      fail('The single-send prompt changed before submission');
    }
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await assertSingleSendUi(page, singleSendText);
    if (syntheticOllama.interactiveRequestCount !== 1) {
      fail(
        `Expected one interactive model request, found ${syntheticOllama.interactiveRequestCount}`
      );
    }
    if (
      syntheticOllama.interactivePromptTexts.length !== 1 ||
      syntheticOllama.interactivePromptOccurrenceCounts.length !== 1 ||
      syntheticOllama.interactivePromptOccurrenceCounts[0] !== 1
    ) {
      fail('The model request did not contain the single-send prompt exactly once');
    }
    measurements.singleSendMessageId = assertSingleSendPersistence(
      backendBinary,
      singleSendSessionId,
      runtimeEnvironment,
      singleSendText
    );
    measurements.singleSendPersistedExactlyOnce = true;
    await page.screenshot({
      path: join(evidenceDir, '03-single-send-complete.png'),
      fullPage: false,
    });

    if (!options.skipRendererRecovery) {
      const firstCrashAt = Date.now();
      await crashRenderer(page);
      browser = await connectToElectron(debugPort);
      browserConnections.push(browser);
      page = await readyPage(browser);
      registerPageDiagnostics(page);
      await ensureNamedTaskOpen(page, SINGLE_SEND_FIXTURE_NAME, INTERACTIVE_RESPONSE_MARKER);
      await assertSingleSendUi(page, singleSendText);
      assertSingleSendPersistence(
        backendBinary,
        singleSendSessionId,
        runtimeEnvironment,
        singleSendText
      );
      measurements.singleSendSurvivedRendererRecovery = true;
      await ensureFixtureTaskOpen(page, fixture.lastMarker);
      await page.getByText(fixture.lastMarker, { exact: false }).waitFor({
        state: 'visible',
        timeout: LOAD_TIMEOUT_MS,
      });
      await page.getByText('Connection lost', { exact: true }).first().waitFor({ state: 'hidden', timeout: READY_TIMEOUT_MS });
      await assertNoTaskFailureSurface(page);
      measurements.firstRendererRecoveryMs = Date.now() - firstCrashAt;

      const secondCrashAt = Date.now();
      await crashRenderer(page);
      browser = await connectToElectron(debugPort);
      browserConnections.push(browser);
      page = await readyPage(browser);
      registerPageDiagnostics(page);
      await page.getByText(fixture.lastMarker, { exact: false }).waitFor({
        state: 'visible',
        timeout: LOAD_TIMEOUT_MS,
      });
      await assertNoTaskFailureSurface(page);
      measurements.secondRendererRecoveryMs = Date.now() - secondCrashAt;
      const recoveredWorkflow = await assertWorkflowPanel(page, UPDATED_WORKFLOW_OBJECTIVE, false);
      await recoveredWorkflow.panel.getByRole('button', { name: 'Close' }).click();
      measurements.workflowSurvivedRendererRecovery = true;
      await page.screenshot({
        path: join(evidenceDir, '03-repeated-recovery-complete.png'),
        fullPage: false,
      });
    }

    const desktopRestartAt = Date.now();
    await stopProcess(desktop);
    desktop = null;
    desktop = spawnLogged(
      'desktop-restarted',
      desktopBinary,
      desktopArguments,
      {
        ...runtimeEnvironment,
        AIRC_EXTERNAL_BACKEND: '1',
        AIRC_EXTERNAL_BACKEND_URL: `http://127.0.0.1:${desktopBackendPort}`,
        ENABLE_PLAYWRIGHT: '1',
        PLAYWRIGHT_DEBUG_PORT: String(debugPort),
        ELECTRON_ENABLE_LOGGING: '1',
      },
      logDir
    );
    browser = await connectToElectron(debugPort);
    browserConnections.push(browser);
    page = await readyPage(browser);
    registerPageDiagnostics(page);
    await ensureFixtureTaskOpen(page, fixture.lastMarker);
    await assertNoTaskFailureSurface(page);
    const restartedWorkflow = await assertWorkflowPanel(page, UPDATED_WORKFLOW_OBJECTIVE, false);
    measurements.desktopRestartMs = Date.now() - desktopRestartAt;
    measurements.workflowSurvivedDesktopRestart = true;
    await page.screenshot({
      path: join(evidenceDir, '04-desktop-restart-complete.png'),
      fullPage: false,
    });
    await restartedWorkflow.panel.getByRole('button', { name: 'Close' }).click();

    await ensureAutomationDetailOpen(page);
    const runNow = page.getByRole('button', { name: 'Run now', exact: true });
    const automationRunStartedAt = Date.now();
    await runNow.click();
    await waitFor(
      'the packaged automation model request',
      () => syntheticOllama.activeAutomationRunCount === 1
    );
    await page.getByText('Currently Running', { exact: true }).waitFor({
      state: 'visible',
      timeout: READY_TIMEOUT_MS,
    });
    if (!(await runNow.isDisabled())) {
      fail('Run now remained enabled while the automation was active');
    }
    await page
      .getByRole('button', { name: 'Inspect running automation', exact: true })
      .waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    await page
      .getByRole('button', { name: 'Stop running automation', exact: true })
      .waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    measurements.automationRunStartMs = Date.now() - automationRunStartedAt;
    await page.screenshot({
      path: join(evidenceDir, '05-automation-running.png'),
      fullPage: false,
    });

    if (!options.skipRendererRecovery) {
      const automationRecoveryAt = Date.now();
      await crashRenderer(page);
      browser = await connectToElectron(debugPort);
      browserConnections.push(browser);
      page = await readyPage(browser);
      registerPageDiagnostics(page);
      await ensureAutomationDetailOpen(page);
      await page.getByText('Currently Running', { exact: true }).waitFor({
        state: 'visible',
        timeout: READY_TIMEOUT_MS,
      });
      if (syntheticOllama.activeAutomationRunCount !== 1) {
        fail('The automation model request ended when its renderer request was interrupted');
      }
      await page
        .getByRole('button', { name: 'Inspect running automation', exact: true })
        .waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
      await page
        .getByRole('button', { name: 'Stop running automation', exact: true })
        .waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
      measurements.automationRendererRecoveryMs = Date.now() - automationRecoveryAt;
      await page.screenshot({
        path: join(evidenceDir, '06-automation-recovered.png'),
        fullPage: false,
      });
    }

    syntheticOllama.finishAutomationRuns();
    await waitFor(
      'the packaged automation response to close',
      () => syntheticOllama.activeAutomationRunCount === 0
    );
    const recoveredRunNow = page.getByRole('button', { name: 'Run now', exact: true });
    await waitFor(
      'the packaged automation to leave its running state',
      async () => !(await recoveredRunNow.isDisabled())
    );
    await page.getByText('Succeeded', { exact: true }).waitFor({
      state: 'visible',
      timeout: READY_TIMEOUT_MS,
    });
    if ((await page.getByText('Currently Running', { exact: true }).count()) !== 0) {
      fail('The completed automation remained marked as running');
    }
    measurements.automationCompletedAfterRecovery = true;

    const automationRestartAt = Date.now();
    await stopProcess(desktop);
    desktop = null;
    desktop = spawnLogged(
      'desktop-automation-restarted',
      desktopBinary,
      desktopArguments,
      {
        ...runtimeEnvironment,
        AIRC_EXTERNAL_BACKEND: '1',
        AIRC_EXTERNAL_BACKEND_URL: `http://127.0.0.1:${desktopBackendPort}`,
        ENABLE_PLAYWRIGHT: '1',
        PLAYWRIGHT_DEBUG_PORT: String(debugPort),
        ELECTRON_ENABLE_LOGGING: '1',
      },
      logDir
    );
    browser = await connectToElectron(debugPort);
    browserConnections.push(browser);
    page = await readyPage(browser);
    registerPageDiagnostics(page);
    await ensureAutomationDetailOpen(page);
    const restartedRunNow = page.getByRole('button', { name: 'Run now', exact: true });
    await waitFor(
      'the persisted automation state after desktop restart',
      async () => !(await restartedRunNow.isDisabled())
    );
    await page.getByText('Succeeded', { exact: true }).waitFor({
      state: 'visible',
      timeout: READY_TIMEOUT_MS,
    });
    if ((await page.getByText('Currently Running', { exact: true }).count()) !== 0) {
      fail('The automation returned to a running state after desktop restart');
    }
    measurements.automationSurvivedDesktopRestart = true;
    measurements.automationDesktopRestartMs = Date.now() - automationRestartAt;
    await page.screenshot({
      path: join(evidenceDir, '07-automation-restart-complete.png'),
      fullPage: false,
    });

    await ensureNamedTaskOpen(page, SINGLE_SEND_FIXTURE_NAME, INTERACTIVE_RESPONSE_MARKER);
    const disabledOrchestrator = page.getByRole('button', {
      name: 'Turn on Orchestrator',
      exact: true,
    });
    await disabledOrchestrator.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    const reviewRequestsBeforeOptIn = syntheticOllama.orchestratorRequests.length;
    await disabledOrchestrator.click();
    const optInDialog = page.getByRole('dialog', {
      name: 'Turn on Orchestrator for this task?',
      exact: true,
    });
    await optInDialog.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    await optInDialog.getByRole('button', { name: 'Keep off', exact: true }).click();
    await optInDialog.waitFor({ state: 'hidden', timeout: READY_TIMEOUT_MS });
    if (
      syntheticOllama.orchestratorRequests.length !== reviewRequestsBeforeOptIn ||
      syntheticOllama.activeOrchestratorReviewCount !== 0
    ) {
      fail('Orchestrator contacted the reviewer before explicit task opt-in');
    }
    measurements.orchestratorStayedOffByDefault = true;

    await ensureNamedTaskOpen(page, ORCHESTRATOR_FIXTURE_NAME, orchestratorFixture.initialMarker);
    await assertNoTaskFailureSurface(page);
    const enableOrchestrator = page.getByRole('button', {
      name: 'Turn on Orchestrator',
      exact: true,
    });
    await enableOrchestrator.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    await enableOrchestrator.click();
    const orchestratorOptInDialog = page.getByRole('dialog', {
      name: 'Turn on Orchestrator for this task?',
      exact: true,
    });
    await orchestratorOptInDialog.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    await orchestratorOptInDialog
      .getByRole('button', { name: 'Turn on and review', exact: true })
      .click();
    const objectiveDialog = page.getByRole('dialog', {
      name: 'Direct the Orchestrator',
      exact: true,
    });
    await objectiveDialog.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    await objectiveDialog.getByLabel('Optional direction').fill(ORCHESTRATOR_OBJECTIVE);
    await objectiveDialog.getByRole('button', { name: 'Run checkpoint', exact: true }).click();
    const reviewerDialog = page.getByRole('dialog', {
      name: 'Choose Orchestrator model',
      exact: true,
    });
    await reviewerDialog.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    const reviewerModelInput = reviewerDialog.getByLabel('Select a model, type to search');
    await reviewerModelInput.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    await reviewerModelInput.click();
    await reviewerModelInput.fill('airc-reviewer:latest');
    await reviewerModelInput.press('ArrowDown');
    const reviewerModelOption = reviewerDialog.getByRole('option', {
      name: 'airc-reviewer:latest',
      exact: true,
    });
    await reviewerModelOption.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    await reviewerModelOption.click();
    await reviewerDialog.getByRole('button', { name: 'Use as Orchestrator', exact: true }).click();
    await waitFor(
      'the packaged Orchestrator reviewer request',
      () => syntheticOllama.activeOrchestratorReviewCount === 1
    );
    const initialReviewRequest = syntheticOllama.orchestratorRequests[0];
    if (
      initialReviewRequest?.model !== 'airc-reviewer:latest' ||
      initialReviewRequest.evidenceIdCount === 0 ||
      initialReviewRequest.hadTools ||
      initialReviewRequest.containedSecret ||
      !initialReviewRequest.containedRedaction
    ) {
      fail('The initial Orchestrator request did not preserve reviewer isolation and redaction');
    }
    await page
      .getByRole('button', { name: 'Orchestrator supervision in progress', exact: true })
      .waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    await page.screenshot({
      path: join(evidenceDir, '08-orchestrator-running.png'),
      fullPage: false,
    });

    if (!options.skipRendererRecovery) {
      const orchestratorRendererRecoveryAt = Date.now();
      await crashRenderer(page);
      browser = await connectToElectron(debugPort);
      browserConnections.push(browser);
      page = await readyPage(browser);
      registerPageDiagnostics(page);
      await ensureNamedTaskOpen(page, ORCHESTRATOR_FIXTURE_NAME, orchestratorFixture.initialMarker);
      await page
        .getByRole('button', { name: 'Orchestrator supervision in progress', exact: true })
        .waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
      if (syntheticOllama.activeOrchestratorReviewCount !== 1) {
        fail('The Orchestrator reviewer request ended during renderer recovery');
      }
      measurements.orchestratorRendererRecoveryMs = Date.now() - orchestratorRendererRecoveryAt;
      await page.screenshot({
        path: join(evidenceDir, '09-orchestrator-renderer-recovered.png'),
        fullPage: false,
      });
    }

    const orchestratorDesktopRestartAt = Date.now();
    await stopProcess(desktop);
    desktop = null;
    desktop = spawnLogged(
      'desktop-orchestrator-restarted',
      desktopBinary,
      desktopArguments,
      {
        ...runtimeEnvironment,
        AIRC_EXTERNAL_BACKEND: '1',
        AIRC_EXTERNAL_BACKEND_URL: `http://127.0.0.1:${desktopBackendPort}`,
        ENABLE_PLAYWRIGHT: '1',
        PLAYWRIGHT_DEBUG_PORT: String(debugPort),
        ELECTRON_ENABLE_LOGGING: '1',
      },
      logDir
    );
    browser = await connectToElectron(debugPort);
    browserConnections.push(browser);
    page = await readyPage(browser);
    registerPageDiagnostics(page);
    await ensureNamedTaskOpen(page, ORCHESTRATOR_FIXTURE_NAME, orchestratorFixture.initialMarker);
    await page
      .getByRole('button', { name: 'Orchestrator supervision in progress', exact: true })
      .waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    if (syntheticOllama.activeOrchestratorReviewCount !== 1) {
      fail('The Orchestrator reviewer request ended during desktop restart');
    }
    measurements.orchestratorDesktopRestartMs = Date.now() - orchestratorDesktopRestartAt;
    await page.screenshot({
      path: join(evidenceDir, '10-orchestrator-desktop-recovered.png'),
      fullPage: false,
    });

    syntheticOllama.finishOrchestratorReviews();
    await waitFor(
      'the first packaged Orchestrator response to close',
      () => syntheticOllama.orchestratorResponseCloseCount >= 1
    );
    await waitFor(
      'one autonomous Orchestrator correction request',
      () => syntheticOllama.correctionRequests.length === 1,
      LOAD_TIMEOUT_MS
    );
    await page.getByText(ORCHESTRATOR_CORRECTION_RESPONSE_MARKER, { exact: true }).waitFor({
      state: 'visible',
      timeout: LOAD_TIMEOUT_MS,
    });
    await waitFor(
      'the packaged Orchestrator correction re-check',
      () =>
        syntheticOllama.orchestratorRequests.length === 2 &&
        syntheticOllama.activeOrchestratorReviewCount === 1,
      LOAD_TIMEOUT_MS
    );
    if (
      syntheticOllama.goalContinuationRequests.length !== 2 ||
      syntheticOllama.goalContinuationRequests.some((request) => request.model !== 'airc:latest')
    ) {
      fail('The active goal continuation did not remain bounded to the working model');
    }
    const reviewDialog = page.getByRole('dialog', { name: 'Orchestrator review', exact: true });
    await reviewDialog.waitFor({ state: 'visible', timeout: LOAD_TIMEOUT_MS });
    await reviewDialog.getByText('Correction needed', { exact: true }).waitFor({
      state: 'visible',
      timeout: READY_TIMEOUT_MS,
    });
    await reviewDialog.getByText(ORCHESTRATOR_FIRST_REVIEW_SUMMARY, { exact: true }).waitFor({
      state: 'visible',
      timeout: READY_TIMEOUT_MS,
    });
    await reviewDialog
      .getByText(
        'Guidance was sent to the working model and will be re-checked after it responds.',
        {
          exact: true,
        }
      )
      .waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    await page.screenshot({
      path: join(evidenceDir, '11-orchestrator-correction-injected.png'),
      fullPage: false,
    });

    const correctionRequest = syntheticOllama.correctionRequests[0];
    const recheckRequest = syntheticOllama.orchestratorRequests[1];
    if (
      correctionRequest?.model !== 'airc:latest' ||
      correctionRequest.occurrenceCount !== 1 ||
      recheckRequest?.model !== 'airc-reviewer:latest' ||
      recheckRequest.evidenceIdCount === 0 ||
      recheckRequest.hadTools ||
      recheckRequest.containedSecret
    ) {
      fail('The Orchestrator correction loop crossed model ownership or duplicated guidance');
    }
    syntheticOllama.finishOrchestratorReviews();
    await waitFor(
      'the Orchestrator correction re-check response to close',
      () => syntheticOllama.orchestratorResponseCloseCount >= 2
    );
    await reviewDialog.getByText('Verified', { exact: true }).waitFor({
      state: 'visible',
      timeout: LOAD_TIMEOUT_MS,
    });
    await reviewDialog.getByText(ORCHESTRATOR_RECHECK_SUMMARY, { exact: true }).waitFor({
      state: 'visible',
      timeout: LOAD_TIMEOUT_MS,
    });
    await reviewDialog.getByText('2 reviewer request(s)', { exact: false }).waitFor({
      state: 'visible',
      timeout: READY_TIMEOUT_MS,
    });
    measurements.orchestratorPersistence = assertOrchestratorPersistence(
      backendBinary,
      orchestratorSessionId,
      runtimeEnvironment
    );
    measurements.orchestratorAutonomousCorrectionCompleted = true;
    await page.screenshot({
      path: join(evidenceDir, '12-orchestrator-recheck-verified.png'),
      fullPage: false,
    });
    await reviewDialog.locator('button[data-slot="button"]', { hasText: 'Close' }).click();
    await reviewDialog.waitFor({ state: 'hidden', timeout: READY_TIMEOUT_MS });

    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      fail(
        `Renderer diagnostics were not clean: ${consoleErrors.length} console errors, ${pageErrors.length} page errors`
      );
    }

    if (!options.skipRendererRecovery) {
      const rapidCrashStartedAt = Date.now();
      for (let recovery = 0; recovery < 2; recovery += 1) {
        await crashRenderer(page);
        browser = await connectToElectron(debugPort);
        browserConnections.push(browser);
        page = await readyPage(browser);
        registerPageDiagnostics(page);
        await ensureAutomationDetailOpen(page);
        await page.getByText('Succeeded', { exact: true }).waitFor({
          state: 'visible',
          timeout: READY_TIMEOUT_MS,
        });
        await assertNoTaskFailureSurface(page);
      }
      await page.screenshot({
        path: join(evidenceDir, '08-second-rapid-recovery-complete.png'),
        fullPage: false,
      });
      if (Date.now() - rapidCrashStartedAt >= 30_000) {
        fail('The rapid renderer-recovery sequence exceeded its 30-second policy window');
      }
      await crashRenderer(page);
      await waitForRendererTargetsToStayAbsent(debugPort);
      measurements.thirdRapidCrashClosedWindow = true;
      measurements.rapidCrashContainmentMs = Date.now() - rapidCrashStartedAt;
    }

    result = {
      status: 'passed',
      startedAt,
      finishedAt: new Date().toISOString(),
      appPath,
      platform: process.platform,
      backendBinary,
      sessionId,
      singleSendSessionId,
      orchestratorSessionId,
      messageCount: options.messageCount,
      fixtureBytes: fixture.bytes,
      singleSendFixtureBytes: singleSendFixture.bytes,
      orchestratorFixtureBytes: orchestratorFixture.bytes,
      measurements,
      consoleErrors,
      pageErrors,
      syntheticOllamaRequests: syntheticOllama.requests,
      syntheticAutomationRequestCount: syntheticOllama.automationRequestCount,
      syntheticAutomationResponseCloseCount: syntheticOllama.automationResponseCloseCount,
      syntheticInteractiveRequestCount: syntheticOllama.interactiveRequestCount,
      syntheticOrchestratorRequests: syntheticOllama.orchestratorRequests,
      syntheticOrchestratorResponseCloseCount: syntheticOllama.orchestratorResponseCloseCount,
      syntheticOrchestratorCorrectionRequests: syntheticOllama.correctionRequests,
      syntheticGoalContinuationRequests: syntheticOllama.goalContinuationRequests,
      profileRetained: retainProfile,
      profilePath: retainProfile ? root : null,
      evidenceDir: options.outputDir ? evidenceDir : null,
    };
    passed = true;
  } catch (error) {
    const failure = {
      status: 'failed',
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      platform: process.platform,
      measurements,
      consoleErrors,
      pageErrors,
      syntheticOrchestratorRequests: syntheticOllama?.orchestratorRequests ?? [],
      syntheticOrchestratorResponseCloseCount: syntheticOllama?.orchestratorResponseCloseCount ?? 0,
      syntheticOrchestratorActiveReviewCount: syntheticOllama?.activeOrchestratorReviewCount ?? 0,
      syntheticOrchestratorCorrectionRequests: syntheticOllama?.correctionRequests ?? [],
      syntheticGoalContinuationRequests: syntheticOllama?.goalContinuationRequests ?? [],
      root,
      rendererBody:
        page && !page.isClosed()
          ? await page
              .locator('body')
              .innerText()
              .catch(() => null)
          : null,
      logs: {
        backend: backend
          ? {
              stdout: readFileSync(backend.stdoutPath, 'utf8'),
              stderr: readFileSync(backend.stderrPath, 'utf8'),
            }
          : null,
        desktop: desktop
          ? {
              stdout: readFileSync(desktop.stdoutPath, 'utf8'),
              stderr: readFileSync(desktop.stderrPath, 'utf8'),
            }
          : null,
      },
    };
    writeFileSync(join(evidenceDir, 'failure.json'), `${JSON.stringify(failure, null, 2)}\n`, {
      mode: 0o600,
    });
    writeAcceptanceReceipt(evidenceDir, failure);
    process.stderr.write(`Acceptance evidence retained at ${evidenceDir}\n`);
    throw error;
  } finally {
    try {
      await cleanupOwnedResources([
        ...browserConnections
          .reverse()
          .map((connection, index) => [
            `Browser connection ${index}`,
            () => connection.close(),
            5_000,
          ]),
        ['Desktop', () => stopProcess(desktop)],
        ['Backend', () => stopProcess(backend)],
        ['External acceptance browser', () => cleanupProfileBrowsers(root, startedAt)],
        ['Response gate', () => responseGate?.close()],
        ['Synthetic provider', () => stopServer(syntheticOllama?.server)],
      ]);
      if (passed && !retainProfile) {
        assertSafeTemporaryRoot(root);
        rmSync(root, { recursive: true, force: false, maxRetries: 2 });
      }
    } catch (error) {
      const failure = {
        status: 'cleanup-failed',
        startedAt,
        finishedAt: new Date().toISOString(),
        root,
        errors: (error instanceof AggregateError ? error.errors : [error]).map(
          (cause) => cause.stack ?? String(cause)
        ),
      };
      writeFileSync(
        join(evidenceDir, 'cleanup-failure.json'),
        `${JSON.stringify(failure, null, 2)}\n`,
        {
          mode: 0o600,
        }
      );
      writeAcceptanceReceipt(evidenceDir, failure);
      throw error;
    }
  }
  if (existsSync(evidenceDir)) {
    writeAcceptanceReceipt(evidenceDir, result);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

async function runAcceptanceWithReceipt(options) {
  const explicitEvidenceDir = options.outputDir ? resolve(options.outputDir) : null;
  if (explicitEvidenceDir) {
    mkdirSync(explicitEvidenceDir, { recursive: true, mode: 0o700 });
    writeAcceptanceReceipt(explicitEvidenceDir, {
      status: 'running',
      startedAt: new Date().toISOString(),
    });
  }
  try {
    return await runAcceptance(options);
  } catch (error) {
    if (explicitEvidenceDir) {
      const receipt = JSON.parse(readFileSync(join(explicitEvidenceDir, 'result.json'), 'utf8'));
      if (receipt.status === 'running') {
        writeAcceptanceReceipt(explicitEvidenceDir, {
          ...receipt,
          status: 'failed',
          phase: 'preflight-or-initialization',
          finishedAt: new Date().toISOString(),
          error: error.stack ?? String(error),
        });
      }
    }
    throw error;
  }
}

const options = parseArgs(process.argv.slice(2));
runAcceptanceWithReceipt(options).catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exitCode = 1;
});
