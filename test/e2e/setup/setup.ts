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
    attributeDefinitions, attributeOptions,
    brands,
    categories, productAttributeValues,
    productImages,
    products, productStats,
    shoeProductDetails,
    variantAttributes, variants
} from "@api/product/infrastructure/models"
import {cartItems, carts} from "@api/cart/infrastructure/models";
import {favorites} from "@api/favorites/infrastructure/models";
import {
    couponRedemptions,
    coupons,
    couponTargets,
    discounts,
    discountTargets
} from "@api/discount/infrastructure/models";
import {orderLines, orders, orderStatusEvents} from "@api/order/infrastructure";

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

// const clearDb = async () => {
//     await Promise.all([
//         db.delete(profiles),
//         db.delete(users),
//         db.delete(otpCodes),
//         db.delete(addresses),
//         db.delete(productStats),
//         db.delete(products),
//         db.delete(attributeDefinitions),
//         db.delete(attributeOptions),
//         db.delete(productAttributeValues),
//         db.delete(brands),
//         db.delete(categories),
//         db.delete(productImages),
//         db.delete(shoeProductDetails),
//         db.delete(variantAttributes),
//         db.delete(variants),
//         db.delete(carts),
//         db.delete(cartItems),
//         db.delete(favorites),
//         db.delete(discounts),
//         db.delete(discountTargets),
//         db.delete(couponRedemptions),
//         db.delete(couponTargets),
//         db.delete(coupons),
//         db.delete(orderLines),
//         db.delete(orderStatusEvents),
//         db.delete(orders),
//     ])
// }

const clearDb = async (exclude: readonly string[] = []) => {
    const excluded = new Set(exclude)

    const result = await db.execute<{ tablename: string }>(sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  `)
    console.log(result)

    // const rows = Array.isArray(result) ? result : result.rows
    // const tables = rows
    //     .map((r) => r.tablename)
    //     .filter((name) => !excluded.has(name))
    //     .map((name) => `"${name.replace(/"/g, '""')}"`)
    //
    // if (tables.length === 0) return
    //
    // await db.execute(sql.raw(`TRUNCATE TABLE ${tables.join(', ')} CASCADE`))
}
