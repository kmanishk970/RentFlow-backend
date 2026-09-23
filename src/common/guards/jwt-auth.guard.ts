import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';

import { Owner } from '../../modules/owners/entities/owner.model';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { JwtPayload } from '../../modules/auth/types/jwt-payload';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Verifies the bearer token and puts the owner on the request.
 *
 * Applied globally, so every route is closed unless it is marked @Public() —
 * forgetting a guard locks a door rather than opening one.
 *
 * Deliberately not Passport. This API has exactly one strategy, and Passport's
 * value is in having several; here it would add an indirection and a
 * dependency that is now ESM-only and cannot be required from CommonJS.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectModel(Owner) private readonly owners: typeof Owner,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.bearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Sign in to continue');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.secret'),
      });
    } catch {
      // Expired and forged get the same answer on purpose — telling them apart
      // is only useful to somebody probing.
      throw new UnauthorizedException('Your session has expired');
    }

    // A valid signature is not enough: the account must still exist, or a token
    // issued before it was deleted would keep working until it expired.
    const owner = await this.owners.findByPk(payload.sub, {
      attributes: ['id', 'email'],
    });
    if (!owner) throw new UnauthorizedException('This account no longer exists');

    request.user = { ownerId: owner.id, email: owner.email };
    return true;
  }

  private bearerToken(header?: string): string | null {
    if (!header) return null;
    const [scheme, token] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }
}
