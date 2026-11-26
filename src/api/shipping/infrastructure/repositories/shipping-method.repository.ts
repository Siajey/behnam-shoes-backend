import { IShippingMethodRepository, ShippingMethod } from '@api/shipping/domain'
import { Inject, Injectable } from '@nestjs/common'
import { asc, eq, SQL } from 'drizzle-orm'

import {  Database } from '@common/db'
import { DATABASE } from '@common/di'

import * as schema from '../models'
import { ShippingMethodMapper } from '../mappers'

@Injectable()
export class ShippingMethodRepository implements IShippingMethodRepository {
  constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {}

  async findById(id: string): Promise<ShippingMethod | null> {
    return (await this.many(eq(schema.shippingMethods.id, id)))[0] ?? null
  }

  async findByCode(code: string): Promise<ShippingMethod | null> {
    return (await this.many(eq(schema.shippingMethods.code, code)))[0] ?? null
  }

  async codeExists(code: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: schema.shippingMethods.id })
      .from(schema.shippingMethods)
      .where(eq(schema.shippingMethods.code, code))
      .limit(1)
    return !!row
  }

  findAll(): Promise<ShippingMethod[]> {
    return this.many(undefined)
  }

  findActive(): Promise<ShippingMethod[]> {
    return this.many(eq(schema.shippingMethods.isActive, true))
  }

  async save(method: ShippingMethod): Promise<void> {
    const { id, ...rest } = ShippingMethodMapper.toPersistence(method)
    await this.db
      .insert(schema.shippingMethods)
      .values({ id, ...rest })
      .onConflictDoUpdate({ target: schema.shippingMethods.id, set: rest })
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(schema.shippingMethods).where(eq(schema.shippingMethods.id, id))
  }

  private async many(condition: SQL | undefined): Promise<ShippingMethod[]> {
    const rows = await this.db
      .select()
      .from(schema.shippingMethods)
      .where(condition)
      .orderBy(asc(schema.shippingMethods.position), asc(schema.shippingMethods.name))
    return rows.map(ShippingMethodMapper.toDomain)
  }
}
