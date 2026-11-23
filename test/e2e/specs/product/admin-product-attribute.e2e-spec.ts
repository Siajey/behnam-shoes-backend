import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    anonymousApi,
    createUserSession,
    expectError,
    expectOk,
    expectValidationError,
    randomId,
} from '../../util/test.util'
import {
    createAttribute,
    createCategory,
    createProduct,
    createPublishedProduct,
    getAdminProduct,
    opt,
    seedVariants,
    setAttributes,
} from './product-test.util'

describe('Product attributes: values (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let anonymous: Api

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        anonymous = anonymousApi(ctx.app)
    })

    const get = async (productId: string) => {
        const res = await admin.get(`/admin/products/${productId}/attributes`)
        expectOk(res, 200, 'PRODUCT_ATTRIBUTES_GET_SUCCESS')
        return res.json().data.attributes as any[]
    }
    const setOk = async (productId: string, values: {key: string; value: unknown}[]) => {
        const res = await setAttributes(admin, productId, values)
        expectOk(res, 200, 'PRODUCT_ATTRIBUTES_UPDATE_SUCCESS')
        return res.json().data.attributes as any[]
    }
    const invalidValue = async (productId: string, values: {key: string; value: unknown}[]) =>
        expectError(await setAttributes(admin, productId, values), 400, 'ATTRIBUTE_INVALID_VALUE')
    const publicAttributes = async (productId: string) =>
        (await anonymous.get(`/products/${productId}`)).json().data.attributes as any[]

    describe('PUT /admin/products/:id/attributes', () => {
        it('stores one value of each type and returns them resolved', async () => {
            const [text, num, flag, single, multi] = await Promise.all([
                createAttribute(admin, {type: 'text', name: 'Origin note', position: 1}),
                createAttribute(admin, {type: 'number', name: 'Weight', unit: 'g', position: 2}),
                createAttribute(admin, {type: 'boolean', name: 'Waterproof', position: 3}),
                createAttribute(admin, {type: 'select', name: 'Country', position: 4, options: [opt('IR', 'Iran'), opt('TR', 'Turkey')]}),
                createAttribute(admin, {type: 'multi_select', name: 'Season', position: 5, options: [opt('winter', 'Winter'), opt('summer', 'Summer'), opt('fall', 'Fall')]}),
            ])
            const product = await createProduct(admin)

            const result = await setOk(product.id, [
                {key: multi.key, value: ['winter', 'fall']},
                {key: single.key, value: 'IR'},
                {key: flag.key, value: true},
                {key: num.key, value: 350.5},
                {key: text.key, value: '  Handmade  '},
            ])

            expect(result.map((a) => a.key)).toEqual([text.key, num.key, flag.key, single.key, multi.key]) // by position
            expect(result[0]).toEqual({key: text.key, name: 'Origin note', type: 'text', unit: null, value: 'Handmade'})
            expect(result[1]).toEqual({key: num.key, name: 'Weight', type: 'number', unit: 'g', value: 350.5})
            expect(result[2].value).toBe(true)
            expect(result[3].value).toEqual({value: 'IR', label: 'Iran'})
            expect([...result[4].value].sort((a: any, b: any) => a.value.localeCompare(b.value))).toEqual([
                {value: 'fall', label: 'Fall'},
                {value: 'winter', label: 'Winter'},
            ])
            expect(await get(product.id)).toEqual(result)
        })

        it('replaces the whole set on every call', async () => {
            const [a, b] = [await createAttribute(admin, {type: 'text'}), await createAttribute(admin, {type: 'number'})]
            const product = await createProduct(admin)
            await setOk(product.id, [{key: a.key, value: 'one'}, {key: b.key, value: 2}])

            expect((await setOk(product.id, [{key: a.key, value: 'changed'}])).map((x) => [x.key, x.value])).toEqual([[a.key, 'changed']])

            expect(await setOk(product.id, [])).toEqual([])
            expect(await get(product.id)).toEqual([])
        })

        it('replaces a select value and keeps a multi-select free of leftovers', async () => {
            const single = await createAttribute(admin, {type: 'select', options: [opt('a'), opt('b')]})
            const multi = await createAttribute(admin, {type: 'multi_select', options: [opt('x'), opt('y'), opt('z')]})
            const product = await createProduct(admin)
            await setOk(product.id, [{key: single.key, value: 'a'}, {key: multi.key, value: ['x', 'y']}])

            const result = await setOk(product.id, [{key: single.key, value: 'b'}, {key: multi.key, value: ['z']}])

            expect(result.find((r) => r.key === single.key).value.value).toBe('b')
            expect(result.find((r) => r.key === multi.key).value.map((o: any) => o.value)).toEqual(['z'])
        })

        it('de-duplicates repeated multi-select values and sorts nothing else', async () => {
            const multi = await createAttribute(admin, {type: 'multi_select', options: [opt('x'), opt('y')]})
            const product = await createProduct(admin)

            const [attr] = await setOk(product.id, [{key: multi.key, value: ['x', 'x', 'y']}])

            expect(attr.value).toHaveLength(2)
        })

        it('accepts the boundaries: 500 characters of text, 20 multi-select options, 100 values', async () => {
            const text = await createAttribute(admin, {type: 'text'})
            const multi = await createAttribute(admin, {type: 'multi_select', options: Array.from({length: 20}, (_, i) => opt(`o${i}`))})
            const product = await createProduct(admin)

            const result = await setOk(product.id, [
                {key: text.key, value: 't'.repeat(500)},
                {key: multi.key, value: Array.from({length: 20}, (_, i) => `o${i}`)},
            ])

            expect(result).toHaveLength(2)
            expect(result[0].value.length + result[1].value.length).toBeGreaterThan(500)
        })

        it('is all-or-nothing: one invalid value leaves the previous values untouched', async () => {
            const [a, b] = [await createAttribute(admin, {type: 'text'}), await createAttribute(admin, {type: 'number'})]
            const product = await createProduct(admin)
            const before = await setOk(product.id, [{key: a.key, value: 'keep me'}])

            await invalidValue(product.id, [{key: a.key, value: 'new'}, {key: b.key, value: 'not a number'}])

            expect(await get(product.id)).toEqual(before)
        })

        it('answers 404 ATTRIBUTE_NOT_FOUND for an unknown key', async () => {
            const product = await createProduct(admin)

            expectError(await setAttributes(admin, product.id, [{key: 'no_such_key', value: 'x'}]), 404, 'ATTRIBUTE_NOT_FOUND')
        })

        it('rejects a repeated key', async () => {
            const a = await createAttribute(admin, {type: 'text'})
            const product = await createProduct(admin)

            await invalidValue(product.id, [{key: a.key, value: 'one'}, {key: a.key, value: 'two'}])
        })

        describe('value type per attribute type', () => {
            const cases: [string, Record<string, unknown>, unknown][] = [
                ['text: a number', {type: 'text'}, 5],
                ['text: an empty string', {type: 'text'}, ''],
                ['text: whitespace only', {type: 'text'}, '   '],
                ['number: a string', {type: 'number'}, '5'],
                ['number: a boolean', {type: 'number'}, true],
                ['boolean: a string', {type: 'boolean'}, 'true'],
                ['boolean: a number', {type: 'boolean'}, 1],
                ['select: an unknown option', {type: 'select', options: [opt('a')]}, 'zzz'],
                ['select: an array', {type: 'select', options: [opt('a')]}, ['a']],
                ['select: a number', {type: 'select', options: [opt('a')]}, 1],
                ['multi_select: a string', {type: 'multi_select', options: [opt('a')]}, 'a'],
                ['multi_select: an empty array', {type: 'multi_select', options: [opt('a')]}, []],
                ['multi_select: an unknown option', {type: 'multi_select', options: [opt('a')]}, ['a', 'zzz']],
            ]

            it.each(cases)('rejects %s', async (_label, definition, value) => {
                const attribute = await createAttribute(admin, definition)
                const product = await createProduct(admin)

                await invalidValue(product.id, [{key: attribute.key, value}])

                expect(await get(product.id)).toEqual([])
            })

            it('rejects an option of another attribute', async () => {
                const [one, two] = [
                    await createAttribute(admin, {type: 'select', options: [opt('only_one')]}),
                    await createAttribute(admin, {type: 'select', options: [opt('only_two')]}),
                ]
                const product = await createProduct(admin)

                await invalidValue(product.id, [{key: two.key, value: 'only_one'}])
                expect((await setAttributes(admin, product.id, [{key: one.key, value: 'only_one'}])).statusCode).toBe(200)
            })

            it('rejects a text longer than 500 characters at the request level', async () => {
                const text = await createAttribute(admin, {type: 'text'})
                const product = await createProduct(admin)

                expectValidationError(await setAttributes(admin, product.id, [{key: text.key, value: 't'.repeat(501)}]))
            })

            it('rejects more than 20 multi-select values at the request level', async () => {
                const multi = await createAttribute(admin, {type: 'multi_select', options: [opt('a')]})
                const product = await createProduct(admin)

                expectValidationError(await setAttributes(admin, product.id, [{key: multi.key, value: Array.from({length: 21}, (_, i) => `o${i}`)}]))
            })
        })

        it.each([
            ['a missing values field', {}],
            ['values that is not an array', {values: 'x'}],
            ['a value without key', {values: [{value: 'x'}]}],
            ['a blank key', {values: [{key: '  ', value: 'x'}]}],
            ['a key over 40 characters', {values: [{key: 'k'.repeat(41), value: 'x'}]}],
            ['a null value', {values: [{key: 'k', value: null}]}],
            ['an object value', {values: [{key: 'k', value: {a: 1}}]}],
            ['an array with non-strings', {values: [{key: 'k', value: [1, 2]}]}],
            ['more than 100 values', {values: Array.from({length: 101}, (_, i) => ({key: `k${i}`, value: 'x'}))}],
        ])('rejects %s', async (_label, body) => {
            const product = await createProduct(admin)

            expectValidationError(await admin.put(`/admin/products/${product.id}/attributes`, body))
        })

        it('answers 404 for an unknown product and 400 for a malformed id', async () => {
            expectError(await setAttributes(admin, randomId(), []), 404, 'PRODUCT_NOT_FOUND')
            expectValidationError(await admin.put('/admin/products/not-a-uuid/attributes', {values: []}))
        })

        it('does not touch the product itself', async () => {
            const attribute = await createAttribute(admin, {type: 'text'})
            const product = await createProduct(admin)

            await setOk(product.id, [{key: attribute.key, value: 'x'}])

            const stored = await getAdminProduct(admin, product.id)
            expect(stored).not.toHaveProperty('attributes') // admin detail does not embed them
            expect(stored.updatedAt).toBe(product.updatedAt)
        })
    })

    describe('GET /admin/products/:id/attributes', () => {
        it('is empty for a product without values and includes hidden attributes', async () => {
            const hidden = await createAttribute(admin, {type: 'text', isVisible: false})
            const product = await createProduct(admin)
            expect(await get(product.id)).toEqual([])

            await setOk(product.id, [{key: hidden.key, value: 'secret'}])

            expect((await get(product.id)).map((a) => a.key)).toEqual([hidden.key])
        })

        it('answers 404 for an unknown product and 400 for a malformed id', async () => {
            expectError(await admin.get(`/admin/products/${randomId()}/attributes`), 404, 'PRODUCT_NOT_FOUND')
            expectValidationError(await admin.get('/admin/products/not-a-uuid/attributes'))
        })
    })

    describe('on the public product', () => {
        const published = async () => {
            const category = await createCategory(admin)
            return createPublishedProduct(ctx.app, admin, {categoryId: category.id, variants: [{}]})
        }

        it('shows the visible attributes in the detail by id and by slug, in position order', async () => {
            const [second, first] = [
                await createAttribute(admin, {type: 'number', name: 'B number', unit: 'cm', position: 2}),
                await createAttribute(admin, {type: 'select', name: 'A country', position: 1, options: [opt('IR', 'Iran')]}),
            ]
            const product = await published()
            await setOk(product.id, [{key: second.key, value: 12}, {key: first.key, value: 'IR'}])

            const byId = await publicAttributes(product.id)
            const bySlug = (await anonymous.get(`/products/slug/${product.slug}`)).json().data.attributes

            expect(byId).toEqual([
                {key: first.key, name: 'A country', type: 'select', unit: null, value: {value: 'IR', label: 'Iran'}},
                {key: second.key, name: 'B number', type: 'number', unit: 'cm', value: 12},
            ])
            expect(bySlug).toEqual(byId)
        })

        it('is an empty list when nothing was set, and is not part of list items', async () => {
            const product = await published()

            expect(await publicAttributes(product.id)).toEqual([])
            const item = (await anonymous.get('/products?pageSize=100')).json().data.items.find((i: any) => i.id === product.id)
            expect(item).not.toHaveProperty('attributes')
        })

        it('hides invisible attributes and shows them again when made visible', async () => {
            const attribute = await createAttribute(admin, {type: 'text'})
            const product = await published()
            await setOk(product.id, [{key: attribute.key, value: 'x'}])
            expect(await publicAttributes(product.id)).toHaveLength(1)

            await admin.patch(`/admin/attributes/${attribute.id}`, {isVisible: false})
            expect(await publicAttributes(product.id)).toEqual([])

            await admin.patch(`/admin/attributes/${attribute.id}`, {isVisible: true})
            expect(await publicAttributes(product.id)).toHaveLength(1)
        })

        it('follows definition edits (name, unit, option labels, position) immediately', async () => {
            const attribute = await createAttribute(admin, {type: 'select', name: 'Old', options: [opt('a', 'Old label')]})
            const product = await published()
            await setOk(product.id, [{key: attribute.key, value: 'a'}])

            await admin.patch(`/admin/attributes/${attribute.id}`, {
                name: 'New',
                unit: 'u',
                options: [{id: attribute.options[0].id, value: 'a', label: 'New label'}],
            })

            expect((await publicAttributes(product.id))[0]).toMatchObject({name: 'New', unit: 'u', value: {value: 'a', label: 'New label'}})
        })

        it('does not show attributes of unpublished products (the detail is 404)', async () => {
            const product = await createProduct(admin)

            expect((await anonymous.get(`/products/${product.id}`)).statusCode).toBe(404)
        })
    })

    describe('definitions that products use', () => {
        it('refuses to remove an option that a product uses (select and multi-select) but allows unused ones', async () => {
            const single = await createAttribute(admin, {type: 'select', options: [opt('a'), opt('b')]})
            const multi = await createAttribute(admin, {type: 'multi_select', options: [opt('x'), opt('y'), opt('z')]})
            const product = await createProduct(admin)
            await setOk(product.id, [{key: single.key, value: 'a'}, {key: multi.key, value: ['x', 'y']}])
            const keepAll = (d: any, skip: string) => d.options.filter((o: any) => o.value !== skip).map((o: any) => ({id: o.id, value: o.value, label: o.label}))

            expectError(await admin.patch(`/admin/attributes/${single.id}`, {options: keepAll(single, 'a')}), 409, 'ATTRIBUTE_OPTION_IN_USE')
            expectError(await admin.patch(`/admin/attributes/${multi.id}`, {options: keepAll(multi, 'y')}), 409, 'ATTRIBUTE_OPTION_IN_USE')
            expect((await admin.patch(`/admin/attributes/${single.id}`, {options: keepAll(single, 'b')})).statusCode).toBe(200)
            expect((await admin.patch(`/admin/attributes/${multi.id}`, {options: keepAll(multi, 'z')})).statusCode).toBe(200)

            // the stored values survived the refused and the accepted edits
            expect((await get(product.id)).length).toBe(2)
        })

        it('refuses to clear all options while a value uses one', async () => {
            const single = await createAttribute(admin, {type: 'select', options: [opt('a')]})
            const product = await createProduct(admin)
            await setOk(product.id, [{key: single.key, value: 'a'}])

            expectError(await admin.patch(`/admin/attributes/${single.id}`, {options: []}), 409, 'ATTRIBUTE_OPTION_IN_USE')
        })

        it('lets an option be removed once no product uses it', async () => {
            const single = await createAttribute(admin, {type: 'select', options: [opt('a'), opt('b')]})
            const product = await createProduct(admin)
            await setOk(product.id, [{key: single.key, value: 'a'}])
            await setOk(product.id, [{key: single.key, value: 'b'}])

            const res = await admin.patch(`/admin/attributes/${single.id}`, {
                options: [{id: single.options[1].id, value: 'b', label: 'b'}],
            })

            expect(res.statusCode).toBe(200)
        })

        it('keeps values of several products independent', async () => {
            const attribute = await createAttribute(admin, {type: 'text'})
            const [one, two] = [await createProduct(admin), await createProduct(admin)]
            await setOk(one.id, [{key: attribute.key, value: 'first'}])
            await setOk(two.id, [{key: attribute.key, value: 'second'}])

            await setOk(one.id, [])

            expect(await get(one.id)).toEqual([])
            expect((await get(two.id))[0].value).toBe('second')
            expectError(await admin.delete(`/admin/attributes/${attribute.id}`), 409, 'ATTRIBUTE_IN_USE')
        })
    })
})