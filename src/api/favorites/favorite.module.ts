import { Module } from '@nestjs/common'

import { SessionModule } from '@api/session'
import { DatabaseModule } from '@common/db'
import { FAVORITE_PRODUCT_CATALOG, FAVORITE_REPOSITORY, GET_RECENT_FAVORITE_COUNTS } from '@common/di'
import { ProductModule } from '@api/product/product.module'

import {
    FavoriteRepository,
    FavoritesUseCaseProviders,
    ProductFavoriteCatalog,
} from './infrastructure'
import { FavoritesController } from './presentation'

@Module({
    imports: [DatabaseModule, SessionModule, ProductModule],
    controllers: [FavoritesController],
    providers: [
        { provide: FAVORITE_REPOSITORY, useClass: FavoriteRepository },
        { provide: FAVORITE_PRODUCT_CATALOG, useClass: ProductFavoriteCatalog },
        ...FavoritesUseCaseProviders,
    ],
    exports: [GET_RECENT_FAVORITE_COUNTS],
})
export class FavoritesModule {}