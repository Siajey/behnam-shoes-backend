import { and, asc, desc, eq, getTableColumns, gt, gte, lt, lte, or, SQL } from 'drizzle-orm'
import { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import { ListQuery } from '@common/dto'
import { ValidationError } from '@common/errors'

interface DecodedCursor {
  value: string
  id: string | number
}

export class DrizzleGetItemsQueryBuilder<
  AllowedFilterField extends string,
  SortField extends string,
> {
  readonly where: SQL[] = []
  readonly orderBy: SQL[] = []
  pageSize = 10

  private readonly columns: Record<string, PgColumn>
  private primarySortField: string = 'createdAt'
  private primarySortDirection: 'asc' | 'desc' = 'desc'

  constructor(
    private readonly dto: ListQuery<AllowedFilterField>,
    table: PgTable,
    private readonly allowedFilterFields: readonly AllowedFilterField[],
    private readonly allowedSortFields: readonly SortField[],
    private readonly maxLimit = 100,
  ) {
    this.columns = getTableColumns(table) as Record<string, PgColumn>
  }
  static encodeCursor(value: unknown, id: string | number): string {
    const serialized = value instanceof Date ? value.toISOString() : String(value)
    const payload: DecodedCursor = { value: serialized, id }
    return Buffer.from(JSON.stringify(payload)).toString('base64url')
  }

  static decodeCursor(cursor: string): DecodedCursor | null {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'))
      if (
        typeof parsed?.value !== 'string' ||
        (typeof parsed?.id !== 'string' && typeof parsed?.id !== 'number')
      )
        return null
      return parsed
    } catch {
      return null
    }
  }

  private static coerceValue(column: PgColumn, raw: string): unknown {
    const dataType = column.dataType
    if (dataType === 'date') return new Date(raw)
    if (dataType === 'number') return Number(raw)
    return raw
  }

  private static isCoercedValueInvalid(column: PgColumn, coerced: unknown): boolean {
    if (column.dataType === 'date') return Number.isNaN((coerced as Date).getTime())
    if (column.dataType === 'number') return Number.isNaN(coerced as number)
    return false
  }

  private static assertEnumValueIsValid(column: PgColumn, field: string, value: unknown): void {
    const enumValues = (column as unknown as { enumValues?: string[] }).enumValues
    if (!enumValues?.length) return

    if (!enumValues.includes(value as string)) {
      throw new ValidationError({
        message: `errors.validation.enum.${field}`,
      })
    }
  }

  filter(): this {
    if (!this.dto.filterFields) return this

    for (const [key, value] of Object.entries(this.dto.filterFields)) {
      if (value === undefined || value === null) continue
      if (!this.allowedFilterFields.includes(key as AllowedFilterField)) continue

      const column = this.columns[key]
      if (!column) continue

      const match = String(value).match(/^\[(gt|gte|lt|lte)](.*)$/)
      if (!match) {
        const coerced = DrizzleGetItemsQueryBuilder.coerceValue(column, String(value))
        if (DrizzleGetItemsQueryBuilder.isCoercedValueInvalid(column, coerced)) continue
        DrizzleGetItemsQueryBuilder.assertEnumValueIsValid(column, key, coerced)

        this.where.push(eq(column, coerced))
        continue
      }

      const [, op, raw] = match
      const coerced = DrizzleGetItemsQueryBuilder.coerceValue(column, raw)
      if (DrizzleGetItemsQueryBuilder.isCoercedValueInvalid(column, coerced)) continue
      DrizzleGetItemsQueryBuilder.assertEnumValueIsValid(column, key, coerced)

      const opFn = { gt, gte, lt, lte }[op as 'gt' | 'gte' | 'lt' | 'lte']
      this.where.push(opFn(column, coerced))
    }

    return this
  }

  sort(): this {
    if (!this.dto.sort) {
      this.orderBy.push(desc(this.columns['createdAt']))
      this.primarySortField = 'createdAt'
      this.primarySortDirection = 'desc'
      this.orderBy.push(desc(this.columns['id']))
      return this
    }

    let isFirst = true
    for (const part of this.dto.sort.split(',')) {
      const [field, direction] = part.split(':')
      if (!this.allowedSortFields.includes(field as SortField)) continue

      const column = this.columns[field]
      if (!column) continue

      const dir = direction === 'desc' ? 'desc' : 'asc'
      this.orderBy.push(dir === 'desc' ? desc(column) : asc(column))

      if (isFirst) {
        this.primarySortField = field
        this.primarySortDirection = dir
        isFirst = false
      }
    }

    if (this.orderBy.length === 0) {
      this.orderBy.push(desc(this.columns['createdAt']))
      this.primarySortField = 'createdAt'
      this.primarySortDirection = 'desc'
    }

    this.orderBy.push(
      this.primarySortDirection === 'desc' ? desc(this.columns['id']) : asc(this.columns['id']),
    )

    return this
  }

  cursor(): this {
    if (!this.dto.nextCursor) return this

    const decoded = DrizzleGetItemsQueryBuilder.decodeCursor(this.dto.nextCursor)
    if (!decoded) return this

    const column = this.columns[this.primarySortField]
    const idColumn = this.columns['id']
    if (!column || !idColumn) return this

    const cursorValue = DrizzleGetItemsQueryBuilder.coerceValue(column, decoded.value)

    const cursorCondition =
      this.primarySortDirection === 'desc'
        ? or(lt(column, cursorValue), and(eq(column, cursorValue), lt(idColumn, decoded.id)))
        : or(gt(column, cursorValue), and(eq(column, cursorValue), gt(idColumn, decoded.id)))

    if (cursorCondition) this.where.push(cursorCondition)
    return this
  }

  pagination(): this {
    this.pageSize = Math.min(this.dto.pageSize ?? 10, this.maxLimit)
    return this
  }

  buildWhere() {
    return this?.where?.length ? and(...this.where) : undefined
  }
}
