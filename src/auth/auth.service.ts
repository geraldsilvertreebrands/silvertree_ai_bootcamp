import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../identity/entities/user.entity';

type Role = 'admin' | 'owner' | 'manager' | 'user';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  private getRoleFromEmail(email: string): Role {
    const emailLower = email.toLowerCase();
    // System owners based on email patterns
    if (emailLower === 'john.smith@silvertreebrands.com' || emailLower.includes('owner')) {
      return 'owner';
    }
    // Managers based on email patterns
    if (emailLower.includes('manager') || emailLower === 'sarah.johnson@silvertreebrands.com' || emailLower === 'david.vanniekerk@silvertreebrands.com') {
      return 'manager';
    }
    // Admins
    if (emailLower.includes('admin')) {
      return 'admin';
    }
    return 'user';
  }

  async login(loginData: { email: string }) {
    // Find user in database - no password required for demo
    // Trim and lowercase email for matching
    const emailLower = loginData.email.trim().toLowerCase();
    
    // Try to find user including soft-deleted ones
    let user = await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: emailLower })
      .withDeleted() // Include soft-deleted users
      .getOne();

    // If not found, try case-insensitive search
    if (!user) {
      const users = await this.userRepository
        .createQueryBuilder('user')
        .withDeleted()
        .getMany();
      const foundUser = users.find(
        (u) => u.email.toLowerCase() === emailLower
      );
      
      if (!foundUser) {
        throw new UnauthorizedException('User not found');
      }
      
      // If user was soft-deleted, restore them
      if (foundUser.deletedAt) {
        await this.userRepository.restore(foundUser.id);
        foundUser.deletedAt = null;
      }
      
      return this.createLoginResponse(foundUser);
    }

    // If user was soft-deleted, restore them
    if (user.deletedAt) {
      await this.userRepository.restore(user.id);
      user.deletedAt = null;
    }

    return this.createLoginResponse(user);
  }

  private createLoginResponse(user: User) {
    const role = this.getRoleFromEmail(user.email);
    const token = Buffer.from(user.email).toString('base64');

    return {
      token,
      email: user.email,
      name: user.name,
      role,
      id: user.id,
    };
  }

  async me(token?: string) {
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    const email = Buffer.from(token, 'base64').toString('utf8');
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: email.toLowerCase() })
      .withDeleted() // Include soft-deleted users
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    // If user was soft-deleted, restore them
    if (user.deletedAt) {
      await this.userRepository.restore(user.id);
      user.deletedAt = null;
    }

    const role = this.getRoleFromEmail(user.email);
    return {
      email: user.email,
      name: user.name,
      role,
      id: user.id,
    };
  }
}

