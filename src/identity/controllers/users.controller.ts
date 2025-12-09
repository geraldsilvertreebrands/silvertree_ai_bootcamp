import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { AssignManagerDto } from '../dto/assign-manager.dto';
import { PaginationDto } from '../dto/pagination.dto';
import { UserNotFoundException } from '../../common/exceptions/user-not-found.exception';
import { AuthService } from '../../auth/auth.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto) {
    return await this.userService.create(createUserDto);
  }

  @Get()
  async findAll(@Query() pagination: PaginationDto) {
    return await this.userService.findAll(pagination);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new UserNotFoundException(id);
    }
    return user;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return await this.userService.update(id, updateUserDto);
  }

  @Patch(':id/manager')
  async assignManager(@Param('id') id: string, @Body() assignManagerDto: AssignManagerDto) {
    return await this.userService.assignManager(id, assignManagerDto.managerId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.userService.remove(id);
  }

  @Get('me/grants')
  async getMyGrants(@Headers('authorization') authHeader?: string) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await this.authService.me(token);
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    const dbUser = await this.userService.findByEmail(user.email);
    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }

    return await this.userService.getMyGrants(dbUser.id);
  }

  @Get('me/requests')
  async getMyRequests(@Headers('authorization') authHeader?: string) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await this.authService.me(token);
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    const dbUser = await this.userService.findByEmail(user.email);
    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }

    return await this.userService.getMyRequests(dbUser.id);
  }
}
