import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { TemplateService } from './template.service';
import { OptimizedTemplateService } from './optimized-template.service';
import { TemplateValidatorService } from './template-validator.service';
import { DynamicEntityManagerService } from './dynamic-entity-manager.service';
import { EntityValueParserService } from './entity-value-parser.service';
import { DynamicEntityTypesController } from './dynamic-entity-types.controller';

@Module({
  imports: [PrismaModule, EmbeddingModule],
  controllers: [DynamicEntityTypesController],
  providers: [
    TemplateService,
    OptimizedTemplateService,
    TemplateValidatorService,
    DynamicEntityManagerService,
    EntityValueParserService,
  ],
  exports: [
    TemplateService,
    OptimizedTemplateService,
    TemplateValidatorService,
    DynamicEntityManagerService,
    EntityValueParserService,
  ],
})
export class ProcessTemplateModule {} 