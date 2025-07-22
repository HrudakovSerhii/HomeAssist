import { Controller, Get, Post, Delete, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { DynamicEntityManagerService, DynamicEntityType } from './dynamic-entity-manager.service';

@Controller('dynamic-entity-types')
export class DynamicEntityTypesController {
  constructor(private readonly dynamicEntityManager: DynamicEntityManagerService) {}

  /**
   * Get all approved entity types (standard + dynamic)
   */
  @Get('approved')
  async getApprovedEntityTypes(): Promise<string[]> {
    return await this.dynamicEntityManager.getAllApprovedEntityTypes();
  }

  /**
   * Get entity type suggestions waiting for review
   */
  @Get('suggestions')
  async getEntityTypeSuggestions(): Promise<DynamicEntityType[]> {
    return await this.dynamicEntityManager.getEntityTypeSuggestions();
  }

  /**
   * Approve a dynamic entity type
   */
  @Post('approve/:typeName')
  async approveEntityType(@Param('typeName') typeName: string): Promise<{ message: string }> {
    try {
      await this.dynamicEntityManager.approveEntityType(typeName);
      return { message: `Entity type '${typeName}' approved successfully` };
    } catch (error) {
      throw new HttpException(
        `Failed to approve entity type: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Reject and remove a dynamic entity type
   */
  @Delete('reject/:typeName')
  async rejectEntityType(@Param('typeName') typeName: string): Promise<{ message: string }> {
    try {
      await this.dynamicEntityManager.rejectEntityType(typeName);
      return { message: `Entity type '${typeName}' rejected and removed` };
    } catch (error) {
      throw new HttpException(
        `Failed to reject entity type: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get entity type statistics and usage
   */
  @Get('stats')
  async getEntityTypeStats(): Promise<{
    totalStandard: number;
    totalDynamic: number;
    pendingApproval: number;
    recentSuggestions: DynamicEntityType[];
  }> {
    try {
      const approved = await this.dynamicEntityManager.getAllApprovedEntityTypes();
      const suggestions = await this.dynamicEntityManager.getEntityTypeSuggestions();
      
      // Count standard types (rough approximation)
      const standardTypes = ['PERSON', 'ORGANIZATION', 'DATE', 'TIME', 'LOCATION', 'EMAIL_ADDRESS', 
                           'PHONE_NUMBER', 'URL', 'AMOUNT', 'CURRENCY', 'INVOICE_NUMBER', 
                           'ACCOUNT_NUMBER', 'PRODUCT', 'REGION', 'TECHNOLOGY', 'DATE_RANGE'];
      
      const totalStandard = standardTypes.length;
      const totalDynamic = approved.length - totalStandard;
      
      return {
        totalStandard,
        totalDynamic: Math.max(0, totalDynamic),
        pendingApproval: suggestions.length,
        recentSuggestions: suggestions.slice(0, 5)
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get entity type stats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Test entity type mapping
   */
  @Post('test-mapping')
  async testMapping(@Body() body: { suggestedType: string; examples: string[] }): Promise<{
    suggestedType: string;
    result: {
      accepted: boolean;
      mappedTo?: string;
      reason: string;
    };
  }> {
    try {
      const result = await this.dynamicEntityManager.processNewEntityType({
        suggestedType: body.suggestedType,
        confidence: 0.8,
        context: 'Manual test',
        examples: body.examples || []
      });

      return {
        suggestedType: body.suggestedType,
        result
      };
    } catch (error) {
      throw new HttpException(
        `Failed to test mapping: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 