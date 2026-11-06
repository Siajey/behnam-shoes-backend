import {
    and,
    asc,
    desc,
    eq,
    getTableColumns,
    gt,
    gte,
    lt,
    lte,
    or,
    sql,
    SQL,
} from 'drizzle-orm'
import {PgColumn, PgTable} from 'drizzle-orm/pg-core'

import {ListQuery} from '@common/dto'
import {ValidationError} from '@common/errors'

interface DecodedCursor {
    value: string
    id: string | number
}

export interface VirtualColumn {
    expr: SQL
    dataType: 'string' | 'number' | 'date'
}


export class DrizzleGetItemsQueryBuilder<
    AllowedFilterField extends string,
    SortField extends string,
> {
    readonly where: SQL[] = []
    readonly orderBy: SQL[] = []
    private virtual: Record<string, VirtualColumn> = {}

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
        const payload: DecodedCursor = {value: serialized, id}
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

    private static coerceValue(dataType: string, raw: string): unknown {
        if (dataType === 'date') return new Date(raw)
        if (dataType === 'number') return Number(raw)
        return raw
    }

    private static isCoercedValueInvalid(dataType: string, coerced: unknown): boolean {
        if (dataType === 'date') return Number.isNaN((coerced as Date).getTime())
        if (dataType === 'number') return Number.isNaN(coerced as number)
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

            const target = this.resolve(key)
            if (!target) continue

            const match = String(value).match(/^\[(gt|gte|lt|lte)](.*)$/)
            const coerced = DrizzleGetItemsQueryBuilder.coerceValue(
                target.dataType,
                match ? match[2] : String(value),
            )
            if (DrizzleGetItemsQueryBuilder.isCoercedValueInvalid(target.dataType, coerced)) continue
            if (!(key in this.virtual)) {
                DrizzleGetItemsQueryBuilder.assertEnumValueIsValid(target.expr as unknown as PgColumn, key, coerced)
            }

            const opFn = match ? { gt, gte, lt, lte }[match[1] as 'gt' | 'gte' | 'lt' | 'lte'] : eq
            this.where.push(opFn(target.expr, coerced))
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

            const target = this.resolve(field)
            if (!target) continue

            const dir = direction === 'desc' ? 'desc' : 'asc'
            this.orderBy.push(dir === 'desc' ? desc(target.expr) : asc(target.expr))

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

        const target = this.resolve(this.primarySortField)
        const idColumn = this.columns['id']
        if (!target || !idColumn) return this

        const cursorValue = DrizzleGetItemsQueryBuilder.coerceValue(target.dataType, decoded.value)

        const cursorCondition =
            this.primarySortDirection === 'desc'
                ? or(lt(target.expr, cursorValue), and(eq(target.expr, cursorValue), lt(idColumn, decoded.id)))
                : or(gt(target.expr, cursorValue), and(eq(target.expr, cursorValue), gt(idColumn, decoded.id)))

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


    withVirtualColumns(virtual: Record<string, VirtualColumn>): this {
        this.virtual = virtual
        return this
    }

    get sortField(): string {
        return this.primarySortField
    }

    private resolve(
        field: string,
    ): { expr: SQL; dataType: string; column?: PgColumn } | undefined {
        const virtual = this.virtual[field]

        if (virtual) return virtual

        const column = this.columns[field]

        return column
            ? {
                expr: sql`${column}`,
                dataType: column.dataType,
                column,
            }
            : undefined
    }

}
