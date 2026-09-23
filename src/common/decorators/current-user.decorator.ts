import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser } from '../types/authenticated-request';

/**
 * The authenticated owner, straight from the validated token.
 *
 * Every service method takes the owner id from here rather than from the
 * request body or a path parameter — a caller must never be able to name whose
 * data they are reading.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return field ? request.user?.[field] : request.user;
  },
);

/** Shorthand for the id alone, which is what most handlers want. */
export const OwnerId = () => CurrentUser('ownerId');
