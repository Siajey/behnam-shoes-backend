import {IReviewRepository, ReviewProductNotFoundError} from '@api/review/domain'

import {decodeReviewCursor, toPage} from '../../helpers'
import {IListProductReviews, ListProductReviewsCommand, ProductReviewsResult,} from '../../interfaces'
import {IReviewProductCatalog} from '../../ports'

export default class ListProductReviewsUseCase implements IListProductReviews {
    constructor(
        private readonly reviews: IReviewRepository,
        private readonly catalog: IReviewProductCatalog,
    ) {
    }

    async execute(command: ListProductReviewsCommand): Promise<ProductReviewsResult> {
        if (!(await this.catalog.isPublished(command.productId))) {
            throw new ReviewProductNotFoundError(command.productId)
        }
        const [summary, rows] = await Promise.all([
            this.reviews.summary(command.productId),
            this.reviews.list({
                productId: command.productId,
                rating: command.rating,
                nextCursor: decodeReviewCursor(command.nextCursor),
                limit: command.pageSize + 1,
            }),
        ])
        return {
            summary,
            ...toPage(rows, command.pageSize)
        }
    }
}
