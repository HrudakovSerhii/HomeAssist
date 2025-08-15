import {
  Controller,
  Post,
  Get,
  Body,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  IsString,
  IsOptional,
  MinLength,
  IsEmail,
  IsEnum,
} from 'class-validator';
import { AuthService } from './auth.service';
import { ImapService } from '../imap/imap.service';
import { TemplateService } from '../process-template/template.service';

import type {
  UserAccountsResponse,
  LoginDto as ApiLoginDto,
  CreateUserDto as ApiCreateUserDto,
  AddEmailAccountDto as ApiAddEmailAccountDto,
  TestImapDto as ApiTestImapDto,
} from '@home-assist/api-types';

import { ProcessingScheduleService } from '../processing-schedule/processing-schedule.service';

// DTO classes with validation decorators that match API types
class CreateUserDto implements ApiCreateUserDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  displayName: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}

class LoginDto implements ApiLoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}

class AddEmailAccountDto implements ApiAddEmailAccountDto {
  @IsString()
  userId: string;

  @IsEmail()
  email: string;

  @IsString()
  appPassword: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsEnum(['GMAIL', 'OUTLOOK', 'YAHOO', 'IMAP_GENERIC'])
  @IsOptional()
  accountType?: 'GMAIL' | 'OUTLOOK' | 'YAHOO' | 'IMAP_GENERIC';
}

class TestImapDto implements ApiTestImapDto {
  @IsEmail()
  email: string;

  @IsString()
  appPassword: string;

  @IsEnum(['GMAIL', 'OUTLOOK', 'YAHOO', 'IMAP_GENERIC'])
  @IsOptional()
  accountType?: 'GMAIL' | 'OUTLOOK' | 'YAHOO' | 'IMAP_GENERIC';
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly imapService: ImapService,
    private readonly templateService: TemplateService,
    private readonly scheduleService: ProcessingScheduleService
  ) {}

  /**
   * Create a new user account (Register)
   */
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    try {
      return await this.authService.createUser(createUserDto);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Registration failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Login with username/password
   */
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    try {
      return await this.authService.login(loginDto);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Login failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Add email account to user
   */
  @Post('add-account')
  async addAccount(@Body() addAccountDto: AddEmailAccountDto) {
    try {
      const emailAccount = await this.authService.addEmailAccount(
        addAccountDto.userId,
        addAccountDto
      );

      await this.scheduleService.createDefaultScheduleForNewAccount(
        addAccountDto.userId,
        emailAccount.account.id
      );

      return emailAccount;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to add email account',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Test IMAP connection to Gmail
   */
  @Post('test-imap')
  async testImap(@Body() testDto: TestImapDto) {
    try {
      return await this.imapService.testConnectionWithCredentials(
        testDto.email,
        testDto.appPassword,
        testDto.accountType || 'GMAIL'
      );
    } catch (error) {
      return {
        success: false,
        message: `IMAP connection test failed: ${error.message}`,
      };
    }
  }

  /**
   * Seed default templates
   * Note: This should ideally be protected with admin role in production
   */
  @Get('seed-templates')
  async seedTemplates() {
    try {
      // Add basic protection for production
      if (process.env.NODE_ENV === 'production') {
        throw new HttpException(
          'Template seeding is not allowed in production',
          HttpStatus.FORBIDDEN
        );
      }

      const results = await this.templateService.seedDefaultTemplates();

      // Process results for API response
      const summary = {
        created: results.filter((r) => r.created).length,
        skipped: results.filter((r) => r.skipped).length,
        errors: results.filter((r) => r.error).length,
        details: results,
      };

      return {
        success: summary.errors === 0,
        message: `Template seeding completed: ${summary.created} created, ${summary.skipped} skipped, ${summary.errors} errors`,
        data: summary,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Template seeding failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get user's email accounts
   */
  @Get('accounts')
  async getAccounts(
    @Query('userId') userId: string
  ): Promise<UserAccountsResponse> {
    try {
      if (!userId) {
        throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
      }

      return await this.authService.getUserAccounts(userId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to get user accounts',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
