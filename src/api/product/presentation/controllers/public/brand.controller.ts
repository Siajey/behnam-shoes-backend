import {Controller, Get, Inject} from '@nestjs/common'
import {Throttle} from '@nestjs/throttler'

import {IGetPublicBrands} from '@api/product/application'
import {FILE_STORAGE, GET_PUBLIC_BRANDS} from '@common/di'
import {PUBLIC_READ_THROTTLE} from '@common/security'
import {SuccessResponse} from "@common/api";

import {TaxonomyPresenter} from '../../presenters'
import {IFileStorage} from "@common/storage";

@Controller('brands')
@Throttle(PUBLIC_READ_THROTTLE)
export default class BrandController {
    constructor(@Inject(GET_PUBLIC_BRANDS) private readonly getBrands: IGetPublicBrands,
                @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
    ) {
    }

    private readonly urlOf = (key: string) => this.storage.publicUrl(key)

    @Get()
    async listController() {
        const brands = await this.getBrands.execute()
        return new SuccessResponse({
            messageObj: {message: 'common.brand.listSuccess',},
            code: 'BRAND_LIST_SUCCESS',
            path: '/brands',
            data: brands.map(b => TaxonomyPresenter.publicBrand(b, this.urlOf)),
        })
    }
}