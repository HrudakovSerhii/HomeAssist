import { Controller, Post, Get, Body, HttpException, HttpStatus, Query } from '@nestjs/common';
import { IsString, IsOptional, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { ImapService } from '../imap/imap.service';

import type { UserAccountsResponse } from '@home-assist/api-types';

class CreateUserDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  displayName: string;

  @IsString()
  @IsOptional()
  email?: string;
}

class LoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}

class AddEmailAccountDto {
  @IsString()
  userId: string;

  @IsString()
  email: string;

  @IsString()
  appPassword: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  accountType?: 'GMAIL' | 'OUTLOOK' | 'YAHOO' | 'IMAP_GENERIC';
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly imapService: ImapService,
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
        HttpStatus.INTERNAL_SERVER_ERROR,
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
      throw new HttpException(
        'Login failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Add email account to user
   */
  @Post('add-account')
  async addAccount(@Body() addAccountDto: AddEmailAccountDto) {
    try {
      return await this.authService.addEmailAccount(
        addAccountDto.userId,
        addAccountDto,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to add email account',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test IMAP connection to Gmail
   */
  @Post('test-imap')
  async testImap(@Body() testDto: { email: string; appPassword: string; accountType?: string }) {
    try {
      return await this.imapService.testConnectionWithCredentials(
        testDto.email,
        testDto.appPassword,
        testDto.accountType || 'GMAIL',
      );
    } catch (error) {
      return {
        success: false,
        message: `IMAP connection test failed: ${error.message}`,
      };
    }
  }

  /**
   * Get user's email accounts
   */
  @Get('accounts')
  async getAccounts(@Query('userId') userId: string): Promise<UserAccountsResponse> {
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
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
