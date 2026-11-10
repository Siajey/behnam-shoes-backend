import {afterAll, beforeAll} from '@jest/globals'
import {Cache} from 'cache-manager'
import {PGlite} from '@electric-sql/pglite'
import {sql} from 'drizzle-orm'

import {destroyTestContext, testContextE2e} from '../specs/test-context.e2e'
import {CACHE_MANAGER, DATABASE, DATABASE_CLIENT} from '@common/di'
import {Database} from '@common/db'
import {profiles, users, addresses} from '@api/users/infrastructure'
import {otpCodes} from '@otp/infrastructure'
import {
    brands,
    categories,
    productImages,
    products,
    shoeProductDetails,
    variantAttributes, variants
} from "@api/product/infrastructure/models"

let db: Database<any>
let dbClient: PGlite
beforeAll(async () => {
    const context = await testContextE2e()
    db = context.app.get<Database<any>>(DATABASE)
    dbClient = context.app.get(DATABASE_CLIENT)
    await clearDb()
}, 20000)

afterAll(async () => {
    try {
        const ctx = await testContextE2e()

        const cacheManager = ctx.app.get<Cache>(CACHE_MANAGER)
        await cacheManager.clear()

        if (db) {
            await clearDb()
        }
        await destroyTestContext()
        try {
            await db.execute(sql.raw(`SELECT 1`))
            await dbClient.close()
        } catch {
        }
    } catch (err) {
        console.error(err)
    }
})

const clearDb = async () => {
    await Promise.all([
        db.delete(profiles),
        db.delete(users),
        db.delete(otpCodes),
        db.delete(addresses),
        db.delete(products),
        db.delete(brands),
        db.delete(categories),
        db.delete(productImages),
        db.delete(shoeProductDetails),
        db.delete(variantAttributes),
        db.delete(variants),
    ])
}
