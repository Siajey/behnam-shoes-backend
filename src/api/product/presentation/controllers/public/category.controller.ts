import {Controller, Get, Inject} from '@nestjs/common'
import {Throttle} from '@nestjs/throttler'

import {IGetPublicCategories} from '@api/product/application'
import {FILE_STORAGE, GET_PUBLIC_CATEGORIES} from '@common/di'
import {PUBLIC_READ_THROTTLE} from '@common/security'
import {SuccessResponse} from "@common/api";
import {IFileStorage} from "@common/storage";

import {TaxonomyPresenter} from '../../presenters'

@Controller('categories')
@Throttle(PUBLIC_READ_THROTTLE)
export default class CategoryController {
    constructor(
        @Inject(GET_PUBLIC_CATEGORIES) private readonly getCategories: IGetPublicCategories,
        @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
    ) {
    }

    private readonly urlOf = (key: string) => this.storage.publicUrl(key)

    @Get()
    async listController() {
        const categories = await this.getCategories.execute()
        return new SuccessResponse({
            messageObj: {message: 'common.category.listSuccess'},
            code: 'CATEGORY_LIST_SUCCESS',
            path: '/categories',
            data: TaxonomyPresenter.categoryTree(categories, this.urlOf),
        })
    }
}