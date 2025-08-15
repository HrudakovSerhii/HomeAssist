import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingService } from './embedding.service';
import { EmailCategory } from '@prisma/client';
import { TemplateNames } from '../../types/template.types';

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmbeddingService],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCategoryTemplate', () => {
    it('should return correct template for INVOICE category', () => {
      const template = service.getCategoryTemplate(EmailCategory.INVOICE);
      expect(template).toBe(TemplateNames.INVOICE_PROCESSOR);
    });

    it('should return correct template for APPOINTMENT category', () => {
      const template = service.getCategoryTemplate(EmailCategory.APPOINTMENT);
      expect(template).toBe(TemplateNames.MEETING_PROCESSOR);
    });

    it('should return correct template for MARKETING category', () => {
      const template = service.getCategoryTemplate(EmailCategory.MARKETING);
      expect(template).toBe(TemplateNames.MARKETING_PROCESSOR);
    });

    it('should return correct template for NEWSLETTER category', () => {
      const template = service.getCategoryTemplate(EmailCategory.NEWSLETTER);
      expect(template).toBe(TemplateNames.NEWS_PROCESSOR);
    });

    it('should return correct template for RECEIPT category', () => {
      const template = service.getCategoryTemplate(EmailCategory.RECEIPT);
      expect(template).toBe(TemplateNames.FINANCIAL_PROCESSOR);
    });

    it('should return general template for WORK category', () => {
      const template = service.getCategoryTemplate(EmailCategory.WORK);
      expect(template).toBe(TemplateNames.GENERAL_EMAIL_ANALYSIS);
    });

    it('should return sentiment template for PERSONAL category', () => {
      const template = service.getCategoryTemplate(EmailCategory.PERSONAL);
      expect(template).toBe(TemplateNames.SENTIMENT_FOCUSED);
    });
  });

  describe('isReady', () => {
    it('should return false initially', () => {
      expect(service.isReady()).toBe(false);
    });
  });

  // Note: classifyEmailSubject tests would require the actual model to be loaded
  // which is time-consuming for unit tests. Integration tests would be better suited.
}); 