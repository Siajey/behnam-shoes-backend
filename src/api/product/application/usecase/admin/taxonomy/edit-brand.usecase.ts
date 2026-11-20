import {
    Brand,
    BrandNotFoundError,
    BrandSlugAlreadyExistsError,
    IBrandRepository,
} from '@api/product/domain'
import {ILogger} from '@common/logger'
import {IFileStorage} from "@common/storage";

import {EditBrandInput, IEditBrand} from '../../../interfaces'
import {BRAND_LOGO_UPLOAD_POLICY, BRAND_COVER_UPLOAD_POLICY} from '../../../constants'

export default class EditBrandUseCase implements IEditBrand {
    constructor(
        private readonly brands: IBrandRepository,
        private readonly storage: IFileStorage,
        private readonly logger: ILogger,
    ) {
    }

    async execute(input: EditBrandInput, actorId: string): Promise<Brand> {
        const brand = await this.brands.findById(input.id)
        if (!brand) throw new BrandNotFoundError({id: input.id})

        if (input.slug !== undefined && input.slug !== brand.slug) {
            if (await this.brands.findBySlug(input.slug)) {
                throw new BrandSlugAlreadyExistsError(input.slug)
            }
        }
        if (input.imageKey && input.imageKey !== brand.imageKey) {
            await this.storage.verifyUploaded(BRAND_COVER_UPLOAD_POLICY, input.imageKey)
        }
        if (input.logoKey && input.logoKey !== brand.logoKey) {
            await this.storage.verifyUploaded(BRAND_LOGO_UPLOAD_POLICY, input.logoKey)
        }
        brand.update({
            name: input.name, slug: input.slug, logoKey: input.logoKey, imageKey: input.imageKey,
        })
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