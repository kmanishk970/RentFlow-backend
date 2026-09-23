import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { Person } from './entities/person.model';
import type { CreatePersonDto } from './dto/create-person.dto';
import type { UpdatePersonDto } from './dto/update-person.dto';

@Injectable()
export class PeopleService {
  constructor(@InjectModel(Person) private readonly people: typeof Person) {}

  findAll(ownerId: string, search?: string) {
    const where: Record<string, unknown> = { ownerId };
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      where[Op.or as unknown as string] = [
        { fullName: { [Op.iLike]: term } },
        { phone: { [Op.iLike]: term } },
        { email: { [Op.iLike]: term } },
      ];
    }
    return this.people.findAll({ where, order: [['fullName', 'ASC']] });
  }

  async findOne(ownerId: string, id: string) {
    const person = await this.people.findOne({ where: { id, ownerId } });
    if (!person) throw new NotFoundException('Person not found');
    return person;
  }

  create(ownerId: string, dto: CreatePersonDto) {
    return this.people.create({ ...dto, ownerId } as Partial<Person> as Person);
  }

  async update(ownerId: string, id: string, dto: UpdatePersonDto) {
    const person = await this.findOne(ownerId, id);
    return person.update(dto);
  }

  async remove(ownerId: string, id: string) {
    const person = await this.findOne(ownerId, id);
    // A person on a lease is referenced by lease_occupants; the foreign key
    // refuses the delete and the filter turns that into a 422 explaining why.
    await person.destroy();
    return { id };
  }
}
