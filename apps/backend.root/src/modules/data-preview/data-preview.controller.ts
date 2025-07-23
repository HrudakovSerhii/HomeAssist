import { Controller, Get, Query } from '@nestjs/common';
import { DataPreviewService } from './data-preview.service';
import { ProcessedEmailsQueryDto } from './dto/processed-emails-query.dto';

@Controller('data')
export class DataPreviewController {
  constructor(private readonly dataPreviewService: DataPreviewService) {}

  @Get('processed-emails')
  async getProcessedEmailData(@Query() queryDto: ProcessedEmailsQueryDto) {
    return this.dataPreviewService.getProcessedEmailData(queryDto);
  }

  @Get('filter-options')
  async getFilterOptions() {
    return this.dataPreviewService.getFilterOptions();
  }
}
