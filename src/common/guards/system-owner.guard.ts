import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { SystemOwnerService } from '../../ownership/services/system-owner.service';
import { AuthService } from '../../auth/auth.service';
import { SystemInstance } from '../../systems/entities/system-instance.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessGrant } from '../../access-control/entities/access-grant.entity';
import { User } from '../../identity/entities/user.entity';

@Injectable()
export class SystemOwnerGuard implements CanActivate {
  constructor(
    private readonly systemOwnerService: SystemOwnerService,
    private readonly authService: AuthService,
    @InjectRepository(SystemInstance)
    private readonly systemInstanceRepository: Repository<SystemInstance>,
    @InjectRepository(AccessGrant)
    private readonly accessGrantRepository: Repository<AccessGrant>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
      // Look up user by email to get ID
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

    // Extract systemId from request
    const systemId = await this.extractSystemId(request);

    if (!systemId) {
      throw new ForbiddenException('Unable to determine system from request');
    }

    // Check if user is system owner
    const isOwner = await this.checkSystemOwnership(currentUser.id, systemId);

    if (!isOwner) {
      throw new ForbiddenException(
        `You are not authorized to perform this action. You must be a system owner for this system.`,
      );
    }

    return true;
  }

  private async extractSystemId(request: any): Promise<string | null> {
    // Method 1: From systemInstanceId in body (for POST /access-grants)
    if (request.body?.systemInstanceId) {
      const systemInstance = await this.systemInstanceRepository.findOne({
        where: { id: request.body.systemInstanceId },
        relations: ['system'],
      });
      return systemInstance?.systemId || null;
    }

    // Method 2: From grant ID in params (for PATCH /access-grants/:id/status)
    if (request.params?.id) {
      const grant = await this.accessGrantRepository.findOne({
        where: { id: request.params.id },
        relations: ['systemInstance', 'systemInstance.system'],
      });
      return grant?.systemInstance?.systemId || null;
    }

    // Method 3: From bulk grants (for POST /access-grants/bulk)
    if (request.body?.grants && Array.isArray(request.body.grants)) {
      // For bulk, we need to check all systems
      // Return first systemId for now, will be checked per grant
      if (request.body.grants.length > 0 && request.body.grants[0].systemInstanceId) {
        const systemInstance = await this.systemInstanceRepository.findOne({
          where: { id: request.body.grants[0].systemInstanceId },
          relations: ['system'],
        });
        return systemInstance?.systemId || null;
      }
    }

    return null;
  }

  private async checkSystemOwnership(userId: string, systemId: string): Promise<boolean> {
    try {
      const owners = await this.systemOwnerService.findByUser(userId);
      return owners.some((owner) => owner.systemId === systemId);
    } catch (error) {
      return false;
    }
  }
}

