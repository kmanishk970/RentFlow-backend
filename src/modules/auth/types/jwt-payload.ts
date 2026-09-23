/** What a RentFlow token carries. Kept deliberately thin. */
export interface JwtPayload {
  /** Subject — the owner id. */
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}
