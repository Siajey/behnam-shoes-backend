import { Body, Controller, Get, HttpStatus, Inject, Param, Patch, Post, Put, Query } from '@nestjs/common'


import {
    IAdminGetProductById,
    IAdminListProducts,
    IArchiveProduct,
    ICreateProduct,
    IPublishProduct,
    IUnpublishProduct,
    IUpdateProduct,
    IUpdateProductGallery,
} from '@api/product/application'
import { User } from '@api/users/domain'
import {ReqUser, AdminOnly, AdminWriteOnly} from '@common/decorator'
import {
    ADMIN_GET_PRODUCT_BY_ID,
    ADMIN_LIST_PRODUCTS,
    ARCHIVE_PRODUCT,
    CREATE_PRODUCT,
    PUBLISH_PRODUCT,
    UNPUBLISH_PRODUCT,
    UPDATE_PRODUCT,
    UPDATE_PRODUCT_GALLERY,
} from '@common/di'
import {uuidSchema, ZodValidationPipe } from '@common/validations'
import {SuccessResponse} from "@common/api";

import {
    AdminListProductsQuery,
    AdminListProductsQuerySchema,
    CreateProductBody,
    CreateProductSchema,
    UpdateGalleryBody,
    UpdateGallerySchema,
    UpdateProductBody,
    UpdateProductSchema,
} from '../../dtos'
import { toAdminProductListQuery } from '../../mappers'
import { ProductPresenter } from '../../presenters'

const idPipe = new ZodValidationPipe(uuidSchema)

@Controller('admin/products')
export default class AdminProductController {
    constructor(
        @Inject(ADMIN_LIST_PRODUCTS) private readonly listProducts: IAdminListProducts,
        @Inject(ADMIN_GET_PRODUCT_BY_ID) private readonly getProduct: IAdminGetProductById,
        @Inject(CREATE_PRODUCT) private readonly createProduct: ICreateProduct,
        @Inject(UPDATE_PRODUCT) private readonly updateProduct: IUpdateProduct,
        @Inject(UPDATE_PRODUCT_GALLERY) private readonly updateGallery: IUpdateProductGallery,
        @Inject(PUBLISH_PRODUCT) private readonly publishProduct: IPublishProduct,
        @Inject(UNPUBLISH_PRODUCT) private readonly unpublishProduct: IUnpublishProduct,
        @Inject(ARCHIVE_PRODUCT) private readonly archiveProduct: IArchiveProduct,
    ) {}

    @AdminOnly()
    @Get()
    async listController(
        @Query(new ZodValidationPipe(AdminListProductsQuerySchema)) query: AdminListProductsQuery,
    ) {
        const page = await this.listProducts.execute(toAdminProductListQuery(query))
        return new SuccessResponse({
            messageObj:{ message: 'common.product.listSuccess'},
            code: 'PRODUCT_LIST_SUCCESS',
            path: '/admin/products',
            data: {
                items: page.products.map((v) => ProductPresenter.adminListItem(v)),
                nextCursor: page.nextCursor,
            },
        })
    }

    @AdminOnly()
    @Get(':id')
    async getController(@Param('id', idPipe) id: string) {
        return new SuccessResponse({
            messageObj:{ message: 'common.product.getSuccess'},
            code: 'PRODUCT_GET_SUCCESS',
            path: `/admin/products/${id}`,
            data: ProductPresenter.adminDetail(await this.getProduct.execute(id)),
        })
    }

    @AdminWriteOnly()
    @Post()
    async createController(
        @Body(new ZodValidationPipe(CreateProductSchema)) body: CreateProductBody,
        @ReqUser() user: User,
    ) {
        const view = await this.createProduct.execute(body, user.id)
        return new SuccessResponse({
            messageObj:{ message: 'common.product.createSuccess'},
            code: 'PRODUCT_CREATE_SUCCESS',
            path: '/admin/products',
            status: HttpStatus.CREATED,
            data: ProductPresenter.adminDetail(view),
        })
    }

    @AdminWriteOnly()
    @Patch(':id')
    async updateController(
        @Param('id', idPipe) id: string,
        @Body(new ZodValidationPipe(UpdateProductSchema)) body: UpdateProductBody,
        @ReqUser() user: User,
    ) {
        const view = await this.updateProduct.execute({ id, ...body }, user.id)
        return new SuccessResponse({
            messageObj:{ message: 'common.product.updateSuccess'},
            code: 'PRODUCT_UPDATE_SUCCESS',
            path: `/admin/products/${id}`,
            data: ProductPresenter.adminDetail(view),
        })
    }

    @AdminWriteOnly()
    @Put(':id/gallery')
    async galleryController(
        @Param('id', idPipe) id: string,
        @Body(new ZodValidationPipe(UpdateGallerySchema)) body: UpdateGalleryBody,
        @ReqUser() user: User,
    ) {
        const product = await this.updateGallery.execute({ productId: id, images: body.images }, user.id)
        return new SuccessResponse({
            messageObj:{ message: 'common.product.galleryUpdateSuccess'},
            code: 'PRODUCT_GALLERY_UPDATE_SUCCESS',
            path: `/admin/products/${id}/gallery`,
            data: ProductPresenter.adminProduct(product),
        })
    }

    @AdminWriteOnly()
    @Post(':id/publish')
    async publishController(@Param('id', idPipe) id: string, @ReqUser() user: User) {
        return new SuccessResponse({
            messageObj:{ message: 'common.product.publishSuccess'},
            code: 'PRODUCT_PUBLISH_SUCCESS',
            path: `/admin/products/${id}/publish`,
            data: ProductPresenter.adminProduct(await this.publishProduct.execute(id, user.id)),
        })
    }

    @AdminWriteOnly()
    @Post(':id/unpublish')
    async unpublishController(@Param('id', idPipe) id: string, @ReqUser() user: User) {
        return new SuccessResponse({
            messageObj:{ message: 'common.product.unpublishSuccess'},
            code: 'PRODUCT_UNPUBLISH_SUCCESS',
            path: `/admin/products/${id}/unpublish`,
            data: ProductPresenter.adminProduct(await this.unpublishProduct.execute(id, user.id)),
        })
    }

    @AdminWriteOnly()
    @Post(':id/archive')
    async archiveController(@Param('id', idPipe) id: string, @ReqUser() user: User) {
        return new SuccessResponse({
            messageObj:{ message: 'common.product.archiveSuccess'},
            code: 'PRODUCT_ARCHIVE_SUCCESS',
            path: `/admin/products/${id}/archive`,
            data: ProductPresenter.adminProduct(await this.archiveProduct.execute(id, user.id)),
        })
    }
}