import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString, IsEnum, IsNumberString, IsOptional, IsString, IsUUID, Length, Matches,
} from 'class-validator';
import { PaymentMethod } from '../../../common/domain.enums';

export class RecordPaymentDto {
  @ApiProperty()
  @IsUUID('4', { message: 'Pick a lease' })
  leaseId: string;

  @ApiProperty({
    example: '2026-09',
    description: 'The month this money settles. Surplus and shortfall carry forward.',
  })
  @Matches(/^[0-9]{4}-[0-9]{2}(-01)?$/, { message: 'Give the month as YYYY-MM' })
  period: string;

  @ApiProperty({ example: '18620.00' })
  @IsNumberString({}, { message: 'Enter the amount as a number' })
  amount: string;

  @ApiProperty({ example: '2026-09-03' })
  @IsDateString({}, { message: 'Enter the payment date as YYYY-MM-DD' })
  paidOn: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod, { message: 'Pick how it was paid' })
  method: PaymentMethod;

  @ApiPropertyOptional({ example: 'TXN202609001' })
  @IsOptional() @IsString() @Length(0, 60)
  reference?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 500)
  note?: string;
}
