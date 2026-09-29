import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';

import { Owner } from '../modules/owners/entities/owner.model';
import { Property } from '../modules/properties/entities/property.model';
import { Floor } from '../modules/properties/entities/floor.model';
import { Unit } from '../modules/properties/entities/unit.model';
import { Person } from '../modules/people/entities/person.model';
import { Lease } from '../modules/leases/entities/lease.model';
import { LeaseOccupant } from '../modules/leases/entities/lease-occupant.model';
import { MeterReading } from '../modules/billing/entities/meter-reading.model';
import { Bill } from '../modules/billing/entities/bill.model';
import { BillLine } from '../modules/billing/entities/bill-line.model';
import { Payment } from '../modules/billing/entities/payment.model';
import { Document } from '../modules/documents/entities/document.model';
import { Notification } from '../modules/notifications/entities/notification.model';

/** Every model, registered once. Feature modules import what they need. */
export const MODELS = [
  Owner,
  Property,
  Floor,
  Unit,
  Person,
  Lease,
  LeaseOccupant,
  MeterReading,
  Bill,
  BillLine,
  Payment,
  Document,
  Notification,
];

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: 'postgres' as const,
        uri: config.getOrThrow<string>('database.url'),
        models: MODELS,
        /**
         * A managed Postgres refuses an unencrypted connection, and the
         * certificate it presents is signed by a chain node does not carry —
         * so verification is off while encryption stays on. Local development
         * talks to a database on the same machine and needs neither.
         *
         * sequelize-cli has the same block in its own config: it runs outside
         * Nest and cannot read this one.
         */
        ...(config.get<string>('nodeEnv') === 'production'
          ? {
              dialectOptions: {
                ssl: { require: true, rejectUnauthorized: false },
              },
            }
          : {}),
        // Never true. The schema comes from the migration in
        // src/database/sql — sync() would quietly drop the check constraints,
        // partial indexes and the exclusion constraint it cannot express.
        synchronize: false,
        autoLoadModels: false,
        logging: config.get<boolean>('database.logging') ? console.log : false,
        pool: { max: 10, min: 0, acquire: 30_000, idle: 10_000 },
        define: { underscored: true, freezeTableName: true },
      }),
    }),
  ],
})
export class DatabaseModule {}
