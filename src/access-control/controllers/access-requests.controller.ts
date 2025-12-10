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
  ForbiddenException,
  NotFoundException,
  UsePipes,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { AccessRequestService } from '../services/access-request.service';
import { CreateAccessRequestDto } from '../dto/create-access-request.dto';
import { RejectRequestDto } from '../dto/reject-request.dto';
import { BulkProvisionDto } from '../dto/bulk-provision.dto';
import { CopyGrantsDto } from '../dto/copy-grants.dto';
import { AuthService } from '../../auth/auth.service';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../identity/entities/user.entity';
import { Repository } from 'typeorm';
import { ManagerGuard } from '../../common/guards/manager.guard';
import { SystemOwner } from '../../common/decorators/system-owner.decorator';

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

  @Get('pending')
  async findPending(
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

    const requests = await this.accessRequestService.findPendingForManager(user.id);
    return { data: requests };
  }

  @Patch(':id/approve')
  @UseGuards(ManagerGuard)
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
  @UseGuards(ManagerGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async reject(
    @Param('id') id: string,
    @Body() body: RejectRequestDto,
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

    return this.accessRequestService.rejectRequest(id, rejector.id, body.reason);
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

  /**
   * PHASE2-004: System Owner Provisioning
   * Get approved request items pending provisioning for systems owned by current user
   */
  @Get('pending-provisioning')
  async getPendingProvisioning(
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

    const items = await this.accessRequestService.findPendingProvisioning(user.id);
    return { data: items };
  }

  /**
   * PHASE2-004: System Owner Provisioning
   * Provision an approved request item (create active grant)
   * Authorization is checked in the service method
   */
  @Patch('items/:itemId/provision')
  async provisionItem(
    @Param('itemId') itemId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const userInfo = await this.authService.me(token);
    const owner = await this.userRepository.findOne({
      where: { email: userInfo.email.toLowerCase() },
    });
    if (!owner) {
      throw new UnauthorizedException('Owner not found');
    }

    return this.accessRequestService.provisionItem(itemId, owner.id);
  }

  /**
   * PHASE2-004: System Owner Provisioning
   * Bulk provision multiple approved request items
   * Authorization is checked per item in the service method
   */
  @Post('bulk-provision')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async bulkProvision(
    @Body() dto: BulkProvisionDto,
    @Headers('authorization') authHeader?: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const userInfo = await this.authService.me(token);
    const owner = await this.userRepository.findOne({
      where: { email: userInfo.email.toLowerCase() },
    });
    if (!owner) {
      throw new UnauthorizedException('Owner not found');
    }

    return this.accessRequestService.bulkProvision(dto.itemIds, owner.id);
  }

  /**
   * PHASE2-007: Copy grants from one user to another
   */
  @Post('copy-from-user')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async copyFromUser(
    @Body() dto: CopyGrantsDto,
    @Headers('authorization') authHeader?: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const userInfo = await this.authService.me(token);
    const requester = await this.userRepository.findOne({
      where: { email: userInfo.email.toLowerCase() },
    });
    if (!requester) {
      throw new UnauthorizedException('Requester not found');
    }

    // Check authorization: requester must be manager of target user OR admin/owner
    const targetUser = await this.userRepository.findOne({
      where: { id: dto.targetUserId },
      relations: ['manager'],
    });
    if (!targetUser) {
      throw new NotFoundException(`Target user with ID ${dto.targetUserId} not found`);
    }

    const isManager = targetUser.managerId === requester.id;
    const isAdmin = userInfo.role === 'admin' || userInfo.role === 'owner';

    if (!isManager && !isAdmin) {
      throw new ForbiddenException(
        'You are not authorized to copy grants. You must be the manager of the target user or an admin.',
      );
    }

    return this.accessRequestService.copyGrantsFromUser(dto, requester.id);
  }
}

