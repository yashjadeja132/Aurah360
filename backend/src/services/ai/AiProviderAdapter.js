/**
 * Provider-neutral AI call (AI-001). MOCK is deterministic and safe for dev/test/no-budget
 * deployments; OPENAI_COMPATIBLE calls any Chat-Completions-compatible HTTP endpoint
 * (OpenAI, Azure OpenAI, self-hosted vLLM, etc.) configured via AI_API_BASE_URL/AI_API_KEY.
 */
class AiProviderAdapter {
  constructor({ provider, apiKey, apiBaseUrl, model, timeoutMs }) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.apiBaseUrl = apiBaseUrl;
    this.model = model;
    this.timeoutMs = timeoutMs || 8000;
  }

  /** Returns { output, raw } where output is the parsed structured JSON. Throws on failure/timeout. */
  async complete({ systemPrompt, userPrompt, schemaHint }) {
    if (this.provider !== 'OPENAI_COMPATIBLE') {
      return this.#mockComplete({ userPrompt, schemaHint });
    }

    if (!this.apiKey || !this.apiBaseUrl) {
      throw new Error('AI provider is not configured (AI_API_KEY / AI_API_BASE_URL)');
    }

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
      return { output, raw: json };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Deterministic canned responses per use case — no network call, always succeeds. */
  #mockComplete({ userPrompt, schemaHint }) {
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
      return { output: { summary: 'Mock summary — configure AI_PROVIDER=OPENAI_COMPATIBLE for real output.' }, raw: { mock: true } };
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
}

export default AiProviderAdapter;
