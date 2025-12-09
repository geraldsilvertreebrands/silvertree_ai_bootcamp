import { Controller, Get, Query } from '@nestjs/common';
import { AccessGrantQueryService } from '../services/access-grant-query.service';
import { AccessOverviewQueryDto } from '../dto/access-overview-query.dto';

@Controller('access-overview')
export class AccessOverviewController {
  constructor(private readonly accessGrantQueryService: AccessGrantQueryService) {}

  @Get()
  async findAll(@Query() query: AccessOverviewQueryDto) {
    return await this.accessGrantQueryService.findAll(query);
  }
}
