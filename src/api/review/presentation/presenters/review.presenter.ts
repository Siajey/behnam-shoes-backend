import { RatingSummary, Review } from '@api/review/domain'

export class ReviewPresenter {
  static summary(s: RatingSummary) {
    return { average: s.average, count: s.count, distribution: s.distribution }
  }

  static reply(r: Review['reply']) {
    return r ? { text: r.text, repliedAt: r.repliedAt.toISOString() } : null
  }

  static item(r: Review) {
    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      authorName: r.displayName,
      isVerifiedPurchase: r.isVerifiedPurchase,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      reply: ReviewPresenter.reply(r.reply),
    }
  }

  static adminItem(r: Review) {
    return {
      ...ReviewPresenter.item(r),
      productId: r.productId,
      userId: r.userId,
      reply: r.reply
        ? { text: r.reply.text, repliedAt: r.reply.repliedAt.toISOString(), repliedBy: r.reply.repliedBy }
        : null,
    }
  }
}
