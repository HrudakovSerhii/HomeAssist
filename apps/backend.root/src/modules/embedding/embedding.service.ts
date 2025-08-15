import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EmailCategory } from '@prisma/client';
import { TemplateNames } from '../../types/template.types';
import { CATEGORY_DESCRIPTIONS } from './embedding.categories';

interface CategoryEmbedding {
  category: EmailCategory;
  embeddings: number[][];
  averageEmbedding: number[];
}

// Singleton class for managing the embedding pipeline (following Hugging Face docs pattern)
class EmbeddingPipeline {
  static task = 'feature-extraction';
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance: any = null;

  static async getInstance(progress_callback: any = null) {
    if (this.instance === null) {
      const TransformersApi = Function(
        'return import("@xenova/transformers")'
      )();
      const { pipeline } = await TransformersApi;

      this.instance = await pipeline(this.task as any, this.model, {
        quantized: true,
        progress_callback,
      });
    }
    return this.instance;
  }
}

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private embeddingPipeline: any = null;
  private categoryEmbeddings: CategoryEmbedding[] = [];
  private isInitialized = false;

  async onModuleInit() {
    await this.initializeEmbeddings();
  }

  /**
   * Initialize the embedding pipeline and precompute category embeddings
   */
  private async initializeEmbeddings(): Promise<void> {
    try {
      this.logger.log('🚀 Initializing embedding pipeline...');

      // Initialize the sentence transformer pipeline using singleton pattern
      this.embeddingPipeline = await EmbeddingPipeline.getInstance(
        (progress: any) => {
          if (progress.status === 'downloading') {
            this.logger.log(
              `📥 Downloading model: ${Math.round(progress.progress || 0)}%`
            );
          }
        }
      );

      this.logger.log('✅ Embedding pipeline initialized successfully');

      // Precompute category embeddings
      await this.precomputeCategoryEmbeddings();

      this.isInitialized = true;
      this.logger.log(
        `🎯 EmbeddingService fully initialized with ${this.categoryEmbeddings.length} categories`
      );
    } catch (error) {
      this.logger.error('❌ Failed to initialize embedding pipeline:', error);
      throw error;
    }
  }

  /**
   * Precompute embeddings for all category descriptions
   */
  private async precomputeCategoryEmbeddings(): Promise<void> {
    this.logger.log('📊 Precomputing category embeddings...');

    for (const [category, descriptions] of Object.entries(
      CATEGORY_DESCRIPTIONS
    )) {
      try {
        const embeddings: number[][] = [];

        // Generate embeddings for each description variation
        for (const description of descriptions) {
          const embedding = await this.generateEmbedding(description);
          embeddings.push(embedding);
        }

        // Calculate average embedding for the category
        const averageEmbedding = this.calculateAverageEmbedding(embeddings);

        this.categoryEmbeddings.push({
          category: category as EmailCategory,
          embeddings,
          averageEmbedding,
        });

        this.logger.log(
          `✅ Computed embeddings for ${category} (${descriptions.length} variations)`
        );
      } catch (error) {
        this.logger.error(
          `❌ Failed to compute embeddings for ${category}:`,
          error
        );
      }
    }
  }

  /**
   * Generate embedding for a given text
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embeddingPipeline) {
      throw new Error('Embedding pipeline not initialized');
    }

    try {
      const result = await this.embeddingPipeline(text, {
        pooling: 'mean',
        normalize: true,
      });

      // Convert tensor to array
      return Array.from(result.data);
    } catch (error) {
      this.logger.error(
        `Failed to generate embedding for text: "${text}"`,
        error
      );
      throw error;
    }
  }

  /**
   * Calculate average embedding from multiple embeddings
   */
  private calculateAverageEmbedding(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];

    const embeddingLength = embeddings[0].length;
    const average = new Array(embeddingLength).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < embeddingLength; i++) {
        average[i] += embedding[i];
      }
    }

    // Normalize by count
    for (let i = 0; i < embeddingLength; i++) {
      average[i] /= embeddings.length;
    }

    return average;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Classify email subject into the most appropriate category
   */
  async classifyEmailSubject(subject: string): Promise<{
    category: EmailCategory;
    confidence: number;
    scores: Record<EmailCategory, number>;
  }> {
    if (!this.isInitialized) {
      throw new Error('EmbeddingService not initialized');
    }

    try {
      // Generate embedding for the email subject
      const subjectEmbedding = await this.generateEmbedding(subject);

      // Calculate similarities with all categories
      const scores: Record<string, number> = {};
      let bestCategory: EmailCategory = EmailCategory.WORK; // Default fallback
      let bestScore = -1;

      for (const categoryData of this.categoryEmbeddings) {
        // Calculate similarity with average embedding
        const avgSimilarity = this.cosineSimilarity(
          subjectEmbedding,
          categoryData.averageEmbedding
        );

        // Calculate max similarity with individual description embeddings
        const maxSimilarity = Math.max(
          ...categoryData.embeddings.map((embedding) =>
            this.cosineSimilarity(subjectEmbedding, embedding)
          )
        );

        // Combine average and max similarity (weighted)
        const finalScore = avgSimilarity * 0.6 + maxSimilarity * 0.4;
        scores[categoryData.category] = finalScore;

        if (finalScore > bestScore) {
          bestScore = finalScore;
          bestCategory = categoryData.category;
        }
      }

      this.logger.log(
        `📧 Classified "${subject}" as ${bestCategory} (confidence: ${(
          bestScore * 100
        ).toFixed(1)}%)`
      );

      return {
        category: bestCategory,
        confidence: bestScore,
        scores: scores as Record<EmailCategory, number>,
      };
    } catch (error) {
      this.logger.error(
        `Failed to classify email subject: "${subject}"`,
        error
      );
      // Return default classification on error
      return {
        category: EmailCategory.WORK,
        confidence: 0.5,
        scores: {} as Record<EmailCategory, number>,
      };
    }
  }

  /**
   * Get the best template for a given category
   */
  getCategoryTemplate(category: EmailCategory): string {
    // Map categories to specific templates
    const categoryTemplateMap: Record<EmailCategory, string> = {
      [EmailCategory.INVOICE]: TemplateNames.INVOICE_PROCESSOR,
      [EmailCategory.APPOINTMENT]: TemplateNames.MEETING_PROCESSOR,
      [EmailCategory.MARKETING]: TemplateNames.MARKETING_PROCESSOR,
      [EmailCategory.NEWSLETTER]: TemplateNames.NEWS_PROCESSOR,
      [EmailCategory.RECEIPT]: TemplateNames.FINANCIAL_PROCESSOR,
      [EmailCategory.SUPPORT]: TemplateNames.GENERAL_EMAIL_ANALYSIS,
      [EmailCategory.WORK]: TemplateNames.GENERAL_EMAIL_ANALYSIS,
      [EmailCategory.PERSONAL]: TemplateNames.SENTIMENT_FOCUSED,
      [EmailCategory.NOTIFICATION]: TemplateNames.GENERAL_EMAIL_ANALYSIS,
    };

    return (
      categoryTemplateMap[category] || TemplateNames.GENERAL_EMAIL_ANALYSIS
    );
  }

  /**
   * Check if the service is ready for use
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}
