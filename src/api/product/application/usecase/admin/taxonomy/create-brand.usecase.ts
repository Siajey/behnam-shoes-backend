import { Brand, BrandSlugAlreadyExistsError, IBrandRepository } from '@api/product/domain'
import { ILogger } from '@common/logger'

import { CreateBrandInput, ICreateBrand } from '../../interfaces'

export default class CreateBrandUseCase implements ICreateBrand {
    constructor(
        private readonly brands: IBrandRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(input: CreateBrandInput, actorId: string): Promise<Brand> {
        if (await this.brands.findBySlug(input.slug)) {
            throw new BrandSlugAlreadyExistsError(input.slug)
        }

        const brand = Brand.create(input)
        await this.brands.save(brand)

        void this.logger.info('Brand created', {
            module: 'CreateBrandUseCase',
            operation: 'execute',
            event: 'brand.create',
            userId: actorId,
            resourceId: brand.id,
        })
        return brand
    }
}