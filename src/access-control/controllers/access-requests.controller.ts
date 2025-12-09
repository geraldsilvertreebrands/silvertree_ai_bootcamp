import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Headers,
  Query,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AccessRequestService } from '../services/access-request.service';
import { CreateAccessRequestDto } from '../dto/create-access-request.dto';
import { AuthService } from '../../auth/auth.service';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../identity/entities/user.entity';
import { Repository } from 'typeorm';

@Controller('access-requests')
export class AccessRequestsController {
  constructor(
    private readonly accessRequestService: AccessRequestService,
    private readonly authService: AuthService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(
    @Body() dto: CreateAccessRequestDto,
    @Headers('authorization') authHeader?: string,
  ) {
    try {
      if (!authHeader) {
        throw new UnauthorizedException('Missing authorization header');
      }
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (!token) {
        throw new UnauthorizedException('Missing token');
      }

      const userInfo = await this.authService.me(token);
      const requester = await this.userRepository.findOne({
        where: { email: userInfo.email.toLowerCase() },
      });
      if (!requester) {
        throw new UnauthorizedException('Requester not found');
      }

      return await this.accessRequestService.create(dto, requester.id);
    } catch (error) {
      console.error('Error creating access request:', error);
      throw error;
    }
  }

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const userInfo = await this.authService.me(token);
    const user = await this.userRepository.findOne({
      where: { email: userInfo.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if user is system owner (owner/admin role)
    const isOwner = userInfo.role === 'owner' || userInfo.role === 'admin';
    
    if (isOwner) {
      // Return requests for systems owned by this user
      const requestStatus = status as any;
      const requests = await this.accessRequestService.findAllForSystemOwner(user.id, requestStatus);
      return { data: requests };
    } else {
      // Return requests for this user (as requester or target)
      const requests = await this.accessRequestService.findAllForUser(user.id, status as any);
      return { data: requests };
    }
  }

  @Patch(':id/approve')
  async approve(
    @Param('id') id: string,
    @Headers('authorization') authHeader?: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const userInfo = await this.authService.me(token);
    const approver = await this.userRepository.findOne({
      where: { email: userInfo.email.toLowerCase() },
    });
    if (!approver) {
      throw new UnauthorizedException('Approver not found');
    }

    return this.accessRequestService.approveRequest(id, approver.id);
  }

  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @Headers('authorization') authHeader?: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const userInfo = await this.authService.me(token);
    const rejector = await this.userRepository.findOne({
      where: { email: userInfo.email.toLowerCase() },
    });
    if (!rejector) {
      throw new UnauthorizedException('Rejector not found');
    }

    return this.accessRequestService.rejectRequest(id, rejector.id);
  }

  @Patch(':id/items/:itemId/approve')
  async approveItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const userInfo = await this.authService.me(token);
    const approver = await this.userRepository.findOne({
      where: { email: userInfo.email.toLowerCase() },
    });
    if (!approver) {
      throw new UnauthorizedException('Approver not found');
    }

    return this.accessRequestService.approveItem(itemId, approver.id);
  }

  @Patch(':id/items/:itemId/reject')
  async rejectItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: { note?: string },
    @Headers('authorization') authHeader?: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const userInfo = await this.authService.me(token);
    const rejector = await this.userRepository.findOne({
      where: { email: userInfo.email.toLowerCase() },
    });
    if (!rejector) {
      throw new UnauthorizedException('Rejector not found');
    }

    return this.accessRequestService.rejectItem(itemId, rejector.id, body.note);
  }
}

