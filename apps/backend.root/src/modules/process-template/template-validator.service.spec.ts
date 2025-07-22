import { Test, TestingModule } from '@nestjs/testing';
import { TemplateValidatorService } from './template-validator.service';
import { 
  EmailCategory, 
  Priority, 
  Sentiment, 
  EntityType, 
  ActionType 
} from '@prisma/client';
import { EmailAnalysisTemplate } from '../../types/email.types';

describe('TemplateValidatorService', () => {
  let service: TemplateValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TemplateValidatorService],
    }).compile();

    service = module.get<TemplateValidatorService>(TemplateValidatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateTemplate', () => {
    it('should validate a correct template', () => {
      const validTemplate: EmailAnalysisTemplate = {
        name: 'test-template',
        description: 'Test template',
        categories: [EmailCategory.WORK],
        template: 'Test template content',
        expectedOutputSchema: {
          type: 'object',
          required: ['category'],
          properties: {},
        },
        exampleResponse: {
          category: EmailCategory.WORK,
          priority: Priority.MEDIUM,
          sentiment: Sentiment.NEUTRAL,
          summary: 'Test summary',
          entities: [
            {
              type: EntityType.PERSON,
              value: 'John Doe',
              confidence: 0.9,
            },
          ],
          actionItems: [
            {
              actionType: ActionType.REPLY_REQUIRED,
              description: 'Reply to email',
              priority: Priority.HIGH,
            },
          ],
          tags: ['test'],
          confidence: 0.8,
        },
      };

      const result = service.validateTemplate(validTemplate);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid enum values', () => {
      const invalidTemplate: EmailAnalysisTemplate = {
        name: 'test-template',
        description: 'Test template',
        categories: [EmailCategory.WORK],
        template: 'Test template content',
        expectedOutputSchema: {
          type: 'object',
          required: ['category'],
          properties: {},
        },
        exampleResponse: {
          category: 'INVALID_CATEGORY' as any,
          priority: Priority.MEDIUM,
          sentiment: Sentiment.NEUTRAL,
          summary: 'Test summary',
          entities: [],
          actionItems: [],
          tags: [],
          confidence: 0.8,
        },
      };

      const result = service.validateTemplate(invalidTemplate);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid example category: INVALID_CATEGORY');
    });
  });

  describe('validateLLMResponse', () => {
    it('should validate a correct LLM response', () => {
      const validResponse = {
        category: EmailCategory.WORK,
        priority: Priority.HIGH,
        sentiment: Sentiment.POSITIVE,
        summary: 'Meeting invitation',
        entities: [
          {
            type: EntityType.PERSON,
            value: 'John Smith',
            confidence: 0.95,
          },
        ],
        actionItems: [
          {
            actionType: ActionType.REPLY_REQUIRED,
            description: 'Respond to meeting invitation',
            priority: Priority.HIGH,
          },
        ],
        tags: ['meeting', 'urgent'],
        confidence: 0.9,
      };

      const result = service.validateLLMResponse(validResponse);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidResponse = {
        // Missing required fields
        entities: [],
        actionItems: [],
        tags: [],
        confidence: 0.8,
      };

      const result = service.validateLLMResponse(invalidResponse);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: category');
      expect(result.errors).toContain('Missing required field: priority');
      expect(result.errors).toContain('Missing required field: sentiment');
      expect(result.errors).toContain('Missing required field: summary');
    });

    it('should detect invalid enum values in response', () => {
      const invalidResponse = {
        category: 'INVALID_CATEGORY',
        priority: 'INVALID_PRIORITY',
        sentiment: 'INVALID_SENTIMENT',
        summary: 'Test summary',
        entities: [
          {
            type: 'INVALID_ENTITY_TYPE',
            value: 'Test',
            confidence: 0.8,
          },
        ],
        actionItems: [
          {
            actionType: 'INVALID_ACTION_TYPE',
            description: 'Test action',
            priority: 'INVALID_PRIORITY',
          },
        ],
        tags: [],
        confidence: 0.8,
      };

      const result = service.validateLLMResponse(invalidResponse);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid category: INVALID_CATEGORY');
      expect(result.errors).toContain('Invalid priority: INVALID_PRIORITY');
      expect(result.errors).toContain('Invalid sentiment: INVALID_SENTIMENT');
      expect(result.errors).toContain('Invalid entity type at index 0: INVALID_ENTITY_TYPE');
      expect(result.errors).toContain('Invalid action type at index 0: INVALID_ACTION_TYPE');
    });
  });

  describe('getAvailableEnums', () => {
    it('should return all available enum values', () => {
      const enums = service.getAvailableEnums();
      
      expect(enums.categories).toContain(EmailCategory.WORK);
      expect(enums.categories).toContain(EmailCategory.PERSONAL);
      expect(enums.priorities).toContain(Priority.LOW);
      expect(enums.priorities).toContain(Priority.HIGH);
      expect(enums.sentiments).toContain(Sentiment.POSITIVE);
      expect(enums.sentiments).toContain(Sentiment.NEGATIVE);
      expect(enums.entityTypes).toContain(EntityType.PERSON);
      expect(enums.entityTypes).toContain(EntityType.ORGANIZATION);
      expect(enums.actionTypes).toContain(ActionType.REPLY_REQUIRED);
      expect(enums.actionTypes).toContain(ActionType.SCHEDULE_MEETING);
    });
  });
}); 