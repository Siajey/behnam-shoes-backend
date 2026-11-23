import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    anonymousApi,
    apiWithoutCsrf,
    createUserSession,
    expectError,
    expectOk,
    expectValidationError,
    omit,
    randomId,
    sleep,
    uid,
} from '../../util/test.util'
import {attributeBody, createAttribute, createProduct, opt, setAttributes} from './product-test.util'

describe('Admin attributes: definitions (e2e)', () => {
    let ctx: TestContext
    let adminSession: Awaited<ReturnType<typeof createUserSession>>
    let admin: Api

    beforeAll(async () => {
        ctx = await testContextE2e()
        adminSession = await createUserSession(ctx, UserRole.ADMIN)
        admin = adminSession.api
    })

    const invalidDefinition = (res: {statusCode: number; json: () => any}) =>
        expectError(res, 400, 'ATTRIBUTE_INVALID_DEFINITION')

    describe('POST /admin/attributes', () => {
        it('creates a text attribute with defaults', async () => {
            const body = attributeBody()

            const res = await admin.post('/admin/attributes', body)

            expectOk(res, 201, 'ATTRIBUTE_CREATE_SUCCESS')
            expect(res.json().data).toEqual({
                id: expect.any(String),
                key: body.key,
                name: body.name,
                type: 'text',
                productType: null,
                unit: null,
                isVisible: true,
                isFilterable: false,
                position: 0,
                options: [],
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            })
        })

        it.each(['text', 'number', 'boolean', 'select', 'multi_select'])('accepts the type %s', async (type) => {
            const res = await admin.post('/admin/attributes', attributeBody({type}))

            expect(res.statusCode).toBe(201)
            expect(res.json().data.type).toBe(type)
        })

        it('stores every field and numbers the options in the given order', async () => {
            const res = await admin.post(
                '/admin/attributes',
                attributeBody({
                    type: 'select',
                    productType: 'shoe',
                    unit: 'cm',
                    isVisible: false,
                    isFilterable: true,
                    position: 7,
                    options: [opt('IR', 'Iran'), opt('TR', 'Turkey'), opt('IT', 'Italy')],
                }),
            )

            expect(res.statusCode).toBe(201)
            expect(res.json().data).toMatchObject({productType: 'shoe', unit: 'cm', isVisible: false, isFilterable: true, position: 7})
            expect(res.json().data.options).toEqual([
                {id: expect.any(String), value: 'IR', label: 'Iran', position: 0},
                {id: expect.any(String), value: 'TR', label: 'Turkey', position: 1},
                {id: expect.any(String), value: 'IT', label: 'Italy', position: 2},
            ])
        })

        it('accepts unicode letters, digits, underscore and dash in option values', async () => {
            const res = await admin.post(
                '/admin/attributes',
                attributeBody({type: 'multi_select', options: [opt('ایران', 'Iran'), opt('a_b-1', 'x')]}),
            )

            expect(res.statusCode).toBe(201)
        })

        it('trims the key and persists the attribute', async () => {
            const key = `trim_${uid()}`

            const res = await admin.post('/admin/attributes', attributeBody({key: `  ${key}  `}))

            expect(res.json().data.key).toBe(key)
            expect((await admin.get(`/admin/attributes/${res.json().data.id}`)).json().data).toEqual(res.json().data)
        })

        it('rejects a duplicate key', async () => {
            const existing = await createAttribute(admin)

            expectError(await admin.post('/admin/attributes', attributeBody({key: existing.key})), 409, 'ATTRIBUTE_KEY_ALREADY_EXISTS')
        })

        const base = () => attributeBody({type: 'select'})
        const invalidBodies: [string, () => Record<string, unknown>][] = [
            ['a missing key', () => omit(base(), 'key')],
            ['an upper-case key', () => ({...base(), key: 'Country'})],
            ['a key starting with a digit', () => ({...base(), key: '1country'})],
            ['a one-character key', () => ({...base(), key: 'a'})],
            ['a key with a dash', () => ({...base(), key: 'my-key'})],
            ['a key over 40 characters', () => ({...base(), key: `a${'b'.repeat(40)}`})],
            ['a Persian key', () => ({...base(), key: '\u06A9\u0634\u0648\u0631'})],
            ['a missing name', () => omit(base(), 'name')],
            ['a blank name', () => ({...base(), name: '  '})],
            ['a name over 100 chars', () => ({...base(), name: 'n'.repeat(101)})],
            ['a missing type', () => omit(base(), 'type')],
            ['an unknown type', () => ({...base(), type: 'date'})],
            ['an unknown productType', () => ({...base(), productType: 'boat'})],
            ['an empty unit', () => ({...base(), unit: ''})],
            ['a unit over 20 chars', () => ({...base(), unit: 'u'.repeat(21)})],
            ['a non-boolean isVisible', () => ({...base(), isVisible: 'yes'})],
            ['a non-boolean isFilterable', () => ({...base(), isFilterable: 1})],
            ['a negative position', () => ({...base(), position: -1})],
            ['a fractional position', () => ({...base(), position: 1.5})],
            ['options that is not an array', () => ({...base(), options: 'IR'})],
            ['an option without value', () => ({...base(), options: [{label: 'x'}]})],
            ['an option without label', () => ({...base(), options: [{value: 'x'}]})],
            ['an empty option value', () => ({...base(), options: [opt('')]})],
            ['an option value over 50 chars', () => ({...base(), options: [opt('v'.repeat(51), 'x')]})],
            ['an option label over 100 chars', () => ({...base(), options: [opt('v', 'l'.repeat(101))]})],
            ['more than 200 options', () => ({...base(), options: Array.from({length: 201}, (_, i) => opt(`v${i}`))})],
        ]

        it.each(invalidBodies)('rejects %s', async (_label, build) => {
            expectValidationError(await admin.post('/admin/attributes', build()))
        })

        it('accepts exactly 200 options', async () => {
            const options = Array.from({length: 200}, (_, i) => opt(`v${i}`))

            const res = await admin.post('/admin/attributes', attributeBody({type: 'select', options}))

            expect(res.statusCode).toBe(201)
            expect(res.json().data.options).toHaveLength(200)
        })

        it.each([
            ['options on a text attribute', {type: 'text', options: [opt('a')]}],
            ['options on a number attribute', {type: 'number', options: [opt('a')]}],
            ['options on a boolean attribute', {type: 'boolean', options: [opt('a')]}],
            ['an option value with a space', {type: 'select', options: [opt('a b', 'x')]}],
            ['an option value with a dot', {type: 'select', options: [opt('a.b', 'x')]}],
            ['duplicate option values', {type: 'select', options: [opt('a', 'one'), opt('a', 'two')]}],
            ['a filterable text attribute', {type: 'text', isFilterable: true}],
        ])('rejects %s with ATTRIBUTE_INVALID_DEFINITION', async (_label, overrides) => {
            invalidDefinition(await admin.post('/admin/attributes', attributeBody(overrides)))
        })

        it.each(['number', 'boolean', 'select', 'multi_select'])('accepts a filterable %s attribute', async (type) => {
            const res = await admin.post('/admin/attributes', attributeBody({type, isFilterable: true}))

            expect(res.statusCode).toBe(201)
        })
    })

    describe('GET /admin/attributes', () => {
        it('lists definitions ordered by position then name, with options', async () => {
            const tag = uid()
            const late = await createAttribute(admin, {name: `${tag} Zeta`, position: 2})
            const second = await createAttribute(admin, {name: `${tag} B`, position: 1})
            const first = await createAttribute(admin, {name: `${tag} A`, position: 1, type: 'select', options: [opt('x')]})

            const res = await admin.get('/admin/attributes')

            expectOk(res, 200, 'ATTRIBUTE_LIST_SUCCESS')
            const mine = (res.json().data as any[]).filter((a) => a.name.startsWith(tag))
            expect(mine.map((a) => a.id)).toEqual([first.id, second.id, late.id])
            expect(mine[0].options).toHaveLength(1)
        })
    })

    describe('GET /admin/attributes/:id', () => {
        it('returns a definition', async () => {
            const attribute = await createAttribute(admin, {type: 'select', options: [opt('a'), opt('b')]})

            const res = await admin.get(`/admin/attributes/${attribute.id}`)

            expectOk(res, 200, 'ATTRIBUTE_GET_SUCCESS')
            expect(res.json().data).toEqual(attribute)
        })

        it('answers 404 for an unknown id and 400 for a malformed one', async () => {
            expectError(await admin.get(`/admin/attributes/${randomId()}`), 404, 'ATTRIBUTE_NOT_FOUND')
            expectValidationError(await admin.get('/admin/attributes/not-a-uuid'))
        })
    })

    describe('PATCH /admin/attributes/:id', () => {
        it('updates name, unit, flags and position independently', async () => {
            const attribute = await createAttribute(admin, {type: 'number'})

            const res = await admin.patch(`/admin/attributes/${attribute.id}`, {
                name: 'Weight',
                unit: 'kg',
                isVisible: false,
                isFilterable: true,
                position: 4,
                productType: 'shoe',
            })

            expectOk(res, 200, 'ATTRIBUTE_UPDATE_SUCCESS')
            expect(res.json().data).toMatchObject({
                key: attribute.key,
                type: 'number',
                name: 'Weight',
                unit: 'kg',
                isVisible: false,
                isFilterable: true,
                position: 4,
                productType: 'shoe',
            })
        })

        it('clears the unit and the product type with null', async () => {
            const attribute = await createAttribute(admin, {type: 'number', unit: 'cm', productType: 'shoe'})

            const res = await admin.patch(`/admin/attributes/${attribute.id}`, {unit: null, productType: null})

            expect(res.json().data).toMatchObject({unit: null, productType: null})
        })

        it('never changes the key or the type', async () => {
            const attribute = await createAttribute(admin, {type: 'number'})

            const res = await admin.patch(`/admin/attributes/${attribute.id}`, {name: 'Renamed', key: 'other_key', type: 'text'})

            expect(res.json().data).toMatchObject({name: 'Renamed', key: attribute.key, type: 'number'})
            expectValidationError(await admin.patch(`/admin/attributes/${attribute.id}`, {key: 'other_key'}))
            expectValidationError(await admin.patch(`/admin/attributes/${attribute.id}`, {type: 'text'}))
        })

        it('advances updatedAt and keeps createdAt', async () => {
            const attribute = await createAttribute(admin)
            await sleep(10)

            const res = await admin.patch(`/admin/attributes/${attribute.id}`, {name: 'Touched'})

            expect(res.json().data.createdAt).toBe(attribute.createdAt)
            expect(new Date(res.json().data.updatedAt).getTime()).toBeGreaterThan(new Date(attribute.updatedAt).getTime())
        })

        describe('options', () => {
            const make = () => createAttribute(admin, {type: 'select', options: [opt('a', 'A'), opt('b', 'B'), opt('c', 'C')]})
            const keep = (o: any, label = o.label) => ({id: o.id, value: o.value, label})

            it('adds new options, relabels, reorders and removes unused ones in one call', async () => {
                const attribute = await make()
                const [a, b, c] = attribute.options

                const res = await admin.patch(`/admin/attributes/${attribute.id}`, {
                    options: [keep(c, 'C renamed'), opt('d', 'D'), keep(a)], // b removed, order c, d, a
                })

                expect(res.statusCode).toBe(200)
                expect(res.json().data.options.map((o: any) => [o.value, o.label, o.position])).toEqual([
                    ['c', 'C renamed', 0],
                    ['d', 'D', 1],
                    ['a', 'A', 2],
                ])
                // existing options keep their id, so stored values stay valid
                expect(res.json().data.options[0].id).toBe(c.id)
                expect(res.json().data.options[2].id).toBe(a.id)
                expect(res.json().data.options.map((o: any) => o.id)).not.toContain(b.id)
            })

            it('clears every option with an empty array', async () => {
                const attribute = await make()

                const res = await admin.patch(`/admin/attributes/${attribute.id}`, {options: []})

                expect(res.json().data.options).toEqual([])
            })

            it('leaves the options alone when the field is omitted', async () => {
                const attribute = await make()

                const res = await admin.patch(`/admin/attributes/${attribute.id}`, {name: 'Only name'})

                expect(res.json().data.options).toEqual(attribute.options)
            })

            it.each([
                ['changing the value of an existing option', (o: any[]) => [{id: o[0].id, value: 'changed', label: 'x'}]],
                ['an unknown option id', () => [{id: randomId(), value: 'zzz', label: 'x'}]],
                ['duplicate option values', (o: any[]) => [keep(o[0]), opt('a', 'again')]],
                ['an invalid option value', () => [opt('has space', 'x')]],
            ])('rejects %s and changes nothing', async (_label, build) => {
                const attribute = await make()

                invalidDefinition(await admin.patch(`/admin/attributes/${attribute.id}`, {options: build(attribute.options)}))

                expect((await admin.get(`/admin/attributes/${attribute.id}`)).json().data.options).toEqual(attribute.options)
            })

            it('rejects options on a non-choice attribute', async () => {
                const attribute = await createAttribute(admin, {type: 'text'})

                invalidDefinition(await admin.patch(`/admin/attributes/${attribute.id}`, {options: [opt('a')]}))
            })
        })

        it('rejects making a text attribute filterable and keeps it unchanged', async () => {
            const attribute = await createAttribute(admin, {type: 'text'})

            invalidDefinition(await admin.patch(`/admin/attributes/${attribute.id}`, {isFilterable: true}))

            expect((await admin.get(`/admin/attributes/${attribute.id}`)).json().data.isFilterable).toBe(false)
        })

        it.each([
            ['an empty body', {}],
            ['a blank name', {name: ' '}],
            ['a name over 100 chars', {name: 'n'.repeat(101)}],
            ['an empty unit', {unit: ''}],
            ['an unknown productType', {productType: 'boat'}],
            ['a negative position', {position: -1}],
            ['a malformed option id', {options: [{id: 'nope', value: 'a', label: 'A'}]}],
            ['more than 200 options', {options: Array.from({length: 201}, (_, i) => opt(`v${i}`))}],
        ])('rejects %s', async (_label, body) => {
            const attribute = await createAttribute(admin, {type: 'select'})

            expectValidationError(await admin.patch(`/admin/attributes/${attribute.id}`, body))
        })

        it('answers 404 for an unknown id and 400 for a malformed one', async () => {
            expectError(await admin.patch(`/admin/attributes/${randomId()}`, {name: 'x'}), 404, 'ATTRIBUTE_NOT_FOUND')
            expectValidationError(await admin.patch('/admin/attributes/not-a-uuid', {name: 'x'}))
        })
    })

    describe('DELETE /admin/attributes/:id', () => {
        it('deletes an unused definition together with its options and frees the key', async () => {
            const attribute = await createAttribute(admin, {type: 'select', options: [opt('a')]})

            const res = await admin.delete(`/admin/attributes/${attribute.id}`)

            expectOk(res, 200, 'ATTRIBUTE_DELETE_SUCCESS')
            expect(res.json().data).toBeNull()
            expectError(await admin.get(`/admin/attributes/${attribute.id}`), 404, 'ATTRIBUTE_NOT_FOUND')
            expect((await admin.post('/admin/attributes', attributeBody({key: attribute.key}))).statusCode).toBe(201)
        })

        it('refuses to delete a definition that products use, and allows it after the values are cleared', async () => {
            const attribute = await createAttribute(admin, {type: 'text'})
            const product = await createProduct(admin)
            expect((await setAttributes(admin, product.id, [{key: attribute.key, value: 'hello'}])).statusCode).toBe(200)

            expectError(await admin.delete(`/admin/attributes/${attribute.id}`), 409, 'ATTRIBUTE_IN_USE')
            expect((await admin.get(`/admin/attributes/${attribute.id}`)).statusCode).toBe(200)

            await setAttributes(admin, product.id, [])
            expect((await admin.delete(`/admin/attributes/${attribute.id}`)).statusCode).toBe(200)
        })

        it('answers 404 when deleting twice and 400 for a malformed id', async () => {
            const attribute = await createAttribute(admin)
            await admin.delete(`/admin/attributes/${attribute.id}`)

            expectError(await admin.delete(`/admin/attributes/${attribute.id}`), 404, 'ATTRIBUTE_NOT_FOUND')
            expectValidationError(await admin.delete('/admin/attributes/not-a-uuid'))
        })
    })

    describe('access control', () => {
        it('is admin only, and writes also need the CSRF header', async () => {
            const shopper = (await createUserSession(ctx)).api
            const anonymous = anonymousApi(ctx.app)
            const noCsrf = apiWithoutCsrf(ctx.app, adminSession.session)
            const attribute = await createAttribute(admin)
            const calls: [string, 'GET' | 'POST' | 'PATCH' | 'DELETE', string, unknown?][] = [
                ['list', 'GET', '/admin/attributes'],
                ['get', 'GET', `/admin/attributes/${attribute.id}`],
                ['create', 'POST', '/admin/attributes', attributeBody()],
                ['edit', 'PATCH', `/admin/attributes/${attribute.id}`, {name: 'x'}],
                ['delete', 'DELETE', `/admin/attributes/${randomId()}`],
            ]

            for (const [, method, url, body] of calls) {
                expect([401, 403]).toContain((await anonymous.request(method, url, body)).statusCode)
                expect((await shopper.request(method, url, body)).statusCode).toBe(403)
                if (method !== 'GET') expect([401, 403]).toContain((await noCsrf.request(method, url, body)).statusCode)
            }
        })
    })
})