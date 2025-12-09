import { Controller, Get, Post, Body, Patch, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { SystemService } from '../services/system.service';
import { CreateSystemDto } from '../dto/create-system.dto';
import { UpdateSystemDto } from '../dto/update-system.dto';
import { SystemNotFoundException } from '../../common/exceptions/system-not-found.exception';

@Controller('systems')
export class SystemsController {
  constructor(private readonly systemService: SystemService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createSystemDto: CreateSystemDto) {
    return await this.systemService.create(createSystemDto);
  }

  @Get()
  async findAll() {
    return await this.systemService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const system = await this.systemService.findById(id);
    if (!system) {
      throw new SystemNotFoundException(id);
    }
    return system;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateSystemDto: UpdateSystemDto) {
    return await this.systemService.update(id, updateSystemDto);
  }
}
