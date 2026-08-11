import Anthropic from '@anthropic-ai/sdk';
import logger from '../../libs/logger.js';
import { approximateTokens } from './AiCostEstimator.js';

/** Normalised, provider-neutral token counts. Every complete() return carries one of these. */
const EMPTY_USAGE = Object.freeze({
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
});

/**
 * Provider-neutral AI call (AI-001).
 *
 * MOCK is deterministic and safe for dev/test/no-credential deployments and is the default
 * whenever no API key is configured. ANTHROPIC calls the Claude Messages API with structured
 * outputs and a cached system prompt. OPENAI_COMPATIBLE calls any Chat-Completions-compatible
 * HTTP endpoint (OpenAI, Azure OpenAI, self-hosted vLLM, etc.).
 *
 * The API key is read from config (env) only — it is never logged and never persisted.
 */

/** Anthropic caps thinking + response text together; a small cap truncates mid-JSON. */
const ANTHROPIC_MAX_TOKENS = 16000;

class AiProviderAdapter {
  constructor({
    provider,
    apiKey,
    apiBaseUrl,
    model,
    timeoutMs,
    anthropicApiKey,
    anthropicModel,
    geminiApiKey,
    geminiModel,
  }) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.apiBaseUrl = apiBaseUrl;
    this.model = model;
    this.timeoutMs = timeoutMs || 8000;
    this.anthropicApiKey = anthropicApiKey || '';
    this.anthropicModel = anthropicModel || 'claude-sonnet-5';
    this.geminiApiKey = geminiApiKey || '';
    this.geminiModel = geminiModel || 'gemini-flash-latest';
    this.#client = null;
  }

  #client;

  /**
   * True when the configured provider can actually be reached. MOCK is always usable; the
   * real providers fall back to MOCK when their credentials are absent so a credential-less
   * deployment keeps working.
   *
   * GEMINI is a fallback, not a peer of ANTHROPIC/OPENAI_COMPATIBLE in AI_PROVIDER's enum: when
   * the operator has configured AI_PROVIDER=ANTHROPIC but ANTHROPIC_API_KEY is missing/empty (a
   * bare credential gap, not a deliberate provider choice), we reach for GEMINI_API_KEY before
   * giving up to MOCK. If AI_PROVIDER itself is MOCK or OPENAI_COMPATIBLE, that's a deliberate
   * choice and Gemini is never substituted for it.
   */
  effectiveProvider() {
    if (this.provider === 'ANTHROPIC' && this.anthropicApiKey) return 'ANTHROPIC';
    if (this.provider === 'ANTHROPIC' && this.geminiApiKey) return 'GEMINI';
    if (this.provider === 'OPENAI_COMPATIBLE' && this.apiKey && this.apiBaseUrl) return 'OPENAI_COMPATIBLE';
    return 'MOCK';
  }

  /** The model string that will actually be used for the current effective provider. */
  effectiveModel() {
    const provider = this.effectiveProvider();
    if (provider === 'ANTHROPIC') return this.anthropicModel;
    if (provider === 'GEMINI') return this.geminiModel;
    return this.model;
  }

  /**
   * Returns { output, raw, model, degraded, reason, usage }.
   * `degraded: true` with a `reason` means the provider declined or truncated — the caller
   * must continue the manual workflow. Throws only on transport/parse failures.
   */
  async complete({ systemPrompt, userPrompt, schemaHint, jsonSchema = null }) {
    const provider = this.effectiveProvider();
    if (provider === 'ANTHROPIC') {
      return this.#anthropicComplete({ systemPrompt, userPrompt, jsonSchema });
    }
    if (provider === 'GEMINI') {
      return this.#geminiComplete({ systemPrompt, userPrompt, schemaHint });
    }
    if (provider === 'OPENAI_COMPATIBLE') {
      return this.#openAiComplete({ systemPrompt, userPrompt, schemaHint });
    }
    const mock = this.#mockComplete({ userPrompt, schemaHint });
    return {
      ...mock,
      model: this.model,
      degraded: false,
      reason: null,
      // Real counts (approximated) so provenance/telemetry is honest; MOCK is priced at zero.
      usage: {
        ...EMPTY_USAGE,
        inputTokens: approximateTokens(systemPrompt) + approximateTokens(userPrompt),
        outputTokens: approximateTokens(JSON.stringify(mock.output)),
      },
    };
  }

  /** Anthropic `message.usage` → provider-neutral shape. */
  static normaliseAnthropicUsage(usage = {}) {
    return {
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      cacheCreationInputTokens: usage.cache_creation_input_tokens || 0,
      cacheReadInputTokens: usage.cache_read_input_tokens || 0,
    };
  }

  // --- Anthropic (Claude Messages API) ---------------------------------------
  async #anthropicComplete({ systemPrompt, userPrompt, jsonSchema }) {
    if (!this.#client) {
      this.#client = new Anthropic({ apiKey: this.anthropicApiKey, timeout: this.timeoutMs });
    }

    const outputConfig = { effort: 'high' };
    // `format` is the current structured-outputs field (`output_format` is deprecated). The SDK's
    // JSONOutputFormat accepts only { type: 'json_schema', schema }  — our schema *files* also
    // carry a top-level `name`/`description` for our own internal documentation/registry use,
    // which the API rejects as unrecognised extra fields if passed through wholesale.
    if (jsonSchema) {
      outputConfig.format = { type: 'json_schema', schema: jsonSchema.schema || jsonSchema };
    }

    const message = await this.#client.messages.create({
      model: this.anthropicModel,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      output_config: outputConfig,
      // Byte-stable prefix + ephemeral cache_control. The prefix must clear the 1024-token
      // minimum on Sonnet 5 or nothing is cached at all.
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
      // NOTE: temperature / top_p are deliberately NOT set — non-default values are rejected.
    });

    const usage = message.usage || {};
    logger.info('Anthropic AI call completed', {
      model: message.model,
      stopReason: message.stop_reason,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheCreationInputTokens: usage.cache_creation_input_tokens,
      // Confirms whether the cached system prefix actually engaged on the second call.
      cacheReadInputTokens: usage.cache_read_input_tokens,
    });

    // Fail open BEFORE reading content — never throw into the consultation flow.
    if (message.stop_reason === 'refusal') {
      return {
        output: null,
        raw: { stop_reason: message.stop_reason, stop_details: message.stop_details || null, usage },
        model: message.model || this.anthropicModel,
        degraded: true,
        reason: 'The AI provider declined this request. Continue the consultation manually.',
        usage: AiProviderAdapter.normaliseAnthropicUsage(usage),
      };
    }
    if (message.stop_reason === 'max_tokens') {
      return {
        output: null,
        raw: { stop_reason: message.stop_reason, usage },
        model: message.model || this.anthropicModel,
        degraded: true,
        reason: 'The AI response was truncated before it was complete. Continue the consultation manually.',
        usage: AiProviderAdapter.normaliseAnthropicUsage(usage),
      };
    }

    const text = (message.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let output;
    try {
      output = JSON.parse(text);
    } catch {
      throw new Error('INVALID_JSON_OUTPUT');
    }

    return {
      output,
      raw: { stop_reason: message.stop_reason, usage },
      model: message.model || this.anthropicModel,
      degraded: false,
      reason: null,
      usage: AiProviderAdapter.normaliseAnthropicUsage(usage),
    };
  }

  // --- Gemini (fallback when ANTHROPIC_API_KEY is unset) ---------------------
  async #geminiComplete({ systemPrompt, userPrompt, schemaHint }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': this.geminiApiKey,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: `${systemPrompt}\nRespond with valid JSON only, no markdown fencing, matching this shape: ${schemaHint}`,
                },
              ],
            },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`AI provider returned ${res.status}${errText ? `: ${errText}` : ''}`);
      }
      const json = await res.json();
      const candidate = json.candidates?.[0];
      const text = (candidate?.content?.parts || []).map((p) => p.text || '').join('');

      // Fail open on a safety block/finish reason other than a clean stop — never throw into
      // the consultation flow, mirroring the Anthropic refusal/max_tokens handling above.
      const finishReason = candidate?.finishReason;
      if (finishReason && finishReason !== 'STOP') {
        return {
          output: null,
          raw: { finishReason, usage: json.usageMetadata || {} },
          model: this.geminiModel,
          degraded: true,
          reason:
            finishReason === 'MAX_TOKENS'
              ? 'The AI response was truncated before it was complete. Continue the consultation manually.'
              : 'The AI provider declined this request. Continue the consultation manually.',
          usage: AiProviderAdapter.normaliseGeminiUsage(json.usageMetadata),
        };
      }

      let output;
      try {
        output = JSON.parse(text);
      } catch {
        throw new Error('INVALID_JSON_OUTPUT');
      }

      return {
        output,
        raw: { finishReason, usage: json.usageMetadata || {} },
        model: this.geminiModel,
        degraded: false,
        reason: null,
        usage: AiProviderAdapter.normaliseGeminiUsage(json.usageMetadata),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Gemini `usageMetadata` → provider-neutral shape. Gemini has no separate cache-read field. */
  static normaliseGeminiUsage(usage = {}) {
    return {
      inputTokens: usage.promptTokenCount || 0,
      outputTokens: usage.candidatesTokenCount || 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: usage.cachedContentTokenCount || 0,
    };
  }

  // --- OpenAI-compatible ------------------------------------------------------
  async #openAiComplete({ systemPrompt, userPrompt, schemaHint }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.apiBaseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: `${systemPrompt}\nRespond with valid JSON only, matching: ${schemaHint}` },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
        }),
      });
      if (!res.ok) throw new Error(`AI provider returned ${res.status}`);
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content;
      let output;
      try {
        output = JSON.parse(text);
      } catch {
        throw new Error('INVALID_JSON_OUTPUT');
      }
      return {
        output,
        raw: json,
        model: this.model,
        degraded: false,
        reason: null,
        usage: {
          ...EMPTY_USAGE,
          inputTokens: json.usage?.prompt_tokens || 0,
          outputTokens: json.usage?.completion_tokens || 0,
          cacheReadInputTokens: json.usage?.prompt_tokens_details?.cached_tokens || 0,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Deterministic canned responses per use case — no network call, always succeeds. */
  #mockComplete({ userPrompt, schemaHint }) {
    if (schemaHint.includes('possible_conditions')) {
      return { output: this.#mockCopilotOutput(userPrompt), raw: { mock: true } };
    }
    if (schemaHint.includes('questions')) {
      return {
        output: {
          questions: [
            'How long has the symptom been present?',
            'Any known allergies or previous reactions?',
            'Any current medications?',
          ],
        },
        raw: { mock: true },
      };
    }
    if (schemaHint.includes('redFlags')) {
      return { output: { redFlags: [], notes: 'No deterministic red flags matched (mock).' }, raw: { mock: true } };
    }
    if (schemaHint.includes('summary')) {
      return { output: { summary: 'Mock summary — configure AI_PROVIDER=ANTHROPIC for real output.' }, raw: { mock: true } };
    }
    if (schemaHint.includes('draftNote')) {
      return {
        output: { draftNote: { subjective: '', objective: '', assessment: '', plan: '' } },
        raw: { mock: true },
      };
    }
    if (schemaHint.includes('checklist')) {
      return { output: { checklist: [] }, raw: { mock: true } };
    }
    return { output: { text: 'Mock AI response.' }, raw: { mock: true, userPrompt } };
  }

  /** Shape-complete mock copilot payload so the UI/contract can be exercised without credentials. */
  #mockCopilotOutput(userPrompt) {
    let answered = 0;
    try {
      const parsed = JSON.parse(userPrompt);
      answered = Array.isArray(parsed.recordedAnswers) ? parsed.recordedAnswers.length : 0;
    } catch {
      answered = 0;
    }

    return {
      summary:
        answered > 0
          ? `MOCK OUTPUT — not a real model response. Refined suggestion set incorporating ${answered} recorded patient answer(s).`
          : 'MOCK OUTPUT — not a real model response. Configure ANTHROPIC_API_KEY and AI_PROVIDER=ANTHROPIC for real suggestions.',
      possible_conditions: [
        {
          condition: 'Mock differential A',
          likelihood: answered > 0 ? 'high' : 'medium',
          reasoning: 'Deterministic mock entry — no clinical reasoning was performed.',
        },
        {
          condition: 'Mock differential B',
          likelihood: 'low',
          reasoning: 'Deterministic mock entry — no clinical reasoning was performed.',
        },
      ],
      follow_up_questions: [
        'When did you first notice this problem?',
        'Is it getting better, worse, or staying the same?',
        'Does anything make it worse, such as sun, sweat, or a product you use?',
        'Have you used any cream, tablet, or home remedy for this already?',
      ],
      red_flags: ['MOCK — no red-flag analysis was performed; assess urgency clinically.'],
      investigations: [],
      diet_lifestyle_advice: [],
      medication_suggestions: [],
      procedural_options_note: 'None',
      aftercare_advice_english: 'Mock draft. The doctor must write the real aftercare advice.',
      patient_advice_gujarati: 'મોક ડ્રાફ્ટ. ડૉક્ટર સાચી સલાહ લખશે.',
      confidence_note:
        'This is a deterministic mock response with no clinical reasoning behind it. Real model output is unavailable because no AI provider credential is configured. The treating doctor’s own assessment governs.',
    };
  }
}

export default AiProviderAdapter;
