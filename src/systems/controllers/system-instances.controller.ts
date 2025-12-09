import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { SystemInstanceService } from '../services/system-instance.service';
import { CreateSystemInstanceDto } from '../dto/create-system-instance.dto';

@Controller('systems/:systemId/instances')
export class SystemInstancesController {
  constructor(private readonly systemInstanceService: SystemInstanceService) {}

  @Get()
  async findBySystem(@Param('systemId') systemId: string) {
    return await this.systemInstanceService.findBySystemId(systemId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('systemId') systemId: string,
    @Body() createInstanceDto: Omit<CreateSystemInstanceDto, 'systemId'>,
  ) {
    return await this.systemInstanceService.create({
      ...createInstanceDto,
      systemId,
    });
  }
}
