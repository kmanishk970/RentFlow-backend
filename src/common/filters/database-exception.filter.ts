import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  BaseError,
  DatabaseError,
  UniqueConstraintError,
  ValidationError,
} from 'sequelize';

/**
 * Turns database rejections into honest HTTP responses.
 *
 * The schema enforces rules the application never checks twice — no
 * overlapping leases, one primary per lease, one bill per month. Without this
 * filter every one of them surfaces as a 500 and reads like a server fault,
 * when in fact the request was refused for a reason the caller can act on.
 */

/** Postgres error codes worth translating. */
const UNIQUE_VIOLATION = '23505';
const EXCLUSION_VIOLATION = '23P01';
const CHECK_VIOLATION = '23514';
const FOREIGN_KEY_VIOLATION = '23503';
const NOT_NULL_VIOLATION = '23502';

/**
 * Constraint names mapped to what a person should be told. The names come from
 * src/database/sql/0001_init.sql and are stable.
 */
const MESSAGES: Record<string, string> = {
  leases_no_overlap_per_unit:
    'That unit is already let over those dates. End the existing lease first, or change the term.',
  lease_occupants_one_primary_per_lease:
    'This lease already has a primary tenant. Move the current one out, or use the change-primary endpoint.',
  lease_occupants_lease_id_person_id_key:
    'That person is already recorded on this lease.',
  bills_lease_id_period_key:
    'That month is already billed. Update the existing bill rather than raising a second one.',
  bills_period_is_month_start:
    'A bill covers a whole month, so its period must be the first of that month.',
  payments_period_is_month_start:
    'A payment is set against a whole month, so its period must be the first of that month.',
  bill_lines_meter_counts_up:
    'The closing meter reading is below the opening one. A meter counts up — if it was replaced, bill that month as a flat amount.',
  bill_lines_metered_has_working:
    'A metered charge needs both readings and a rate.',
  bill_lines_electricity_has_mode:
    'An electricity charge must say whether it is metered or flat.',
  lease_occupants_member_has_relation:
    'A household member needs a relation to the primary tenant.',
  lease_occupants_other_is_spelled_out:
    'When the relation is "other", say what it is.',
  owners_email_key: 'An account already exists with that email address.',
  owners_email_lowercase: 'Email addresses are stored in lower case.',
  people_owner_id_document_key:
    'Somebody is already on file with that ID number.',
  units_property_id_number_key:
    'That unit number is already used in this property.',
  floors_property_id_level_key:
    'That floor already exists in this property.',
  meter_readings_unit_id_read_on_key:
    'This unit already has a reading on that date.',
  documents_storage_key_key: 'That file has already been recorded.',
  leases_unit_id_fkey:
    'That unit still has a tenancy on it. End the lease before removing the unit — deleting it would take the rent history with it.',
  lease_occupants_person_id_fkey:
    'That person is on a lease. Remove them from it before deleting the record.',
  bill_lines_bill_id_fkey: 'That bill still has charges on it.',
  units_floor_matches_property:
    'That floor is not in this property.',
  floors_id_property_id_key:
    'That floor is not in this property.',
  leases_due_day_range:
    'The rent due day must be between 1 and 28, so every month has it.',
  leases_term_ordered: 'A lease must end after it starts.',
  payments_amount_positive: 'A payment must be more than zero.',
};

interface PostgresError {
  code?: string;
  constraint?: string;
  detail?: string;
  table?: string;
}

@Catch(BaseError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(error: BaseError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const translated = this.translate(error);

    if (translated.status >= 500) {
      // Only genuine faults are worth a stack trace in the log.
      this.logger.error(error.message, error.stack);
    }

    response.status(translated.status).json({
      statusCode: translated.status,
      message: translated.message,
      error: translated.error,
      ...(translated.constraint ? { constraint: translated.constraint } : {}),
    });
  }

  private translate(error: BaseError): {
    status: number;
    message: string;
    error: string;
    constraint?: string;
  } {
    // Sequelize's own validation runs before the query is sent.
    //
    // UniqueConstraintError extends ValidationError, so it has to be excluded
    // here or it never reaches the constraint table below — and a duplicate ID
    // number comes back as "owner_id must be unique; id_kind must be unique",
    // which is Sequelize listing the index columns, not anything a person can
    // act on.
    if (error instanceof ValidationError && !(error instanceof UniqueConstraintError)) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        message: error.errors.map((e) => e.message).join('; '),
        error: 'Unprocessable Entity',
      };
    }

    const pg = (error as DatabaseError & { original?: PostgresError }).original;
    const constraint = pg?.constraint;
    const known = constraint ? MESSAGES[constraint] : undefined;

    switch (pg?.code) {
      case UNIQUE_VIOLATION:
      case EXCLUSION_VIOLATION:
        return {
          status: HttpStatus.CONFLICT,
          message: known ?? 'That would duplicate a record which must be unique.',
          error: 'Conflict',
          constraint,
        };

      case CHECK_VIOLATION:
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          message: known ?? 'That value is not allowed here.',
          error: 'Unprocessable Entity',
          constraint,
        };

      case FOREIGN_KEY_VIOLATION:
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          message:
            known ??
            'That refers to something which does not exist, or is still in use.',
          error: 'Unprocessable Entity',
          constraint,
        };

      case NOT_NULL_VIOLATION:
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          message: 'A required field was missing.',
          error: 'Unprocessable Entity',
        };

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'The database rejected that request.',
          error: 'Internal Server Error',
        };
    }
  }
}

/** Re-exported so modules can throw these without importing from two places. */
export { ConflictException, UnprocessableEntityException, HttpException };
