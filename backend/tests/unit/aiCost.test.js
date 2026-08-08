import { describe, it, expect } from 'vitest';
import { estimateCostUsd, rateForModel, approximateTokens } from '../../src/services/ai/AiCostEstimator.js';

/**
 * AiRun.estimatedCostUsd was a column nothing ever wrote, so the governance dashboard summed
 * zeros and the monthly budget could never be reached. This proves the arithmetic that now
 * populates it — the rates are hardcoded list prices and WILL drift from real billing.
 */
describe('AiCostEstimator', () => {
  it('prices sonnet input/output tokens at the published per-Mtok rate', () => {
    // 1,000,000 input @ $3 + 1,000,000 output @ $15 = $18.00
    const usd = estimateCostUsd(
      { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      'claude-sonnet-5',
      'ANTHROPIC'
    );
    expect(usd).toBe(18);
  });

  it('prices cache writes above and cache reads far below ordinary input', () => {
    const write = estimateCostUsd({ cacheCreationInputTokens: 1_000_000 }, 'claude-sonnet-5', 'ANTHROPIC');
    const read = estimateCostUsd({ cacheReadInputTokens: 1_000_000 }, 'claude-sonnet-5', 'ANTHROPIC');
    const plain = estimateCostUsd({ inputTokens: 1_000_000 }, 'claude-sonnet-5', 'ANTHROPIC');
    expect(write).toBeGreaterThan(plain);
    expect(read).toBeLessThan(plain);
    expect(read).toBe(0.3);
  });

  it('charges opus more than sonnet more than haiku for identical usage', () => {
    const usage = { inputTokens: 100_000, outputTokens: 20_000 };
    const opus = estimateCostUsd(usage, 'claude-opus-4', 'ANTHROPIC');
    const sonnet = estimateCostUsd(usage, 'claude-sonnet-5', 'ANTHROPIC');
    const haiku = estimateCostUsd(usage, 'claude-haiku-4', 'ANTHROPIC');
    expect(opus).toBeGreaterThan(sonnet);
    expect(sonnet).toBeGreaterThan(haiku);
  });

  it('keeps sub-cent runs non-zero rather than rounding a real cost away', () => {
    const usd = estimateCostUsd({ inputTokens: 500, outputTokens: 200 }, 'claude-sonnet-5', 'ANTHROPIC');
    expect(usd).toBeGreaterThan(0);
    expect(usd).toBeLessThan(0.01);
  });

  it('prices the MOCK provider at exactly zero — it bills nobody', () => {
    const usd = estimateCostUsd({ inputTokens: 900_000, outputTokens: 900_000 }, 'mock-clinical-copilot-v1', 'MOCK');
    expect(usd).toBe(0);
  });

  it('falls back to the mid-tier rate for an unknown model instead of pricing it free', () => {
    expect(rateForModel('some-selfhosted-llm')).toEqual(rateForModel('claude-sonnet-5'));
    expect(estimateCostUsd({ inputTokens: 1_000_000 }, 'some-selfhosted-llm', 'OPENAI_COMPATIBLE')).toBe(3);
  });

  it('ignores missing/negative/garbage token counts', () => {
    expect(estimateCostUsd({}, 'claude-sonnet-5', 'ANTHROPIC')).toBe(0);
    expect(estimateCostUsd({ inputTokens: -50, outputTokens: null }, 'claude-sonnet-5', 'ANTHROPIC')).toBe(0);
  });

  it('approximates tokens at roughly four characters each', () => {
    expect(approximateTokens('a'.repeat(400))).toBe(100);
    expect(approximateTokens('')).toBe(0);
  });
});
