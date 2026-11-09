import {Body, Controller, Delete, Get, HttpStatus, Inject, Param, Patch, Post} from '@nestjs/common'

import {
    ICreateCategory,
    IDeleteCategory,
    IEditCategory,
    IGetPublicCategories,
} from '@api/product/application'
import {User} from '@api/users/domain'
import {ReqUser, AdminOnly} from '@common/decorator'
import {
    CREATE_CATEGORY,
    DELETE_CATEGORY,
    EDIT_CATEGORY,
    GET_PUBLIC_CATEGORIES,
} from '@common/di'
import {uuidSchema, ZodValidationPipe} from '@common/validations'

import {
    CreateCategoryBody,
    CreateCategorySchema,
    EditCategoryBody,
    EditCategorySchema,
} from '../../dtos'
import {TaxonomyPresenter} from '../../presenters'
import {SuccessResponse} from "@common/api";

const idPipe = new ZodValidationPipe(uuidSchema)

@Controller('admin/categories')
@AdminOnly()
export default class AdminCategoryController {
    constructor(
        @Inject(GET_PUBLIC_CATEGORIES) private readonly getCategories: IGetPublicCategories,
        @Inject(CREATE_CATEGORY) private readonly createCategory: ICreateCategory,
        @Inject(EDIT_CATEGORY) private readonly editCategory: IEditCategory,
        @Inject(DELETE_CATEGORY) private readonly deleteCategory: IDeleteCategory,
    ) {
    }

    @Get()
    async listController() {
        const categories = await this.getCategories.execute()
        return new SuccessResponse({
            messageObj: {message: 'common.category.listSuccess'},
            code: 'CATEGORY_LIST_SUCCESS',
            path: '/admin/categories',
            data: categories.map(TaxonomyPresenter.adminCategory),
        })
    }

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
            data: TaxonomyPresenter.adminCategory(category),
        })
    }

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
            data: TaxonomyPresenter.adminCategory(category),
        })
    }

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
}