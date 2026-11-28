import {afterAll, beforeAll} from '@jest/globals'
import {PGlite} from '@electric-sql/pglite'
import {sql} from 'drizzle-orm'

import {destroyTestContext, testContextE2e} from '../specs/test-context.e2e'
import { DATABASE, DATABASE_CLIENT} from '@common/di'
import {Database} from '@common/db'

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

const clearDb = async (exclude: readonly string[] = []) => {
    const excluded = new Set(exclude)

    const result = await db.execute<{ tablename: string }>(sql`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    `)
    const rows = Array.isArray(result) ? result : result?.['rows']
    const tables = rows
        .map((r) => r.tablename)
        .filter((name) => !excluded.has(name))
        .map((name) => `"${name.replace(/"/g, '""')}"`)

    if (tables.length === 0) return

    await db.execute(sql.raw(`TRUNCATE TABLE ${tables.join(', ')} CASCADE`))
}
