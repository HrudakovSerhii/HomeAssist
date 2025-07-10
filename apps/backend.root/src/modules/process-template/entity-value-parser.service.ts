import { Injectable } from '@nestjs/common';
import { EntityType } from '@prisma/client';

export interface ParsedEntityValue {
  displayValue: string;      // Always a string for display
  rawValue: string | string[]; // Original value(s)
  isArray: boolean;          // Whether it's an array
  count: number;             // Number of values
}

@Injectable()
export class EntityValueParserService {
  
  /**
   * Defines which entity types should expect array values
   */
  private readonly ARRAY_ENTITY_TYPES = new Set([
    'DATE_RANGE',
    'URL',           // Can have multiple URLs
    'TECHNOLOGY',    // Can have multiple technologies
    'PRODUCT',       // Can have multiple products
    'PHONE_NUMBER',  // Can have multiple phone numbers
    'EMAIL_ADDRESS', // Can have multiple email addresses
  ]);

  /**
   * Defines which entity types should always be single values
   */
  private readonly SINGLE_ENTITY_TYPES = new Set([
    'PERSON',
    'ORGANIZATION',
    'DATE',
    'TIME',
    'LOCATION',
    'AMOUNT',
    'CURRENCY',
    'INVOICE_NUMBER',
    'ACCOUNT_NUMBER',
    'REGION',
  ]);

  /**
   * Parse entity value based on entity type
   */
  parseEntityValue(entityType: EntityType, value: any): ParsedEntityValue {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return {
        displayValue: '',
        rawValue: '',
        isArray: false,
        count: 0,
      };
    }

    // If it's already a string, check if it needs to be parsed as JSON
    if (typeof value === 'string') {
      try {
        // Try to parse as JSON array
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return this.handleArrayValue(entityType, parsed);
        }
        // If parsed but not array, use the parsed value
        return this.handleSingleValue(entityType, parsed);
      } catch {
        // Not JSON, treat as single string value
        return this.handleSingleValue(entityType, value);
      }
    }

    // If it's already an array
    if (Array.isArray(value)) {
      return this.handleArrayValue(entityType, value);
    }

    // For any other type, convert to string
    return this.handleSingleValue(entityType, String(value));
  }

  /**
   * Handle single value
   */
  private handleSingleValue(entityType: EntityType, value: any): ParsedEntityValue {
    const stringValue = String(value);
    
    return {
      displayValue: stringValue,
      rawValue: stringValue,
      isArray: false,
      count: 1,
    };
  }

  /**
   * Handle array value
   */
  private handleArrayValue(entityType: EntityType, values: any[]): ParsedEntityValue {
    const stringValues = values.map(v => String(v));
    
    // Generate display value based on entity type
    const displayValue = this.generateDisplayValue(entityType, stringValues);
    
    return {
      displayValue,
      rawValue: stringValues,
      isArray: true,
      count: stringValues.length,
    };
  }

  /**
   * Generate display value for arrays
   */
  private generateDisplayValue(entityType: EntityType, values: string[]): string {
    if (values.length === 0) return '';
    if (values.length === 1) return values[0];

    const typeStr = String(entityType);
    switch (typeStr) {
      case 'DATE_RANGE':
        return values.length === 2 ? `${values[0]} to ${values[1]}` : values.join(', ');
      
      case 'URL':
        return values.length <= 2 ? values.join(', ') : `${values[0]} and ${values.length - 1} more`;
      
      case 'TECHNOLOGY':
        return values.length <= 3 ? values.join(', ') : `${values.slice(0, 3).join(', ')} and ${values.length - 3} more`;
      
      case 'PRODUCT':
        return values.length <= 2 ? values.join(', ') : `${values[0]} and ${values.length - 1} more`;
      
      case 'PHONE_NUMBER':
      case 'EMAIL_ADDRESS':
        return values.length <= 2 ? values.join(', ') : `${values[0]} and ${values.length - 1} more`;
      
      default:
        return values.join(', ');
    }
  }

  /**
   * Serialize entity value for database storage
   */
  serializeForDatabase(entityType: EntityType, value: any): string {
    const parsed = this.parseEntityValue(entityType, value);
    
    if (parsed.isArray) {
      // Store as JSON string
      return JSON.stringify(parsed.rawValue);
    }
    
    // Store as plain string
    return String(parsed.rawValue);
  }

  /**
   * Deserialize entity value from database
   */
  deserializeFromDatabase(entityType: EntityType, storedValue: string): ParsedEntityValue {
    return this.parseEntityValue(entityType, storedValue);
  }

  /**
   * Validate entity value for given type
   */
  validateEntityValue(entityType: EntityType, value: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const typeStr = String(entityType);
    
    try {
      const parsed = this.parseEntityValue(entityType, value);
      
      // Check if array types have arrays when expected
      if (this.ARRAY_ENTITY_TYPES.has(typeStr)) {
        if (typeStr === 'DATE_RANGE' && parsed.isArray && parsed.count !== 2) {
          errors.push(`DATE_RANGE must have exactly 2 values (start, end), got ${parsed.count}`);
        }
      }
      
      // Check if single types don't have arrays
      if (this.SINGLE_ENTITY_TYPES.has(typeStr) && parsed.isArray) {
        errors.push(`${typeStr} should be a single value, not an array`);
      }
      
      // Validate specific formats
      if (typeStr === 'URL' && parsed.isArray) {
        const urls = parsed.rawValue as string[];
        urls.forEach((url, index) => {
          if (!this.isValidUrl(url)) {
            errors.push(`Invalid URL at index ${index}: ${url}`);
          }
        });
      }
      
      if (typeStr === 'EMAIL_ADDRESS' && parsed.isArray) {
        const emails = parsed.rawValue as string[];
        emails.forEach((email, index) => {
          if (!this.isValidEmail(email)) {
            errors.push(`Invalid email at index ${index}: ${email}`);
          }
        });
      }
      
    } catch (error) {
      errors.push(`Failed to parse entity value: ${error.message}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get parsing strategy for template instructions
   */
  getParsingStrategy(entityType: EntityType): string {
    const typeStr = String(entityType);
    if (this.ARRAY_ENTITY_TYPES.has(typeStr)) {
      switch (typeStr) {
        case 'DATE_RANGE':
          return 'Provide as array of 2 dates: ["start_date", "end_date"]';
        case 'URL':
          return 'Provide as array if multiple URLs: ["url1", "url2"] or single string if one URL';
        case 'TECHNOLOGY':
          return 'Provide as array if multiple technologies: ["React", "Node.js"] or single string if one';
        case 'PRODUCT':
          return 'Provide as array if multiple products: ["Product A", "Product B"] or single string if one';
        case 'PHONE_NUMBER':
          return 'Provide as array if multiple numbers: ["+1234567890", "+0987654321"] or single string if one';
        case 'EMAIL_ADDRESS':
          return 'Provide as array if multiple emails: ["email1@example.com", "email2@example.com"] or single string if one';
        default:
          return 'Provide as array if multiple values, single string if one value';
      }
    }
    
    return 'Provide as single string value';
  }

  /**
   * Get all entity types that can have arrays
   */
  getArrayCapableEntityTypes(): string[] {
    return Array.from(this.ARRAY_ENTITY_TYPES);
  }

  /**
   * Check if entity type can have arrays
   */
  canHaveArrayValue(entityType: EntityType): boolean {
    return this.ARRAY_ENTITY_TYPES.has(String(entityType));
  }

  /**
   * Simple URL validation
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Simple email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
} 