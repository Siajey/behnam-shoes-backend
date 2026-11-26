import {Inject, Injectable} from '@nestjs/common'
import {and, count, desc, eq, isNotNull, isNull, lt, or, sql} from 'drizzle-orm'

import {
    emptyRatingSummary,
    IReviewRepository,
    RatingSummary,
    Review,
    ReviewListQuery,
    ReviewVersionConflictError,
    roundAverage,
} from '@api/review/domain'
import {Database} from '@common/db'
import {DATABASE} from '@common/di'
import * as schema from '../models'

import {ReviewMapper} from '../mappers'

@Injectable()
export class ReviewRepository implements IReviewRepository {
    constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {
    }

    async findById(id: string): Promise<Review | null> {
        const [row] = await this.db.select().from(schema.reviews).where(eq(schema.reviews.id, id)).limit(1)
        return row ? ReviewMapper.toDomain(row) : null
    }

    async findByUserAndProduct(userId: string, productId: string): Promise<Review | null> {
        const [row] = await this.db
            .select()
            .from(schema.reviews)
            .where(and(eq(schema.reviews.userId, userId), eq(schema.reviews.productId, productId)))
            .limit(1)
        return row ? ReviewMapper.toDomain(row) : null
    }

    async create(review: Review): Promise<boolean> {
        const inserted = await this.db
            .insert(schema.reviews)
            .values(ReviewMapper.toPersistence(review))
            .onConflictDoNothing({target: [schema.reviews.userId, schema.reviews.productId]})
            .returning({id: schema.reviews.id})
        return inserted.length > 0
    }

    async save(review: Review): Promise<void> {
        const {id, version: _version, createdAt: _createdAt, ...rest} = ReviewMapper.toPersistence(review)
        const updated = await this.db
            .update(schema.reviews)
            .set({...rest, version: review.version + 1})
            .where(and(eq(schema.reviews.id, id as string), eq(schema.reviews.version, review.version)))
            .returning({id: schema.reviews.id})
        if (updated.length === 0) throw new ReviewVersionConflictError()
    }

    async delete(id: string): Promise<void> {
        await this.db.delete(schema.reviews).where(eq(schema.reviews.id, id))
    }

    async list(query: ReviewListQuery): Promise<Review[]> {
        const conditions = [
            query.productId ? eq(schema.reviews.productId, query.productId) : undefined,
            query.rating ? eq(schema.reviews.rating, query.rating) : undefined,
            query.hasReply === true ? isNotNull(schema.reviews.replyText) : undefined,
            query.hasReply === false ? isNull(schema.reviews.replyText) : undefined,
            query.cursor
                ? or(
                    lt(schema.reviews.createdAt, query.cursor.createdAt),
                    and(
                        eq(schema.reviews.createdAt, query.cursor.createdAt),
                        lt(schema.reviews.id, query.cursor.id),
                    ),
                )
                : undefined,
        ]

        const rows = await this.db
            .select()
            .from(schema.reviews)
            .where(and(...conditions))
            .orderBy(desc(schema.reviews.createdAt), desc(schema.reviews.id))
            .limit(query.limit)
        return rows.map(ReviewMapper.toDomain)
    }

    async summary(productId: string): Promise<RatingSummary> {
        const rows = await this.db
            .select({rating: schema.reviews.rating, total: count()})
            .from(schema.reviews)
            .where(eq(schema.reviews.productId, productId))
            .groupBy(schema.reviews.rating)

        const summary = emptyRatingSummary()
        let sum = 0
        for (const row of rows) {
            const star = row.rating as 1 | 2 | 3 | 4 | 5
            summary.distribution[star] = row.total
            summary.count += row.total
            sum += row.rating * row.total
        }
        summary.average = summary.count > 0 ? roundAverage(sum / summary.count) : 0
        return summary
    }

    async allSummaries(): Promise<{ productId: string; average: number; count: number }[]> {
        const rows = await this.db
            .select({
                productId: schema.reviews.productId,
                average: sql<string>`avg(
                ${schema.reviews.rating}
                )`,
                total: count(),
            })
            .from(schema.reviews)
            .groupBy(schema.reviews.productId)

        return rows.map((r) => ({productId: r.productId, average: roundAverage(Number(r.average)), count: r.total}))
    }
}
