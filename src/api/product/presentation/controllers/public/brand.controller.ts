import { Controller, Get, Inject } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'

import { IGetPublicBrands } from '@api/product/application'
import { GET_PUBLIC_BRANDS } from '@common/di'
import { PUBLIC_READ_THROTTLE } from '@common/security'
import {SuccessResponse} from "@common/api";

import { TaxonomyPresenter } from '../../presenters'

@Controller('brands')
@Throttle(PUBLIC_READ_THROTTLE)
export default class BrandController {
    constructor(@Inject(GET_PUBLIC_BRANDS) private readonly getBrands: IGetPublicBrands) {}

    @Get()
    async listController() {
        const brands = await this.getBrands.execute()
        return new SuccessResponse({
            messageObj: {message:'common.brand.listSuccess',},
            code: 'BRAND_LIST_SUCCESS',
            path: '/brands',
            data: brands.map(TaxonomyPresenter.publicBrand),
        })
    }
}