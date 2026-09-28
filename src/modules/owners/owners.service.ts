import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Owner } from './entities/owner.model';
import type { UpdateOwnerDto } from './dto/update-owner.dto';

/** The password hash never leaves this service. */
const PUBLIC_FIELDS = [
  'id', 'email', 'name', 'phone', 'company', 'address',
  'photoKey', 'photoUrl', 'plan', 'electricityRate', 'createdAt', 'updatedAt',
] as const;

@Injectable()
export class OwnersService {
  constructor(@InjectModel(Owner) private readonly owners: typeof Owner) {}

  async profile(ownerId: string) {
    const owner = await this.owners.findByPk(ownerId, {
      attributes: [...PUBLIC_FIELDS],
    });
    if (!owner) throw new NotFoundException('Account not found');
    return owner;
  }

  async update(ownerId: string, dto: UpdateOwnerDto) {
    const owner = await this.owners.findByPk(ownerId);
    if (!owner) throw new NotFoundException('Account not found');
    await owner.update(dto);
    return this.profile(ownerId);
  }
}
