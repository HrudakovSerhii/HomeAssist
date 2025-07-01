import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ImapService } from '../imap/imap.service';
import { EncryptionService } from '../encrypt/encryption.service';

import * as bcrypt from 'bcryptjs';

export interface CreateUserDto {
  username: string;
  password: string;
  displayName: string;
  email?: string;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface AddEmailAccountDto {
  email: string;
  appPassword: string;
  displayName?: string;
  accountType?: 'GMAIL' | 'OUTLOOK' | 'YAHOO' | 'IMAP_GENERIC';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly imapService: ImapService,
  ) {}

  /**
   * Create a new user account
   */
  async createUser(createUserDto: CreateUserDto) {
    try {
      // Check if username already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { username: createUserDto.username },
      });

      if (existingUser) {
        throw new HttpException('Username already exists', HttpStatus.CONFLICT);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

      // Create user
      const user = await this.prisma.user.create({
        data: {
          username: createUserDto.username,
          password: hashedPassword,
          displayName: createUserDto.displayName,
          email: createUserDto.email,
        },
      });

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      this.logger.log(`Created new user: ${user.username}`);

      return {
        success: true,
        user: userWithoutPassword,
        message: 'User created successfully',
      };
    } catch (error) {
      this.logger.error('Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Authenticate user with username/password
   */
  async login(loginDto: LoginDto) {
    try {
      // Find user
      const user = await this.prisma.user.findUnique({
        where: { username: loginDto.username },
        include: {
          accounts: {
            select: {
              id: true,
              email: true,
              displayName: true,
              accountType: true,
              isActive: true,
              lastSyncAt: true,
            },
          },
        },
      });

      if (!user) {
        throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
      }

      if (!user.isActive) {
        throw new HttpException('Account is disabled', HttpStatus.FORBIDDEN);
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(loginDto.password, user.password);

      if (!isValidPassword) {
        throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
      }

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      // Check if user has any active email accounts
      const hasActiveAccounts = user.accounts.some(account => account.isActive);

      this.logger.log(
        `User logged in: ${user.username} (${hasActiveAccounts} active email accounts)`,
      );

      return {
        hasActiveAccounts,
        success: true,
        user: userWithoutPassword,
        message: 'Login successful',
      };
    } catch (error) {
      this.logger.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Add email account to user
   */
  async addEmailAccount(userId: string, addAccountDto: AddEmailAccountDto) {
    try {
      // Check if email already exists
      const existingAccount = await this.prisma.emailAccount.findUnique({
        where: { email: addAccountDto.email },
      });

      if (existingAccount) {
        throw new HttpException('Email account already exists', HttpStatus.CONFLICT);
      }

      // Test IMAP connection before storing
      const connectionTest = await this.imapService.testConnectionWithCredentials(
        addAccountDto.email,
        addAccountDto.appPassword,
        addAccountDto.accountType || 'GMAIL',
      );

      if (!connectionTest.success) {
        throw new HttpException(
          `IMAP connection test failed: ${connectionTest.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Encrypt the app password before storing
      const encryptedPassword = await this.encryptionService.encryptPassword(
        addAccountDto.appPassword,
      );

      const account = await this.prisma.emailAccount.create({
        data: {
          userId,
          email: addAccountDto.email,
          appPassword: encryptedPassword,
          displayName: addAccountDto.displayName || addAccountDto.email,
          accountType: addAccountDto.accountType || 'GMAIL',
        },
      });

      this.logger.log(
        `Added email account: ${addAccountDto.email} for user ${userId} (IMAP tested successfully)`,
      );

      return {
        success: true,
        account: {
          id: account.id,
          email: account.email,
          displayName: account.displayName,
          accountType: account.accountType,
          isActive: account.isActive,
        },
        connectionStats: connectionTest.stats,
        message: 'Email account added successfully',
      };
    } catch (error) {
      this.logger.error('Failed to add email account:', error);
      throw error;
    }
  }

  /**
   * Get user's email accounts
   */
  async getUserAccounts(userId: string) {
    try {
      const accounts = await this.prisma.emailAccount.findMany({
        where: { userId },
        select: {
          id: true,
          email: true,
          displayName: true,
          accountType: true,
          isActive: true,
          lastSyncAt: true,
          lastProcessedAt: true,
          isCurrentlyProcessing: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return {
        success: true,
        accounts,
        count: accounts.length,
      };
    } catch (error) {
      this.logger.error('Failed to get user accounts:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      return user;
    } catch (error) {
      this.logger.error('Failed to get user:', error);
      throw error;
    }
  }

  /**
   * Deactivate email account
   */
  async deactivateEmailAccount(userId: string, accountId: string) {
    try {
      const account = await this.prisma.emailAccount.findFirst({
        where: { id: accountId, userId },
      });

      if (!account) {
        throw new HttpException('Email account not found', HttpStatus.NOT_FOUND);
      }

      await this.prisma.emailAccount.update({
        where: { id: accountId },
        data: { isActive: false },
      });

      this.logger.log(`Deactivated email account: ${account.email}`);

      return {
        success: true,
        message: 'Email account deactivated',
      };
    } catch (error) {
      this.logger.error('Failed to deactivate email account:', error);
      throw error;
    }
  }
}
