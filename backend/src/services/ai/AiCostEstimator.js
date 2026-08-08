/**
 * Token → USD cost estimation for AI runs (AI governance, §14.2).
 *
 * RATE SOURCE — Anthropic's published per-million-token list prices for the Claude model
 * families, transcribed by hand. THESE RATES ARE HARDCODED AND WILL DRIFT from real billing:
 * they are not fetched from the provider, they ignore negotiated/enterprise discounts, batch
 * discounts and long-context surcharges, and they are only as current as the last time a human
 * edited this file. Treat every `estimatedCostUsd` in this system as an ORDER-OF-MAGNITUDE
 * guardrail for the monthly budget gate — never as an invoice, a reconciliation figure, or a
 * number to show a customer as "your AI spend".
 *
 * Prices are USD per 1,000,000 tokens.
 *   input        — ordinary (uncached) input tokens
 *   output       — generated tokens
 *   cacheWrite   — tokens written into the ephemeral prompt cache (5m TTL, 1.25x input)
 *   cacheRead    — tokens served from the prompt cache (0.1x input)
 */
const RATE_TABLE_USD_PER_MTOK = Object.freeze({
  'claude-opus': { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  'claude-sonnet': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-haiku': { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
});

/** Unknown/self-hosted models: assume the mid-tier rate rather than silently pricing at zero. */
const FALLBACK_RATE = RATE_TABLE_USD_PER_MTOK['claude-sonnet'];

/**
 * The MOCK provider makes no network call and is billed by nobody, so its true cost is exactly
 * zero. It still reports token counts (so provenance/telemetry is real) — but pricing them would
 * fabricate spend and could trip the monthly budget gate on a deployment that never spent a cent.
 */
const ZERO_RATE = Object.freeze({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });

export function rateForModel(model) {
  const key = String(model || '').toLowerCase();
  const match = Object.keys(RATE_TABLE_USD_PER_MTOK).find((prefix) => key.includes(prefix.replace('claude-', '')));
  return match ? RATE_TABLE_USD_PER_MTOK[match] : FALLBACK_RATE;
}

/**
 * @param {object} usage normalised token counts
 *   { inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens }
 * @param {string} model  model id the tokens were billed against
 * @param {string} provider effective provider ('MOCK' is always free)
 * @returns {number} estimated USD, rounded to 6dp (sub-cent runs must not round to zero)
 */
export function estimateCostUsd(usage = {}, model = '', provider = 'MOCK') {
  const rate = provider === 'MOCK' ? ZERO_RATE : rateForModel(model);
  const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

  const usd =
    (n(usage.inputTokens) * rate.input +
      n(usage.outputTokens) * rate.output +
      n(usage.cacheCreationInputTokens) * rate.cacheWrite +
      n(usage.cacheReadInputTokens) * rate.cacheRead) /
    1_000_000;

  return Number(usd.toFixed(6));
}

/** Rough token estimate for providers that report no usage (~4 chars/token for English+JSON). */
export function approximateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

export default { estimateCostUsd, rateForModel, approximateTokens, RATE_TABLE_USD_PER_MTOK };
