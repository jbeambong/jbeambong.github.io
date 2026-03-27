import Anthropic from '@anthropic-ai/sdk';
import db from '../db.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Run an AI agent call and log it.
 * @param {object} opts
 * @param {string} opts.agent       - agent name for logging
 * @param {string} opts.system      - system prompt
 * @param {string} opts.user        - user message
 * @param {number} opts.companyId
 * @param {number} [opts.userId]
 * @param {number} [opts.maxTokens]
 * @returns {Promise<string>}       - assistant text response
 */
export async function runAgent({ agent, system, user, companyId, userId, maxTokens = 2048 }) {
  const t0 = Date.now();
  const msg = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = msg.content.map(b => b.text).join('');
  const duration = Date.now() - t0;

  db.prepare(`INSERT INTO ai_logs (company_id, user_id, agent, prompt, response, tokens_in, tokens_out, duration_ms)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    companyId, userId ?? null, agent, user, text,
    msg.usage.input_tokens, msg.usage.output_tokens, duration
  );

  return text;
}

/**
 * Stream an AI agent call, calling onChunk for each text delta.
 * Also logs the full result when done.
 */
export async function streamAgent({ agent, system, user, companyId, userId, maxTokens = 4096, onChunk, onDone }) {
  const t0 = Date.now();
  let full = '';

  const stream = client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });

  stream.on('text', chunk => { full += chunk; onChunk?.(chunk); });
  const msg = await stream.finalMessage();
  const duration = Date.now() - t0;

  db.prepare(`INSERT INTO ai_logs (company_id, user_id, agent, prompt, response, tokens_in, tokens_out, duration_ms)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    companyId, userId ?? null, agent, user, full,
    msg.usage.input_tokens, msg.usage.output_tokens, duration
  );

  onDone?.(full);
  return full;
}
