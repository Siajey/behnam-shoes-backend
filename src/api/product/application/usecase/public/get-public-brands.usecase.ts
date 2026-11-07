import { Brand, IBrandRepository } from '@api/product/domain'

import { IGetPublicBrands } from '../../interfaces'

export default class GetPublicBrandsUseCase implements IGetPublicBrands {
    constructor(private readonly brands: IBrandRepository) {}

    execute(): Promise<Brand[]> {
        return this.brands.findAll()
    }
}