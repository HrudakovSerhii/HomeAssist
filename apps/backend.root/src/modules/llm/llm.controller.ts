import { Body, Controller, Post, HttpException } from '@nestjs/common';
import { LLMService } from './llm.service';
import { IsString, IsOptional, IsIn, ValidateNested, IsArray, Length, Matches } from 'class-validator';
import { Type } from 'class-transformer';

class LLMExecuteDto {
  @IsString()
  @Length(1, 2000, { message: 'Prompt must be between 1 and 2000 characters' })
  @Matches(/^[\s\S]*[a-zA-Z0-9][\s\S]*$/, { message: 'Prompt must contain at least one alphanumeric character' })
  prompt: string;

  @IsString()
  @Length(1, 50, { message: 'Model name must be between 1 and 50 characters' })
  llmModel: string;

  @IsString()
  @IsIn(['local', 'remote'])
  target: 'local' | 'remote' = 'local';

  @IsOptional()
  options?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  history?: { role: string; content: string }[];
}

@Controller('llm')
export class LLMController {
  constructor(private readonly llmService: LLMService) {}

  /**
   * Execute LLM prompt processing
   * 
   * Protection strategy for local network usage:
   * - Input validation (prompt length, content safety)
   * - Model name validation
   * - Request structure validation
   * 
   * Note: Authentication not required for local Ollama instances
   */
  @Post('execute')
  async execute(@Body() dto: LLMExecuteDto) {
    console.log('🔥 LLMController.execute called with:', JSON.stringify(dto, null, 2));
    try {
      const response = await this.llmService.executeChat(
        dto.prompt,
        dto.llmModel,
        dto.target,
        dto.options,
        dto.history,
      );
      return {
        model: response.model,
        createdAt: response.created_at,
        response: response.message?.content,
        raw: response,
      };
    } catch (error) {
      console.log('❌ LLMController error:', error.message);
      throw new HttpException(
        error.response?.data || error.message || 'LLM execution failed',
        error.response?.status || 500,
      );
    }
  }
} 