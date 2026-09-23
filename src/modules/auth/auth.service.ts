import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import * as bcrypt from 'bcrypt';

import { Owner } from '../owners/entities/owner.model';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './types/jwt-payload';

/** Cost 12 — a few hundred milliseconds per hash, which is the point. */
const BCRYPT_ROUNDS = 12;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResult extends AuthTokens {
  owner: { id: string; email: string; name: string };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Owner) private readonly owners: typeof Owner,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.owners.findOne({ where: { email: dto.email } });
    if (existing) {
      // Registration is the one place where revealing that an address is taken
      // is unavoidable — the alternative is an account nobody can create.
      throw new ConflictException('An account already exists with that email');
    }

    const owner = await this.owners.create({
      email: dto.email,
      passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      name: dto.name,
      phone: dto.phone ?? null,
      company: dto.company ?? null,
    } as Partial<Owner> as Owner);

    return this.issue(owner);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const owner = await this.owners.findOne({ where: { email: dto.email } });

    // Hash even when there is no such account, so the response time does not
    // tell an attacker which addresses are registered.
    const hash = owner?.passwordHash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const matches = await bcrypt.compare(dto.password, hash);

    if (!owner || !matches) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    return this.issue(owner);
  }

  /**
   * Exchanges a refresh token for a new pair.
   *
   * The refresh token is signed with its own secret, so an access token can
   * never be replayed here and vice versa.
   */
  async refresh(refreshToken: string): Promise<AuthResult> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('That session has expired — sign in again');
    }

    const owner = await this.owners.findByPk(payload.sub);
    if (!owner) throw new UnauthorizedException('This account no longer exists');

    return this.issue(owner);
  }

  private async issue(owner: Owner): Promise<AuthResult> {
    const payload: JwtPayload = { sub: owner.id, email: owner.email };
    const expiresIn = this.config.get<string>('jwt.expiresIn') ?? '15m';

    // @nestjs/jwt types expiresIn as a template-literal union from , so a
    // value read from configuration is a plain string as far as TypeScript is
    // concerned. The cast is at the boundary; jsonwebtoken parses it at runtime.
    const sign = (secret: string, ttl: string) =>
      this.jwt.signAsync(payload, { secret, expiresIn: ttl } as unknown as JwtSignOptions);

    const [accessToken, refreshToken] = await Promise.all([
      sign(this.config.getOrThrow<string>('jwt.secret'), expiresIn),
      sign(
        this.config.getOrThrow<string>('jwt.refreshSecret'),
        this.config.get<string>('jwt.refreshExpiresIn') ?? '30d',
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      owner: { id: owner.id, email: owner.email, name: owner.name },
    };
  }
}
