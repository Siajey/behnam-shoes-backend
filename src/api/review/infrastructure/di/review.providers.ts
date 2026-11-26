import {
    ADMIN_DELETE_REVIEW,
    ADMIN_LIST_REVIEWS,
    CREATE_REVIEW,
    createProvider,
    DELETE_MY_REVIEW,
    DELETE_REVIEW_REPLY,
    EDIT_REVIEW,
    GET_MY_PRODUCT_REVIEW,
    LIST_PRODUCT_REVIEWS,
    RATING_REFRESHER,
    RECALCULATE_RATINGS,
    REPLY_TO_REVIEW,
    REVIEW_POLICY,
    REVIEW_PRODUCT_CATALOG,
    REVIEW_PURCHASE_VERIFIER,
    REVIEW_RATING_PUBLISHER,
    REVIEW_REPOSITORY,
} from '@common/di'

import {
    AdminDeleteReviewUseCase,
    AdminListReviewsUseCase,
    CreateReviewUseCase,
    DeleteMyReviewUseCase,
    DeleteReviewReplyUseCase,
    EditReviewUseCase,
    GetMyProductReviewUseCase,
    ListProductReviewsUseCase,
    RatingRefresher,
    RecalculateRatingsUseCase,
    ReplyToReviewUseCase,
} from '@api/review/application'

export const ReviewUseCaseProviders = [
    createProvider<RatingRefresher>(RATING_REFRESHER, RatingRefresher, [
        REVIEW_REPOSITORY, REVIEW_RATING_PUBLISHER,
    ]),
    createProvider<CreateReviewUseCase>(CREATE_REVIEW, CreateReviewUseCase, [
        REVIEW_REPOSITORY, REVIEW_PRODUCT_CATALOG, REVIEW_PURCHASE_VERIFIER, REVIEW_POLICY, RATING_REFRESHER,
    ]),
    createProvider<EditReviewUseCase>(EDIT_REVIEW, EditReviewUseCase, [REVIEW_REPOSITORY, RATING_REFRESHER]),
    createProvider<DeleteMyReviewUseCase>(DELETE_MY_REVIEW, DeleteMyReviewUseCase, [
        REVIEW_REPOSITORY, RATING_REFRESHER,
    ]),
    createProvider<ListProductReviewsUseCase>(LIST_PRODUCT_REVIEWS, ListProductReviewsUseCase, [
        REVIEW_REPOSITORY, REVIEW_PRODUCT_CATALOG,
    ]),
    createProvider<GetMyProductReviewUseCase>(GET_MY_PRODUCT_REVIEW, GetMyProductReviewUseCase, [
        REVIEW_REPOSITORY, REVIEW_PRODUCT_CATALOG, REVIEW_PURCHASE_VERIFIER, REVIEW_POLICY,
    ]),
    createProvider<AdminListReviewsUseCase>(ADMIN_LIST_REVIEWS, AdminListReviewsUseCase, [REVIEW_REPOSITORY]),
    createProvider<AdminDeleteReviewUseCase>(ADMIN_DELETE_REVIEW, AdminDeleteReviewUseCase, [
        REVIEW_REPOSITORY, RATING_REFRESHER,
    ]),
    createProvider<ReplyToReviewUseCase>(REPLY_TO_REVIEW, ReplyToReviewUseCase, [REVIEW_REPOSITORY]),
    createProvider<DeleteReviewReplyUseCase>(DELETE_REVIEW_REPLY, DeleteReviewReplyUseCase, [REVIEW_REPOSITORY]),
    createProvider<RecalculateRatingsUseCase>(RECALCULATE_RATINGS, RecalculateRatingsUseCase, [
        REVIEW_REPOSITORY, REVIEW_RATING_PUBLISHER,
    ]),
]
