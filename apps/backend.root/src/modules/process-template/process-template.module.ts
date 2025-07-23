import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { TemplateService } from './template.service';
import { TemplateValidatorService } from './template-validator.service';
import { DynamicEntityManagerService } from './dynamic-entity-manager.service';
import { EntityValueParserService } from './entity-value-parser.service';
import { DynamicEntityTypesController } from './dynamic-entity-types.controller';

@Module({
  imports: [PrismaModule],
  controllers: [DynamicEntityTypesController],
  providers: [
    TemplateService,
    TemplateValidatorService,
    DynamicEntityManagerService,
    EntityValueParserService,
  ],
  exports: [
    TemplateService,
    TemplateValidatorService,
    DynamicEntityManagerService,
    EntityValueParserService,
  ],
})
export class ProcessTemplateModule {} 