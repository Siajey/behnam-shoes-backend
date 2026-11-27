import { Review } from '@api/review/domain'

import { reviews } from '../models'

export class ReviewMapper {
  static toDomain(row: typeof reviews.$inferSelect): Review {
    return Review.restore({
      id: row.id,
      productId: row.productId,
      userId: row.userId,
      rating: row.rating,
      comment: row.comment,
      displayName: row.displayName,
      isVerifiedPurchase: row.isVerifiedPurchase,
      reply:
        row.replyText && row.repliedAt && row.repliedBy
          ? { text: row.replyText, repliedAt: row.repliedAt, repliedBy: row.repliedBy }
          : null,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }

  static toPersistence(r: Review): typeof reviews.$inferInsert {
    return {
      id: r.id,
      productId: r.productId,
      userId: r.userId,
      rating: r.rating,
      comment: r.comment,
      displayName: r.displayName,
      isVerifiedPurchase: r.isVerifiedPurchase,
      replyText: r.reply?.text ?? null,
      repliedAt: r.reply?.repliedAt ?? null,
      repliedBy: r.reply?.repliedBy ?? null,
      version: r.version,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  }
}
