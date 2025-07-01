import { Controller, Get, Query } from '@nestjs/common';
import { DataPreviewService } from './data-preview.service';
import { ExtractedDataQueryDto } from './dto/extracted-data-query.dto';

@Controller('data-preview')
export class DataPreviewController {
  constructor(private readonly dataPreviewService: DataPreviewService) {}

  @Get('extracted-email-data')
  async getExtractedEmailData(@Query() queryDto: ExtractedDataQueryDto) {
    return this.dataPreviewService.getExtractedEmailData(queryDto);
  }

  @Get('filter-options')
  async getFilterOptions() {
    return this.dataPreviewService.getFilterOptions();
  }
} 