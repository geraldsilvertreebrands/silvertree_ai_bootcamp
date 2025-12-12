import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../identity/entities/user.entity';
import { AccessRequest } from '../../access-control/entities/access-request.entity';

@Injectable()
export class ManagerGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AccessRequest)
    private readonly accessRequestRepository: Repository<AccessRequest>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] || request.headers['Authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    // Extract token
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    // Get current user from token
    let currentUser;
    try {
      const userInfo = await this.authService.me(token);
      currentUser = await this.userRepository.findOne({
        where: { email: userInfo.email.toLowerCase() },
      });

      if (!currentUser) {
        throw new UnauthorizedException('User not found');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid token');
    }

    // Extract request ID from params
    const requestId = request.params?.id;
    if (!requestId) {
      throw new ForbiddenException('Unable to determine access request from request');
    }

    // Load the access request with target user
    const accessRequest = await this.accessRequestRepository.findOne({
      where: { id: requestId },
      relations: ['targetUser'],
    });

    if (!accessRequest) {
      throw new NotFoundException(`AccessRequest ${requestId} not found`);
    }

    // Check if current user is the manager of the target user
    if (accessRequest.targetUser.managerId !== currentUser.id) {
      throw new ForbiddenException(
        'Only the manager of the grantee can perform this action',
      );
    }

    return true;
  }
}




