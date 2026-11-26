import { IReviewRepository } from '@api/review/domain'

import { decodeReviewCursor, toPage } from '../../helpers'
import { AdminListReviewsCommand, AdminReviewPage, IAdminListReviews } from '../../interfaces'

export default class AdminListReviewsUseCase implements IAdminListReviews {
  constructor(private readonly reviews: IReviewRepository) {}

  async execute(command: AdminListReviewsCommand): Promise<AdminReviewPage> {
    const rows = await this.reviews.list({
      productId: command.productId,
      rating: command.rating,
      hasReply: command.hasReply,
      cursor: decodeReviewCursor(command.cursor),
      limit: command.pageSize + 1,
    })
    return toPage(rows, command.pageSize)
  }
}
