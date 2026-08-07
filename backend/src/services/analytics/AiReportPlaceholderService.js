/** AI reports — placeholder only (Module 18: do not implement AI features yet). */
class AiReportPlaceholderService {
  async report() {
    return {
      category: 'ai',
      placeholder: true,
      message: 'AI analytics are not enabled yet. This endpoint is reserved for future AI consultations, summaries, and time-saved metrics.',
      summary: {
        aiConsultations: 0,
        aiSummariesGenerated: 0,
        aiUsagePerDoctor: [],
        averageTimeSavedMinutes: 0,
      },
      columns: [
        { key: 'metric', label: 'Metric' },
        { key: 'value', label: 'Value' },
      ],
      rows: [
        { metric: 'AI Consultations', value: 0 },
        { metric: 'AI Summaries Generated', value: 0 },
        { metric: 'Average Time Saved (min)', value: 0 },
      ],
    };
  }
}

export default AiReportPlaceholderService;
