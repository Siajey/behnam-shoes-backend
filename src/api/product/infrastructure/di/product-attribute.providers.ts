import {
  ATTRIBUTE_DEFINITION_REPOSITORY, CREATE_ATTRIBUTE, createProvider, DELETE_ATTRIBUTE, EDIT_ATTRIBUTE,
  GET_ATTRIBUTE, GET_PRODUCT_ATTRIBUTES, LIST_ATTRIBUTES, PRODUCT_ATTRIBUTE_REPOSITORY,
  PRODUCT_REPOSITORY, SET_PRODUCT_ATTRIBUTES,
} from '@common/di'

import {
  CreateAttributeUseCase, DeleteAttributeUseCase, EditAttributeUseCase, GetAttributeUseCase,
  GetProductAttributesUseCase, ListAttributesUseCase, SetProductAttributesUseCase,
} from '../../application'

export const ProductAttributeUseCaseProviders = [
  createProvider<ListAttributesUseCase>(LIST_ATTRIBUTES, ListAttributesUseCase, [ATTRIBUTE_DEFINITION_REPOSITORY]),
  createProvider<GetAttributeUseCase>(GET_ATTRIBUTE, GetAttributeUseCase, [ATTRIBUTE_DEFINITION_REPOSITORY]),
  createProvider<CreateAttributeUseCase>(CREATE_ATTRIBUTE, CreateAttributeUseCase, [ATTRIBUTE_DEFINITION_REPOSITORY]),
  createProvider<EditAttributeUseCase>(EDIT_ATTRIBUTE, EditAttributeUseCase, [ATTRIBUTE_DEFINITION_REPOSITORY]),
  createProvider<DeleteAttributeUseCase>(DELETE_ATTRIBUTE, DeleteAttributeUseCase, [ATTRIBUTE_DEFINITION_REPOSITORY]),
  createProvider<SetProductAttributesUseCase>(SET_PRODUCT_ATTRIBUTES, SetProductAttributesUseCase, [
    PRODUCT_REPOSITORY, ATTRIBUTE_DEFINITION_REPOSITORY, PRODUCT_ATTRIBUTE_REPOSITORY,
  ]),
  createProvider<GetProductAttributesUseCase>(GET_PRODUCT_ATTRIBUTES, GetProductAttributesUseCase, [
    PRODUCT_REPOSITORY, ATTRIBUTE_DEFINITION_REPOSITORY, PRODUCT_ATTRIBUTE_REPOSITORY,
  ]),
]
