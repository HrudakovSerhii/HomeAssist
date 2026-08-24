import { Injectable, HttpException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  
  constructor(private readonly configService: ConfigService) {}

  async executeChat(
    prompt: string,
    model: string,
    target: 'local' | 'remote' = 'local',
    options?: Record<string, any>,
    history?: { role: string; content: string }[],
    cleanContext?: boolean
  ): Promise<any> {
    // Basic prompt safety validation
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      throw new HttpException('Prompt cannot be empty', 400);
    }

    const baseUrl =
      target === 'remote'
        ? this.configService.get('llm.ollamaRemoteUrl')
        : this.configService.get('llm.ollamaUrl');

    if (!baseUrl) {
      throw new HttpException('Ollama URL not configured', 500);
    }
    const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;

    console.log(
      `[LLMService] Using Ollama URL: ${url} (target: ${target}, model: ${model}, cleanContext: ${cleanContext})`
    );

    const messages = [
      ...(cleanContext ? [] : (history || [])),
      { role: 'user', content: trimmedPrompt },
    ];

    // 'format' is a top-level Ollama request field (e.g. 'json'), not a model
    // option — hoist it out of the options object so callers can request
    // structured output without knowing the Ollama request shape.
    const { format, ...modelOptions } = options || {};
    const requestBody = {
      model,
      messages,
      ...(format ? { format } : {}),
      ...(Object.keys(modelOptions).length ? { options: modelOptions } : {}),
      stream: false,
    };

    try {
      const response = await axios.post(url, requestBody);
      return response.data;
    } catch (error) {
      console.log('🚨 Ollama request failed:');
      console.log('URL:', url);
      console.log('Request body:', JSON.stringify(requestBody, null, 2));
      console.log('Error status:', error.response?.status);
      console.log('Error data:', error.response?.data);
      console.log('Error message:', error.message);
      console.log('Full error:', error);

      throw new HttpException(
        error.response?.data || error.message || 'Ollama request failed',
        error.response?.status || 502
      );
    }
  }
}
