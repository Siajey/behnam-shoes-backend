import {Body, Controller, Delete, Get, HttpStatus, Inject, Param, Patch, Post} from '@nestjs/common'

import {ICreateBrand, IDeleteBrand, IEditBrand, IGetPublicBrands} from '@api/product/application'
import {User} from '@api/users/domain'
import {ReqUser, AdminOnly, AdminWriteOnly} from '@common/decorator'
import {CREATE_BRAND, DELETE_BRAND, EDIT_BRAND, GET_PUBLIC_BRANDS} from '@common/di'
import {uuidSchema, ZodValidationPipe} from '@common/validations'
import {SuccessResponse} from "@common/api";

import {
    CreateBrandBody,
    CreateBrandSchema,
    EditBrandBody,
    EditBrandSchema,
} from '../../dtos'
import {TaxonomyPresenter} from '../../presenters'

const idPipe = new ZodValidationPipe(uuidSchema)

@Controller('admin/brands')
export default class AdminBrandController {
    constructor(
        @Inject(GET_PUBLIC_BRANDS) private readonly getBrands: IGetPublicBrands,
        @Inject(CREATE_BRAND) private readonly createBrand: ICreateBrand,
        @Inject(EDIT_BRAND) private readonly editBrand: IEditBrand,
        @Inject(DELETE_BRAND) private readonly deleteBrand: IDeleteBrand,
    ) {
    }

    @AdminOnly()
    @Get()
    async listController() {
        const brands = await this.getBrands.execute()
        return new SuccessResponse({
            messageObj: {message: 'common.brand.listSuccess'},
            code: 'BRAND_LIST_SUCCESS',
            path: '/admin/brands',
            data: brands.map(TaxonomyPresenter.adminBrand),
        })
    }

    @AdminWriteOnly()
    @Post()
    async createController(
        @Body(new ZodValidationPipe(CreateBrandSchema)) body: CreateBrandBody,
        @ReqUser() user: User,
    ) {
        const brand = await this.createBrand.execute(body, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.brand.createSuccess'},
            code: 'BRAND_CREATE_SUCCESS',
            path: '/admin/brands',
            status: HttpStatus.CREATED,
            data: TaxonomyPresenter.adminBrand(brand),
        })
    }

    @AdminWriteOnly()
    @Patch(':id')
    async editController(
        @Param('id', idPipe) id: string,
        @Body(new ZodValidationPipe(EditBrandSchema)) body: EditBrandBody,
        @ReqUser() user: User,
    ) {
        const brand = await this.editBrand.execute({id, ...body}, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.brand.updateSuccess'},
            code: 'BRAND_UPDATE_SUCCESS',
            path: `/admin/brands/${id}`,
            data: TaxonomyPresenter.adminBrand(brand),
        })
    }

    @AdminWriteOnly()
    @Delete(':id')
    async deleteController(@Param('id', idPipe) id: string, @ReqUser() user: User) {
        await this.deleteBrand.execute(id, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.brand.deleteSuccess'},
            code: 'BRAND_DELETE_SUCCESS',
            path: `/admin/brands/${id}`,
            data: null,
        })
    }
}