import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UnauthorizedException,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { Response } from 'express';
import { AccessGrantService } from '../services/access-grant.service';
import { CsvParserService } from '../services/csv-parser.service';
import { CreateAccessGrantDto } from '../dto/create-access-grant.dto';
import { UpdateAccessGrantStatusDto } from '../dto/update-access-grant-status.dto';
import { BulkCreateAccessGrantsDto } from '../dto/bulk-create-access-grants.dto';
import { BulkRemoveDto } from '../dto/bulk-remove.dto';
import { SystemOwner } from '../../common/decorators/system-owner.decorator';
import { AuthService } from '../../auth/auth.service';
import { User } from '../../identity/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Controller('access-grants')
export class AccessGrantsController {
  constructor(
    private readonly accessGrantService: AccessGrantService,
    private readonly csvParserService: CsvParserService,
    private readonly authService: AuthService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Post()
  @SystemOwner()
  async create(
    @Body() createAccessGrantDto: CreateAccessGrantDto,
    @Headers('authorization') authHeader?: string,
  ) {
    // Extract grantedById from token
    let grantedById: string | undefined;
    if (authHeader) {
      try {
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const userInfo = await this.authService.me(token);
        const user = await this.userRepository.findOne({
          where: { email: userInfo.email.toLowerCase() },
        });
        if (user) {
          grantedById = user.id;
        }
      } catch (error) {
        // Ignore - grantedById will be null
      }
    }

    return await this.accessGrantService.create({
      ...createAccessGrantDto,
      grantedById: grantedById || createAccessGrantDto.grantedById,
    });
  }

  @Patch(':id/status')
  @SystemOwner()
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateAccessGrantStatusDto,
  ) {
    return await this.accessGrantService.updateStatus(id, updateStatusDto);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      // Allow invalid UUIDs through so service can return detailed error messages
      skipMissingProperties: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  )
  async bulkCreate(
    @Body() bulkCreateDto: BulkCreateAccessGrantsDto,
    @Headers('authorization') authHeader?: string,
  ) {
    // Extract grantedById from token
    let grantedById: string | undefined;
    if (authHeader) {
      try {
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const userInfo = await this.authService.me(token);
        const user = await this.userRepository.findOne({
          where: { email: userInfo.email.toLowerCase() },
        });
        if (user) {
          grantedById = user.id;
        }
      } catch (error) {
        // Ignore - grantedById will be null
      }
    }

    // For bulk, authorization is checked per grant in the service
    // No guard needed here - service handles authorization
    return await this.accessGrantService.bulkCreate(bulkCreateDto, grantedById);
  }

