import { Injectable } from '@nestjs/common';
import {
  EmailCategory,
  EntityType,
  ActionType,
  Priority,
  Sentiment,
} from '@prisma/client';
import {
  EmailAnalysisTemplate,
  TemplateValidationResult,
} from '../../types/email.types';
import {
  DynamicEntityManagerService,
  EntityTypeSuggestion,
} from './dynamic-entity-manager.service';

@Injectable()
export class TemplateValidatorService {
  constructor(
    private readonly dynamicEntityManager: DynamicEntityManagerService
  ) {}

  /**
   * Validates a template against Prisma schema types
   */
  validateTemplate(template: EmailAnalysisTemplate): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate categories
    const validCategories = Object.values(EmailCategory);
    const invalidCategories = template.categories.filter(
      (cat) => !validCategories.includes(cat)
    );
    if (invalidCategories.length > 0) {
      errors.push(`Invalid categories: ${invalidCategories.join(', ')}`);
    }

    // Validate example response
    const example = template.exampleResponse;

    // Check category
    if (!validCategories.includes(example.category)) {
      errors.push(`Invalid example category: ${example.category}`);
    }

    // Check priority
    const validPriorities = Object.values(Priority);
    if (!validPriorities.includes(example.priority)) {
      errors.push(`Invalid example priority: ${example.priority}`);
    }

    // Check sentiment
    const validSentiments = Object.values(Sentiment);
    if (!validSentiments.includes(example.sentiment)) {
      errors.push(`Invalid example sentiment: ${example.sentiment}`);
    }

    // Check entities
    const validEntityTypes = Object.values(EntityType);
    example.entities.forEach((entity, index) => {
      if (!validEntityTypes.includes(entity.type)) {
        errors.push(`Invalid entity type at index ${index}: ${entity.type}`);
      }
      if (entity.confidence < 0 || entity.confidence > 1) {
        errors.push(
          `Invalid confidence value at entity index ${index}: ${entity.confidence}`
        );
      }
    });

    // Check action items
    const validActionTypes = Object.values(ActionType);
    example.actionItems.forEach((action, index) => {
      if (!validActionTypes.includes(action.actionType)) {
        errors.push(
          `Invalid action type at index ${index}: ${action.actionType}`
        );
      }
      if (!validPriorities.includes(action.priority)) {
        errors.push(
          `Invalid action priority at index ${index}: ${action.priority}`
        );
      }
    });

    // Check if template string includes all enum values
    const templateString = template.template;
    const missingEnums = this.checkEnumCoverage(templateString);
    if (missingEnums.length > 0) {
      warnings.push(...missingEnums);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Checks if template string includes all available enum values
   */
  private checkEnumCoverage(templateString: string): string[] {
    const warnings: string[] = [];

    // Check if template mentions all categories
    const mentionedCategories = Object.values(EmailCategory).filter((cat) =>
      templateString.includes(cat)
    );
    if (mentionedCategories.length < Object.values(EmailCategory).length) {
      warnings.push(
        'Template does not mention all available EmailCategory values'
      );
    }

    // Check if template mentions all entity types
    const mentionedEntityTypes = Object.values(EntityType).filter((type) =>
      templateString.includes(type)
    );
    if (mentionedEntityTypes.length < Object.values(EntityType).length) {
      warnings.push(
        'Template does not mention all available EntityType values'
      );
    }

    // Check if template mentions all action types
    const mentionedActionTypes = Object.values(ActionType).filter((type) =>
      templateString.includes(type)
    );
    if (mentionedActionTypes.length < Object.values(ActionType).length) {
      warnings.push(
        'Template does not mention all available ActionType values'
      );
    }

    return warnings;
  }

  /**
   * Validates parsed LLM response against schema types with dynamic entity handling
   */
  async validateLLMResponse(response: any): Promise<TemplateValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!response.category) {
      errors.push('Missing required field: category');
    } else if (!Object.values(EmailCategory).includes(response.category)) {
      errors.push(`Invalid category: ${response.category}`);
    }

    if (!response.priority) {
      errors.push('Missing required field: priority');
    } else if (!Object.values(Priority).includes(response.priority)) {
      errors.push(`Invalid priority: ${response.priority}`);
    }

    if (!response.sentiment) {
      errors.push('Missing required field: sentiment');
    } else if (!Object.values(Sentiment).includes(response.sentiment)) {
      errors.push(`Invalid sentiment: ${response.sentiment}`);
    }

    if (!response.summary) {
      errors.push('Missing required field: summary');
    }

    // Validate entities with dynamic type handling
    if (response.entities && Array.isArray(response.entities)) {
      const approvedTypes =
        await this.dynamicEntityManager.getAllApprovedEntityTypes();

      for (let index = 0; index < response.entities.length; index++) {
        const entity = response.entities[index];

        // Check if entity type is known
        if (!approvedTypes.includes(entity.type)) {
          // Try to process as new dynamic entity type
          const suggestion: EntityTypeSuggestion = {
            suggestedType: entity.type,
            confidence: entity.confidence || 0.8,
            context: response.summary || 'Unknown context',
            examples: [entity.value],
          };

          const result = await this.dynamicEntityManager.processNewEntityType(
            suggestion
          );

          if (result.accepted) {
            warnings.push(
              `Entity type at index ${index}: ${entity.type} -> ${result.reason}`
            );
            // Update entity type if it was mapped
            if (result.mappedTo) {
              response.entities[index].type = result.mappedTo;
            }
          } else {
            errors.push(
              `Invalid entity type at index ${index}: ${entity.type} - ${result.reason}`
            );
          }
        }

        // Validate confidence value
        if (
          typeof entity.confidence !== 'number' ||
          entity.confidence < 0 ||
          entity.confidence > 1
        ) {
          errors.push(
            `Invalid confidence value at entity index ${index}: ${entity.confidence}`
          );
        }
      }
    }

    // Validate action items if present
    if (response.actionItems && Array.isArray(response.actionItems)) {
      response.actionItems.forEach((action: any, index: number) => {
        if (!Object.values(ActionType).includes(action.actionType)) {
          errors.push(
            `Invalid action type at index ${index}: ${action.actionType}`
          );
        }
        if (
          action.priority &&
          !Object.values(Priority).includes(action.priority)
        ) {
          errors.push(
            `Invalid action priority at index ${index}: ${action.priority}`
          );
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Gets all available enum values for template creation
   */
  getAvailableEnums() {
    return {
      categories: Object.values(EmailCategory),
      priorities: Object.values(Priority),
      sentiments: Object.values(Sentiment),
      entityTypes: Object.values(EntityType),
      actionTypes: Object.values(ActionType),
    };
  }
}
