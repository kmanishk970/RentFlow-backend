/**
 * Domain enums.
 *
 * These mirror the Postgres enum types created in
 * src/database/sql/0001_init.sql. The database is the authority: adding a value
 * here without a migration will fail on insert, which is the intended direction
 * of that dependency.
 */

export enum IdKind {
  Aadhaar = 'aadhaar',
  Pan = 'pan',
  Passport = 'passport',
  VoterId = 'voter_id',
  DrivingLicence = 'driving_licence',
}

export enum OccupantRole {
  Primary = 'primary',
  Member = 'member',
}

export enum Relation {
  Wife = 'wife',
  Husband = 'husband',
  Son = 'son',
  Daughter = 'daughter',
  Father = 'father',
  Mother = 'mother',
  Brother = 'brother',
  Sister = 'sister',
  Friend = 'friend',
  Other = 'other',
}

export enum LeaseStatus {
  Draft = 'draft',
  Active = 'active',
  Ended = 'ended',
  Terminated = 'terminated',
}

export enum ChargeKind {
  Rent = 'rent',
  Electricity = 'electricity',
  Water = 'water',
  Maintenance = 'maintenance',
  Parking = 'parking',
  Other = 'other',
}

export enum ElectricityMode {
  Meter = 'meter',
  Flat = 'flat',
}

export enum PaymentMethod {
  BankTransfer = 'bank_transfer',
  Cash = 'cash',
  Upi = 'upi',
  Cheque = 'cheque',
}

export enum DocumentKind {
  Agreement = 'agreement',
  IdProof = 'id_proof',
  PoliceVerification = 'police_verification',
  PropertyDoc = 'property_doc',
  Other = 'other',
}

export enum NotificationKind {
  RentReminder = 'rent_reminder',
  LeaseExpiry = 'lease_expiry',
  TenantUpdate = 'tenant_update',
  DocumentUpdate = 'document_update',
  PaymentReceived = 'payment_received',
}

/**
 * Postgres NUMERIC arrives as a string through node-postgres, and that is left
 * alone on purpose: parsing it to a float is how rounding errors get into a
 * rent ledger. Convert at the edge, with a decimal library or integer paise —
 * never by multiplying a float.
 */
export type Money = string;