  @Post('bulk/csv')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async bulkCreateFromCsv(
    @UploadedFile() file: Express.Multer.File,
    @Headers('authorization') authHeader?: string,
  ) {
    console.log('[CSV Upload] Request received');
    console.log('[CSV Upload] File:', file ? { name: file.originalname, size: file.size, mimetype: file.mimetype } : 'null');
    console.log('[CSV Upload] Auth header:', authHeader ? 'present' : 'missing');

    if (!file) {
      console.error('[CSV Upload] ERROR: No file provided');
      throw new BadRequestException('CSV file is required');
    }

    // Validate file type
    if (!file.mimetype.includes('csv') && !file.originalname.endsWith('.csv')) {
      console.error('[CSV Upload] ERROR: Invalid file type', { mimetype: file.mimetype, name: file.originalname });
      throw new BadRequestException('File must be a CSV file');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      console.error('[CSV Upload] ERROR: File too large', { size: file.size });
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    console.log('[CSV Upload] File validated, parsing CSV...');

    // Parse CSV file
    const fileContent = file.buffer.toString('utf-8');
    console.log('[CSV Upload] File content length:', fileContent.length, 'chars');
    console.log('[CSV Upload] First 200 chars:', fileContent.substring(0, 200));
    
    let csvRows;
    try {
      csvRows = this.csvParserService.parseCsvFile(fileContent);
      console.log('[CSV Upload] Parsed CSV rows:', csvRows.length);
    } catch (error) {
      console.error('[CSV Upload] ERROR: Failed to parse CSV', error);
      throw new BadRequestException(error.message || 'Failed to parse CSV file');
    }

    // Validate maximum rows (1000)
    if (csvRows.length > 1000) {
      console.error('[CSV Upload] ERROR: Too many rows', { count: csvRows.length });
      throw new BadRequestException('CSV file cannot exceed 1000 rows');
    }

    console.log('[CSV Upload] Validating and resolving grants...');
    // Validate and resolve CSV grants
    const { valid, invalid } = await this.csvParserService.validateAndResolveCsvGrants(csvRows);
    console.log('[CSV Upload] Valid grants:', valid.length, 'Invalid grants:', invalid.length);

    // Extract grantedById from token
    let grantedById: string | undefined;
    if (authHeader) {
      try {
        const token = authHeader.replace(/^Bearer\s+/i, '');
        console.log('[CSV Upload] Extracting user from token...');
        const userInfo = await this.authService.me(token);
        console.log('[CSV Upload] User info:', userInfo.email);
        const user = await this.userRepository.findOne({
          where: { email: userInfo.email.toLowerCase() },
        });
        if (user) {
          grantedById = user.id;
          console.log('[CSV Upload] Granted by:', user.id);
        } else {
          console.warn('[CSV Upload] User not found in database:', userInfo.email);
        }
      } catch (error) {
        console.error('[CSV Upload] ERROR: Failed to extract user from token', error);
        // Ignore - grantedById will be null
      }
    }

    console.log('[CSV Upload] Processing', valid.length, 'valid grants...');
    // Process valid grants
    const result = await this.accessGrantService.bulkCreateFromCsv(valid, grantedById);
    console.log('[CSV Upload] Result:', { success: result.success, failed: result.failed, skipped: result.skipped });

    // Add invalid grants to failed results
    invalid.forEach((invalidGrant) => {
      result.results.push({
        row: invalidGrant.row,
        success: false,
        error: invalidGrant.errors?.join('; ') || 'Validation failed',
      });
      result.failed++;
    });

    console.log('[CSV Upload] Returning result with', result.results.length, 'total results');
    return result;
  }

  @Get('bulk/csv/template')
  async downloadCsvTemplate(@Res() res: Response) {
    const csvContent = this.csvParserService.generateCsvTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="access-grants-template.csv"');
    res.send(csvContent);
  }

  /**
   * PHASE2-005: Mark grant for removal
   */
  @Patch(':id/to-remove')
  @SystemOwner()
  async markToRemove(
    @Param('id', ParseUUIDPipe) id: string,
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

    return this.accessGrantService.markToRemove(id, owner.id);
  }

  /**
   * PHASE2-005: Mark grant as removed
   */
  @Patch(':id/remove')
  @SystemOwner()
  async markRemoved(
    @Param('id', ParseUUIDPipe) id: string,
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

    return this.accessGrantService.markRemoved(id, owner.id);
  }

  /**
   * PHASE2-005: Cancel pending removal
   */
  @Patch(':id/cancel-removal')
  @SystemOwner()
  async cancelRemoval(
    @Param('id', ParseUUIDPipe) id: string,
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

    return this.accessGrantService.cancelRemoval(id, owner.id);
  }

  /**
   * PHASE2-005: Get grants pending removal
   */
  @Get('pending-removal')
  async getPendingRemoval(
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

    const grants = await this.accessGrantService.findPendingRemoval(owner.id);
    return { data: grants };
  }

  /**
   * PHASE2-005: Bulk mark grants for removal
   */
  @Post('bulk-to-remove')
  @SystemOwner()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async bulkMarkToRemove(
    @Body() dto: BulkRemoveDto,
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

    return this.accessGrantService.bulkMarkToRemove(dto.grantIds, owner.id);
  }

  /**
   * PHASE2-005: Bulk mark grants as removed
   */
  @Post('bulk-remove')
  @SystemOwner()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async bulkMarkRemoved(
    @Body() dto: BulkRemoveDto,
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

    return this.accessGrantService.bulkMarkRemoved(dto.grantIds, owner.id);
  }
}

