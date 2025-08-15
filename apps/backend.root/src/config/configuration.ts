export default () => ({
  port: parseInt(process.env.BACKEND_PORT || '4000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',
  nodeEnv: process.env.NODE_ENV || 'development',
  llm: {
    ollamaUrl: process.env.LLM_OLLAMA_URL || 'http://localhost:11434',
    ollamaRemoteUrl: process.env.LLM_OLLAMA_REMOTE_URL || '',
    defaultModel: process.env.LLM_DEFAULT_MODEL || 'mistral:latest',
  },
  processing: {
    maxEmailsPerExecution: parseInt(
      process.env.PROCESSING_MAX_EMAILS_PER_EXECUTION ||
        ((process.env.NODE_ENV || 'development') === 'development' ? '5' : '1000'),
      10
    ),
    initialLookbackDays: parseInt(
      process.env.INITIAL_LOOKBACK_DAYS || '7',
      10
    ),
  },
});
