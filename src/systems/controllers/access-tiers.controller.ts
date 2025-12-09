import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { AccessTierService } from '../services/access-tier.service';
import { CreateAccessTierDto } from '../dto/create-access-tier.dto';

@Controller('systems/:systemId/access-tiers')
export class AccessTiersController {
  constructor(private readonly accessTierService: AccessTierService) {}

  @Get()
  async findBySystem(@Param('systemId') systemId: string) {
    return await this.accessTierService.findBySystemId(systemId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('systemId') systemId: string,
    @Body() createTierDto: Omit<CreateAccessTierDto, 'systemId'>,
  ) {
    return await this.accessTierService.create({
      ...createTierDto,
      systemId,
    });
  }
}
