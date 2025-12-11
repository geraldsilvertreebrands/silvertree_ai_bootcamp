import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { SystemOwnerService } from '../services/system-owner.service';
import { AssignSystemOwnerDto } from '../dto/assign-system-owner.dto';

@Controller('systems/:systemId/owners')
export class SystemOwnersController {
  constructor(private readonly systemOwnerService: SystemOwnerService) {}

  @Post()
  async assign(@Param('systemId') systemId: string, @Body() assignDto: AssignSystemOwnerDto) {
    return await this.systemOwnerService.assign(systemId, assignDto);
  }

  @Get()
  async findBySystem(@Param('systemId') systemId: string) {
    return await this.systemOwnerService.findBySystem(systemId);
  }

  @Delete(':userId')
  async remove(@Param('systemId') systemId: string, @Param('userId') userId: string) {
    await this.systemOwnerService.remove(systemId, userId);
    return { message: 'System owner removed successfully' };
  }
}

@Controller('users/:userId/owned-systems')
export class UserOwnedSystemsController {
  constructor(private readonly systemOwnerService: SystemOwnerService) {}

  @Get()
  async findByUser(@Param('userId') userId: string) {
    return await this.systemOwnerService.findByUser(userId);
  }
}






