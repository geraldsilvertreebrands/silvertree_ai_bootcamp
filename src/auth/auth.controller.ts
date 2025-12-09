import { Controller, Post, Get, Headers, Query, BadRequestException, Body, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import { NoValidationPipe } from './pipes/no-validation.pipe';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UsePipes(NoValidationPipe) // Bypass all validation
  async login(@Body() body: any) {
    // Extract only email, ignore everything else (including password)
    const email = body?.email;
    
    // Manual validation - just check email exists
    if (!email || typeof email !== 'string' || !email.trim()) {
      throw new BadRequestException('Email is required');
    }
    
    // Call service directly with plain object - no DTO validation
    return this.authService.login({ email: email.trim().toLowerCase() });
  }

  @Get('me')
  async me(@Headers() headers: Record<string, string>, @Query('token') token?: string) {
    const authHeader = headers['authorization'] || headers['Authorization'];
    const bearer = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : undefined;
    return this.authService.me(token || bearer);
  }
}

