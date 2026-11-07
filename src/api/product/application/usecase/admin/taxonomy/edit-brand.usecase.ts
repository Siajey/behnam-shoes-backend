import {
    Brand,
    BrandNotFoundError,
    BrandSlugAlreadyExistsError,
    IBrandRepository,
} from '@api/product/domain'
import { ILogger } from '@common/logger'

import { EditBrandInput, IEditBrand } from '../../../interfaces'

export default class EditBrandUseCase implements IEditBrand {
    constructor(
        private readonly brands: IBrandRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(input: EditBrandInput, actorId: string): Promise<Brand> {
        const brand = await this.brands.findById(input.id)
        if (!brand) throw new BrandNotFoundError({ id: input.id })

        if (input.slug !== undefined && input.slug !== brand.slug) {
            if (await this.brands.findBySlug(input.slug)) {
                throw new BrandSlugAlreadyExistsError(input.slug)
            }
        }

        brand.update({ name: input.name, slug: input.slug, logoKey: input.logoKey })
        await this.brands.save(brand)

        void this.logger.info('Brand updated', {
            module: 'EditBrandUseCase',
            operation: 'execute',
            event: 'brand.update',
            userId: actorId,
            resourceId: brand.id,
        })
        return brand
    }
}