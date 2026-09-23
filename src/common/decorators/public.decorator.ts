import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opens a route to unauthenticated callers.
 *
 * Authentication is global, so every route is closed unless it says otherwise.
 * That way forgetting a guard cannot expose an endpoint — the failure mode is a
 * locked door, not an open one.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
