import { IFileStorage, UploadTarget } from '@common/storage'

import { TAXONOMY_IMAGE_POLICIES } from '../../../constants'
import {
    CreateTaxonomyImageUploadCommand, ICreateTaxonomyImageUpload,
} from '../../../interfaces'

export default class CreateTaxonomyImageUploadUseCase implements ICreateTaxonomyImageUpload {
    constructor(private readonly storage: IFileStorage) {}

    execute(command: CreateTaxonomyImageUploadCommand): Promise<UploadTarget> {
        return this.storage.createUploadTarget(TAXONOMY_IMAGE_POLICIES[command.purpose], command)
    }
}