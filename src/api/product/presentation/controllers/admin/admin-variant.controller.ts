import {Body, Controller, Get, HttpStatus, Inject, Param, Post, Query} from '@nestjs/common'

import {
    IAttachVariants,
    IListUnassignedVariants,
    IMergeProducts,
    IMoveVariants,
    ISplitProduct,
} from '@api/product/application'
import {User} from '@api/users/domain'
import {ReqUser, AdminOnly} from '@common/decorator'
import {
    ATTACH_VARIANTS,
    LIST_UNASSIGNED_VARIANTS,
    MERGE_PRODUCTS,
    MOVE_VARIANTS,
    SPLIT_PRODUCT,
} from '@common/di'
import {uuidSchema, ZodValidationPipe} from '@common/validations'
import {SuccessResponse} from '@common/api'

import {
    MergeProductsBody,
    MergeProductsSchema,
    SplitProductBody,
    SplitProductSchema,
    UnassignedVariantsQuery,
    UnassignedVariantsQuerySchema,
    VariantIdsBody,
    VariantIdsSchema,
} from '../../dtos'
import {ProductPresenter, VariantPresenter} from '../../presenters'

const idPipe = new ZodValidationPipe(uuidSchema)

@Controller('admin')
@AdminOnly()
export default class AdminVariantController {
    constructor(
        @Inject(LIST_UNASSIGNED_VARIANTS) private readonly listUnassigned: IListUnassignedVariants,
        @Inject(ATTACH_VARIANTS) private readonly attachVariants: IAttachVariants,
        @Inject(MOVE_VARIANTS) private readonly moveVariants: IMoveVariants,
        @Inject(MERGE_PRODUCTS) private readonly mergeProducts: IMergeProducts,
        @Inject(SPLIT_PRODUCT) private readonly splitProduct: ISplitProduct,
    ) {
    }

    @Get('variants/unassigned')
    async unassignedController(
        @Query(new ZodValidationPipe(UnassignedVariantsQuerySchema)) query: UnassignedVariantsQuery,
    ) {
        const page = await this.listUnassigned.execute(query)
        return new SuccessResponse({
            messageObj: {message: 'common.variant.unassignedListSuccess'},
            code: 'VARIANT_UNASSIGNED_LIST_SUCCESS',
            path: '/admin/variants/unassigned',
            data: {items: page.variants.map(VariantPresenter.toAdmin), nextCursor: page.nextCursor},
        })
    }

    @Post('products/:id/variants')
    async attachController(
        @Param('id', idPipe) id: string,
        @Body(new ZodValidationPipe(VariantIdsSchema)) body: VariantIdsBody,
        @ReqUser() user: User,
    ) {
        const view = await this.attachVariants.execute({productId: id, variantIds: body.variantIds}, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.variant.attachSuccess'},
            code: 'VARIANT_ATTACH_SUCCESS',
            path: `/admin/products/${id}/variants`,
            data: ProductPresenter.adminDetail(view),
        })
    }

    @Post('products/:id/variants/move')
    async moveController(
        @Param('id', idPipe) id: string,
        @Body(new ZodValidationPipe(VariantIdsSchema)) body: VariantIdsBody,
        @ReqUser() user: User,
    ) {
        const result = await this.moveVariants.execute(
            {targetProductId: id, variantIds: body.variantIds},
            user.id,
        )
        return new SuccessResponse({
            messageObj: {message: 'common.variant.moveSuccess'},
            code: 'VARIANT_MOVE_SUCCESS',
            path: `/admin/products/${id}/variants/move`,
            data: {
                target: ProductPresenter.adminDetail(result.target),
                unpublishedProductIds: result.unpublishedProductIds,
            },
        })
    }

    @Post('products/:id/merge')
    async mergeController(
        @Param('id', idPipe) id: string,
        @Body(new ZodValidationPipe(MergeProductsSchema)) body: MergeProductsBody,
        @ReqUser() user: User,
    ) {
        const view = await this.mergeProducts.execute(
            {sourceProductId: body.sourceProductId, targetProductId: id},
            user.id,
        )
        return new SuccessResponse({
            messageObj: {message: 'common.product.mergeSuccess'},
            code: 'PRODUCT_MERGE_SUCCESS',
            path: `/admin/products/${id}/merge`,
            data: ProductPresenter.adminDetail(view),
        })
    }

    @Post('products/:id/split')
    async splitController(
        @Param('id', idPipe) id: string,
        @Body(new ZodValidationPipe(SplitProductSchema)) body: SplitProductBody,
        @ReqUser() user: User,
    ) {
        const result = await this.splitProduct.execute({productId: id, ...body}, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.product.splitSuccess'},
            code: 'PRODUCT_SPLIT_SUCCESS',
            path: `/admin/products/${id}/split`,
            status: HttpStatus.CREATED,
            data: {
                source: ProductPresenter.adminDetail(result.source),
                created: ProductPresenter.adminDetail(result.created),
            },
        })
    }
}