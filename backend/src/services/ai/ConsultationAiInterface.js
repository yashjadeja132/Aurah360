/**
 * AI-ready interfaces only — future AI module will implement these.
 * Do NOT call real AI from Module 8.
 */
class ConsultationAiInterface {
  /**
   * @param {object} consultationBundle - full consultation + soap + diagnosis
   * @returns {Promise<{ summary: string|null, status: string }>}
   */
  async summarizeConsultation(_consultationBundle) {
    return { summary: null, status: 'NOT_IMPLEMENTED', message: 'AI summarize reserved for future module' };
  }

  /**
   * @param {object} context - patient summary + chief complaint
   * @returns {Promise<{ soap: object|null, status: string }>}
   */
  async draftSoap(_context) {
    return { soap: null, status: 'NOT_IMPLEMENTED', message: 'AI draft SOAP reserved for future module' };
  }

  /**
   * @param {object} context
   * @returns {Promise<{ suggestions: string[], status: string }>}
   */
  async suggestDiagnosis(_context) {
    return { suggestions: [], status: 'NOT_IMPLEMENTED', message: 'AI diagnosis reserved for future module' };
  }

  /**
   * @param {object} context
   * @returns {Promise<{ questions: string[], status: string }>}
   */
  async suggestQuestions(_context) {
    return { questions: [], status: 'NOT_IMPLEMENTED', message: 'AI questions reserved for future module' };
  }
}

export default ConsultationAiInterface;
