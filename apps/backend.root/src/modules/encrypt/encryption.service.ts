import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits

  constructor(private readonly configService: ConfigService) {
    // Fail fast on startup: without a key, stored IMAP passwords would be
    // encrypted with a publicly known default and unrecoverable after a key change.
    if (!this.configService.get<string>('APP_PASSWORD_ENCRYPTION_KEY')) {
      throw new Error(
        'APP_PASSWORD_ENCRYPTION_KEY is not set. Add it to your .env file (see .env.example) before starting the backend.'
      );
    }
  }

  async encryptPassword(password: string): Promise<string> {
    const key = this.getEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  async decryptPassword(encryptedPassword: string): Promise<string> {
    // Handle legacy plain text passwords
    if (!encryptedPassword.includes(':')) {
      return encryptedPassword;
    }

    const parts = encryptedPassword.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted password format');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const key = this.getEncryptionKey();

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(this.algorithm, key, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private getEncryptionKey(): Buffer {
    const keyString = this.configService.get<string>(
      'APP_PASSWORD_ENCRYPTION_KEY'
    );

    if (!keyString) {
      throw new Error('APP_PASSWORD_ENCRYPTION_KEY is not set');
    }

    return scryptSync(keyString, 'salt', this.keyLength);
  }
}
