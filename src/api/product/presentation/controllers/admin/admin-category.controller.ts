import {Body, Controller, Delete, Get, HttpStatus, Inject, Param, Patch, Post} from '@nestjs/common'

import {
    ICreateCategory, ICreateTaxonomyImageUpload,
    IDeleteCategory,
    IEditCategory,
    IGetPublicCategories,
} from '@api/product/application'
import {User} from '@api/users/domain'
import {ReqUser, AdminOnly, AdminWriteOnly} from '@common/decorator'
import {
    CREATE_CATEGORY, CREATE_TAXONOMY_IMAGE_UPLOAD,
    DELETE_CATEGORY,
    EDIT_CATEGORY, FILE_STORAGE,
    GET_PUBLIC_CATEGORIES,
} from '@common/di'
import {uuidSchema, ZodValidationPipe} from '@common/validations'
import {SuccessResponse} from "@common/api";
import {IFileStorage} from "@common/storage";

import {
    CategoryImageUploadBody,
    CategoryImageUploadSchema,
    CreateCategoryBody,
    CreateCategorySchema,
    EditCategoryBody,
    EditCategorySchema,
} from '../../dtos'
import {ProductPresenter, TaxonomyPresenter} from '../../presenters'


const idPipe = new ZodValidationPipe(uuidSchema)

@Controller('admin/categories')
export default class AdminCategoryController {

    constructor(
        @Inject(GET_PUBLIC_CATEGORIES) private readonly getCategories: IGetPublicCategories,
        @Inject(CREATE_CATEGORY) private readonly createCategory: ICreateCategory,
        @Inject(EDIT_CATEGORY) private readonly editCategory: IEditCategory,
        @Inject(DELETE_CATEGORY) private readonly deleteCategory: IDeleteCategory,
        @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
        @Inject(CREATE_TAXONOMY_IMAGE_UPLOAD) private readonly createImageUpload: ICreateTaxonomyImageUpload,
    ) {
    }

    private readonly urlOf = (key: string) => this.storage.publicUrl(key)


    @AdminOnly()
    @Get()
    async listController() {
        const categories = await this.getCategories.execute()
        return new SuccessResponse({
            messageObj: {message: 'common.category.listSuccess'},
            code: 'CATEGORY_LIST_SUCCESS',
            path: '/admin/categories',
            data: categories.map(c => TaxonomyPresenter.adminCategory(c,this.urlOf)),
        })
    }

    @AdminWriteOnly()
    @Post()
    async createController(
        @Body(new ZodValidationPipe(CreateCategorySchema)) body: CreateCategoryBody,
        @ReqUser() user: User,
    ) {
        const category = await this.createCategory.execute(body, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.category.createSuccess'},
            code: 'CATEGORY_CREATE_SUCCESS',
            path: '/admin/categories',
            status: HttpStatus.CREATED,
            data: TaxonomyPresenter.adminCategory(category,this.urlOf),
        })
    }

    @AdminWriteOnly()
    @Patch(':id')
    async editController(
        @Param('id', idPipe) id: string,
        @Body(new ZodValidationPipe(EditCategorySchema)) body: EditCategoryBody,
        @ReqUser() user: User,
    ) {
        const category = await this.editCategory.execute({id, ...body}, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.category.updateSuccess'},
            code: 'CATEGORY_UPDATE_SUCCESS',
            path: `/admin/categories/${id}`,
            data: TaxonomyPresenter.adminCategory(category,this.urlOf),
        })
    }

    @AdminWriteOnly()
    @Delete(':id')
    async deleteController(@Param('id', idPipe) id: string, @ReqUser() user: User) {
        await this.deleteCategory.execute(id, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.category.deleteSuccess'},
            code: 'CATEGORY_DELETE_SUCCESS',
            path: `/admin/categories/${id}`,
            data: null,
        })
    }

    @Post('images/upload-url')
    @AdminWriteOnly()
    async imageUploadController(
        @Body(new ZodValidationPipe(CategoryImageUploadSchema)) body: CategoryImageUploadBody,
    ) {
        const target = await this.createImageUpload.execute({ purpose: 'category', ...body })
        return new SuccessResponse({
            messageObj: { message: 'common.category.imageUploadUrlSuccess' },
            code: 'CATEGORY_IMAGE_UPLOAD_URL_SUCCESS',
            path: '/admin/categories/images/upload-url',
            status: HttpStatus.CREATED,
            data: ProductPresenter.uploadTarget(target)
        })
    }
}