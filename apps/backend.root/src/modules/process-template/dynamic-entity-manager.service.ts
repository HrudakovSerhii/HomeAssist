import { Injectable, Logger } from '@nestjs/common';
import { EntityType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface DynamicEntityType {
  name: string;
  confidence: number;
  usageCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isApproved: boolean;
  mappedToStandard?: EntityType;
  examples: string[];
}

export interface EntityTypeSuggestion {
  suggestedType: string;
  confidence: number;
  context: string;
  examples: string[];
}

@Injectable()
export class DynamicEntityManagerService {
  private readonly logger = new Logger(DynamicEntityManagerService.name);
  private readonly MAX_ENTITY_TYPES = 20;
  private readonly MIN_USAGE_FOR_APPROVAL = 3;
  private readonly MIN_CONFIDENCE_FOR_APPROVAL = 0.8;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process a new entity type suggested by LLM
   */
  async processNewEntityType(
    suggestion: EntityTypeSuggestion
  ): Promise<{ 
    accepted: boolean; 
    mappedTo?: EntityType; 
    reason: string;
  }> {
    // 1. Check if it maps to existing standard types
    const mapping = this.findStandardMapping(suggestion.suggestedType);
    if (mapping) {
      return {
        accepted: true,
        mappedTo: mapping,
        reason: `Mapped to standard type: ${mapping}`
      };
    }

    // 2. Check if it's a known dynamic type
    const existing = await this.getDynamicEntityType(suggestion.suggestedType);
    if (existing) {
      await this.updateUsageStats(suggestion.suggestedType, suggestion.examples);
      return {
        accepted: true,
        reason: `Known dynamic type, usage updated`
      };
    }

    // 3. Check if we can accept new types
    const totalTypes = await this.getTotalEntityTypeCount();
    if (totalTypes >= this.MAX_ENTITY_TYPES) {
      // Try to consolidate or suggest mapping
      const consolidationCandidate = await this.findConsolidationCandidate(suggestion.suggestedType);
      if (consolidationCandidate) {
        return {
          accepted: true,
          mappedTo: consolidationCandidate,
          reason: `Consolidated with existing type: ${consolidationCandidate}`
        };
      }
      
      return {
        accepted: false,
        reason: `Maximum entity types reached (${this.MAX_ENTITY_TYPES}). Consider consolidating existing types.`
      };
    }

    // 4. Create new dynamic entity type
    await this.createDynamicEntityType(suggestion);
    
    return {
      accepted: true,
      reason: `New dynamic entity type created: ${suggestion.suggestedType}`
    };
  }

  /**
   * Find mapping to standard entity types
   */
  private findStandardMapping(suggestedType: string): EntityType | null {
    const type = suggestedType.toUpperCase();
    const mappings: Record<string, EntityType> = {
      // Common variations
      'COMPANY': EntityType.ORGANIZATION,
      'BUSINESS': EntityType.ORGANIZATION,
      'FIRM': EntityType.ORGANIZATION,
      'CORP': EntityType.ORGANIZATION,
      'CORPORATION': EntityType.ORGANIZATION,
      'NAME': EntityType.PERSON,
      'INDIVIDUAL': EntityType.PERSON,
      'CONTACT': EntityType.PERSON,
      'WEBSITE': EntityType.URL,
      'LINK': EntityType.URL,
      'SITE': EntityType.URL,
      'MONEY': EntityType.AMOUNT,
      'PRICE': EntityType.AMOUNT,
      'COST': EntityType.AMOUNT,
      'FEE': EntityType.AMOUNT,
      'PAYMENT': EntityType.AMOUNT,
      'PHONE': EntityType.PHONE_NUMBER,
      'MOBILE': EntityType.PHONE_NUMBER,
      'TEL': EntityType.PHONE_NUMBER,
      'EMAIL': EntityType.EMAIL_ADDRESS,
      'MAIL': EntityType.EMAIL_ADDRESS,
      'ADDRESS': EntityType.LOCATION,
      'PLACE': EntityType.LOCATION,
      'COUNTRY': EntityType.LOCATION,
      'CITY': EntityType.LOCATION,
             'TOOL': 'TECHNOLOGY' as EntityType,
       'SOFTWARE': 'TECHNOLOGY' as EntityType,
       'FRAMEWORK': 'TECHNOLOGY' as EntityType,
       'LIBRARY': 'TECHNOLOGY' as EntityType,
       'PLATFORM': 'TECHNOLOGY' as EntityType,
       'ITEM': EntityType.PRODUCT,
       'GOODS': EntityType.PRODUCT,
       'SERVICE': EntityType.PRODUCT,
       'TIMEFRAME': 'DATE_RANGE' as EntityType,
       'PERIOD': 'DATE_RANGE' as EntityType,
       'DURATION': 'DATE_RANGE' as EntityType,
       'INTERVAL': 'DATE_RANGE' as EntityType,
    };

    return mappings[type] || null;
  }

  /**
   * Get or create dynamic entity type
   */
  private async getDynamicEntityType(typeName: string): Promise<DynamicEntityType | null> {
    // This would query a dynamic_entity_types table
    // For now, we'll use a simplified approach
    try {
      const result = await this.prisma.$queryRaw`
        SELECT * FROM dynamic_entity_types WHERE name = ${typeName}
      `;
      return result[0] || null;
    } catch (error) {
      // Table doesn't exist yet - would need migration
      return null;
    }
  }

  /**
   * Create new dynamic entity type
   */
  private async createDynamicEntityType(suggestion: EntityTypeSuggestion): Promise<void> {
    const now = new Date();
    
    try {
      await this.prisma.$queryRaw`
        INSERT INTO dynamic_entity_types 
        (name, confidence, usage_count, first_seen_at, last_seen_at, is_approved, examples)
        VALUES (${suggestion.suggestedType}, ${suggestion.confidence}, 1, ${now}, ${now}, 
                ${suggestion.confidence >= this.MIN_CONFIDENCE_FOR_APPROVAL}, ${JSON.stringify(suggestion.examples)})
      `;
      
      this.logger.log(`Created dynamic entity type: ${suggestion.suggestedType}`);
    } catch (error) {
      this.logger.error(`Failed to create dynamic entity type: ${error.message}`);
      // Fallback - store in memory or cache
    }
  }

  /**
   * Update usage statistics for dynamic entity type
   */
  private async updateUsageStats(typeName: string, examples: string[]): Promise<void> {
    const now = new Date();
    
    try {
      await this.prisma.$queryRaw`
        UPDATE dynamic_entity_types 
        SET usage_count = usage_count + 1, 
            last_seen_at = ${now},
            examples = ${JSON.stringify(examples)}
        WHERE name = ${typeName}
      `;
    } catch (error) {
      this.logger.error(`Failed to update usage stats: ${error.message}`);
    }
  }

  /**
   * Get total count of entity types (standard + dynamic)
   */
  private async getTotalEntityTypeCount(): Promise<number> {
    const standardCount = Object.values(EntityType).length;
    
    try {
      const result = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count FROM dynamic_entity_types WHERE is_approved = true
      `;
      const dynamicCount = result[0]?.count || 0;
      return standardCount + dynamicCount;
    } catch (error) {
      return standardCount; // Fallback to standard types only
    }
  }

  /**
   * Find consolidation candidate for similar types
   */
  private async findConsolidationCandidate(suggestedType: string): Promise<EntityType | null> {
    // Simple similarity check - could be enhanced with better NLP
    const similarities = [
      { words: ['document', 'file', 'report', 'paper'], target: EntityType.PRODUCT },
      { words: ['event', 'meeting', 'appointment', 'call'], target: EntityType.DATE },
      { words: ['skill', 'expertise', 'knowledge'], target: 'TECHNOLOGY' as EntityType },
      { words: ['department', 'division', 'team'], target: EntityType.ORGANIZATION },
    ];

    const lowerType = suggestedType.toLowerCase();
    
    for (const similarity of similarities) {
      if (similarity.words.some(word => lowerType.includes(word))) {
        return similarity.target;
      }
    }

    return null;
  }

  /**
   * Get all approved entity types (standard + dynamic)
   */
  async getAllApprovedEntityTypes(): Promise<string[]> {
    const standardTypes = Object.values(EntityType);
    
    try {
      const result = await this.prisma.$queryRaw`
        SELECT name FROM dynamic_entity_types WHERE is_approved = true
      ` as Array<{ name: string }>;
      const dynamicTypes = result.map(r => r.name);
      return [...standardTypes, ...dynamicTypes];
    } catch (error) {
      return standardTypes;
    }
  }

  /**
   * Get entity type suggestions for review
   */
  async getEntityTypeSuggestions(): Promise<DynamicEntityType[]> {
    try {
      const result = await this.prisma.$queryRaw`
        SELECT * FROM dynamic_entity_types 
        WHERE is_approved = false AND usage_count >= ${this.MIN_USAGE_FOR_APPROVAL}
        ORDER BY usage_count DESC, confidence DESC
      ` as DynamicEntityType[];
      return result;
    } catch (error) {
      return [];
    }
  }

  /**
   * Approve dynamic entity type
   */
  async approveEntityType(typeName: string): Promise<void> {
    try {
      await this.prisma.$queryRaw`
        UPDATE dynamic_entity_types 
        SET is_approved = true
        WHERE name = ${typeName}
      `;
      
      this.logger.log(`Approved dynamic entity type: ${typeName}`);
    } catch (error) {
      this.logger.error(`Failed to approve entity type: ${error.message}`);
    }
  }

  /**
   * Reject and remove dynamic entity type
   */
  async rejectEntityType(typeName: string): Promise<void> {
    try {
      await this.prisma.$queryRaw`
        DELETE FROM dynamic_entity_types WHERE name = ${typeName}
      `;
      
      this.logger.log(`Rejected dynamic entity type: ${typeName}`);
    } catch (error) {
      this.logger.error(`Failed to reject entity type: ${error.message}`);
    }
  }
} 