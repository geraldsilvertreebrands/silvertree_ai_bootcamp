import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
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
  async create(
    @Body() dto: CreateAccessRequestDto,
    @Headers('authorization') authHeader?: string,
  ) {
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

    return this.accessRequestService.create(dto, requester.id);
  }
}

