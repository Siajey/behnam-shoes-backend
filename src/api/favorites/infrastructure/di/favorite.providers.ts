import {
    ADD_FAVORITE,
    createProvider,
    FAVORITE_PRODUCT_CATALOG,
    FAVORITE_REPOSITORY,
    LIST_FAVORITE_IDS,
    LIST_FAVORITES,
    MERGE_FAVORITES,
    REMOVE_FAVORITE,
} from '@common/di'

import {
    AddFavoriteUseCase,
    ListFavoriteIdsUseCase,
    ListFavoritesUseCase,
    MergeFavoritesUseCase,
    RemoveFavoriteUseCase,
} from '@api/favorites/application'

const deps = [FAVORITE_REPOSITORY, FAVORITE_PRODUCT_CATALOG]

export const FavoritesUseCaseProviders = [
    createProvider<ListFavoritesUseCase>(LIST_FAVORITES, ListFavoritesUseCase, deps),
    createProvider<ListFavoriteIdsUseCase>(LIST_FAVORITE_IDS, ListFavoriteIdsUseCase, deps),
    createProvider<AddFavoriteUseCase>(ADD_FAVORITE, AddFavoriteUseCase, deps),
    createProvider<RemoveFavoriteUseCase>(REMOVE_FAVORITE, RemoveFavoriteUseCase, [FAVORITE_REPOSITORY]),
    createProvider<MergeFavoritesUseCase>(MERGE_FAVORITES, MergeFavoritesUseCase, deps),
]