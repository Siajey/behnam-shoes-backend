import {NestFastifyApplication} from '@nestjs/platform-fastify'
import {expect} from '@jest/globals'

import {Favorite, IFavoriteRepository} from '@api/favorites/domain'
import {FAVORITE_REPOSITORY} from '@common/di'

import {Api, qs, randomId} from '../../../util/test.util'

/* Favorites-only helpers. Shared helpers live in test/util/test.util, catalog helpers in ../product. */

export const EMPTY_PAGE = {items: [], nextCursor: null}

export const favoriteRepository = (app: NestFastifyApplication) =>
    app.get<IFavoriteRepository>(FAVORITE_REPOSITORY, {strict: false})

/** PUT /favorites/:id, expects 200 and returns `data`. */
export const putFavorite = async (api: Api, productId: string) => {
    const res = await api.put(`/favorites/${productId}`)
    expect(res.statusCode).toBe(200)
    return res.json().data
}

export const listFavorites = async (api: Api, params: Record<string, any> = {}) => {
    const res = await api.get(`/favorites${qs(params)}`)
    expect(res.statusCode).toBe(200)
    return res.json().data as { items: any[]; nextCursor: string | null }
}

export const favoriteIds = async (api: Api) => {
    const res = await api.get('/favorites/ids')
    expect(res.statusCode).toBe(200)
    return res.json().data.productIds as string[]
}

export const mergeFavorites = (api: Api, productIds: string[]) => api.post('/favorites/merge', {productIds})

/** Stored favorites (published or not), newest first. */
export const storedFavorites = (app: NestFastifyApplication, userId: string) =>
    favoriteRepository(app).listByUserId(userId)

/** Fills the user's favorites with products that do not exist (no FK), to reach the 200 limit cheaply. */
export const fillFavorites = async (app: NestFastifyApplication, userId: string, count: number) => {
    await favoriteRepository(app).add(Array.from({length: count}, () => Favorite.create(userId, randomId())))
}

export const resetFavorites = async (app: NestFastifyApplication, userId: string) => {
    const repo = favoriteRepository(app)
    for (const f of await repo.listByUserId(userId)) await repo.remove(userId, f.productId)
}
