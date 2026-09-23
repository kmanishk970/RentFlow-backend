import type { Request } from 'express';

/** What the JWT strategy puts on the request once a token validates. */
export interface AuthUser {
  ownerId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
