import { Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class LLMService {
  constructor(private readonly configService: ConfigService) {}

  async executeChat(
    prompt: string,
    model: string,
    target: 'local' | 'remote' = 'local',
    options?: Record<string, any>,
    history?: { role: string; content: string }[],
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

    console.log(`[LLMService] Using Ollama URL: ${url} (target: ${target}, model: ${model})`);
    
    const messages = [...(history || []), { role: 'user', content: trimmedPrompt }];
    try {
      const response = await axios.post(url, {
        model,
        messages,
        ...(options ? { options } : {}),
        stream: false,
      });
      return response.data;
    } catch (error) {
      console.log('🚨 Ollama request failed:');
      console.log('URL:', url);
      console.log('Request body:', JSON.stringify({ model, messages, ...(options ? { options } : {}), stream: false }, null, 2));
      console.log('Error status:', error.response?.status);
      console.log('Error data:', error.response?.data);
      console.log('Error message:', error.message);
      console.log('Full error:', error);
      
      throw new HttpException(
        error.response?.data || error.message || 'Ollama request failed',
        error.response?.status || 502,
      );
    }
  }
}
