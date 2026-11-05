import { HttpStatus } from '@nestjs/common'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { beforeAll, describe, expect, it } from '@jest/globals'

import { TestContext, testContextE2e } from './test-context.e2e'
import { IUserRepository, UserRole, UserStatus } from '@api/users/domain'
import { createUser, loginWithOtp, newPhone } from '../../util/test.util'

describe('AddressController (e2e)', () => {
    let ctx: TestContext
    let app: NestFastifyApplication
    let userRepository: IUserRepository
    let cookies: Record<string, string>
    let csrfToken: string

    const headers = () => ({
        'x-csrf-token': csrfToken,
    })

    beforeAll(async () => {
        ctx = await testContextE2e()
        app = ctx.app
        userRepository = ctx.userRepository

        const user = await createUser(userRepository, {
            phoneNumber: newPhone(),
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
        })

        const authenticated = await loginWithOtp(app, user)
        cookies = authenticated.cookies
        csrfToken = authenticated.csrfToken
    })

    it('/users/me/addresses (GET) should return user addresses', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/users/me/addresses',
            cookies,
            headers: headers(),
        })

        expect(res.statusCode).toBe(HttpStatus.OK)
        expect(res.json()).toMatchObject({
            code: 'GET_ADDRESSES_SUCCESS',
        })
        expect(Array.isArray(res.json().data)).toBe(true)
    })

    it('/users/me/addresses (POST) should reject invalid address payload', async () => {
        const payload = {
            city: 'Nuremberg',
        }

        const res = await app.inject({
            method: 'POST',
            url: '/users/me/addresses',
            cookies,
            headers: headers(),
            payload,
        })

        expect(res.statusCode).toBe(HttpStatus.BAD_REQUEST)
    })

    it('/users/me/addresses (POST) should allow creating up to the maximum limit of 2 addresses', async () => {
        const address1Payload = {
            street: '123 Sonnenallee',
            city: 'Nuremberg',
            province: 'Bavaria',
            postalCode: '90402',
        }

        const res1 = await app.inject({
            method: 'POST',
            url: '/users/me/addresses',
            cookies,
            headers: headers(),
            payload: address1Payload,
        })

        expect(res1.statusCode).toBe(HttpStatus.CREATED)
        expect(res1.json().data.id).toBeDefined()

        const address2Payload = {
            street: '456 Hauptstrasse',
            city: 'Munich',
            province: 'Bavaria',
            postalCode: '80331',
        }

        const res2 = await app.inject({
            method: 'POST',
            url: '/users/me/addresses',
            cookies,
            headers: headers(),
            payload: address2Payload,
        })

        expect(res2.statusCode).toBe(HttpStatus.CREATED)
        expect(res2.json().data.id).toBeDefined()
    })

    it('/users/me/addresses (POST) should reject creating a 3rd address exceeding the limit', async () => {
        const address3Payload = {
            street: '789 Ringstrasse',
            city: 'Berlin',
            province: 'Berlin',
            postalCode: '10115',
        }

        const res = await app.inject({
            method: 'POST',
            url: '/users/me/addresses',
            cookies,
            headers: headers(),
            payload: address3Payload,
        })

        expect([HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT, HttpStatus.UNPROCESSABLE_ENTITY]).toContain(res.statusCode)
    })

    it('/users/me/addresses/:id (PATCH) should update an existing address', async () => {
        const listRes = await app.inject({
            method: 'GET',
            url: '/users/me/addresses',
            cookies,
            headers: headers(),
        })

        const addressId = listRes.json().data[0].id

        const res = await app.inject({
            method: 'PATCH',
            url: `/users/me/addresses/${addressId}`,
            cookies,
            headers: headers(),
            payload: {
                street: 'Updated Street Name',
            },
        })

        expect(res.statusCode).toBe(HttpStatus.OK)
        expect(res.json()).toMatchObject({
            code: 'UPDATE_ADDRESS_SUCCESS',
        })
        expect(res.json().data.street).toBe('Updated Street Name')
    })

    it('/users/me/addresses/:id/default (POST) should set address as default', async () => {
        const listRes = await app.inject({
            method: 'GET',
            url: '/users/me/addresses',
            cookies,
            headers: headers(),
        })

        const addressId = listRes.json().data[1].id

        const res = await app.inject({
            method: 'POST',
            url: `/users/me/addresses/${addressId}/default`,
            cookies,
            headers: headers(),
        })

        expect(res.statusCode).toBe(HttpStatus.OK)
        expect(res.json()).toMatchObject({
            code: 'SET_DEFAULT_ADDRESS_SUCCESS',
        })
        expect(res.json().data.isDefault).toBe(true)
    })

    it('/users/me/addresses/:id (DELETE) should delete an address and allow creating a new one', async () => {
        const listRes = await app.inject({
            method: 'GET',
            url: '/users/me/addresses',
            cookies,
            headers: headers(),
        })

        const addressId = listRes.json().data[0].id

        const deleteRes = await app.inject({
            method: 'DELETE',
            url: `/users/me/addresses/${addressId}`,
            cookies,
            headers: headers(),
        })

        expect(deleteRes.statusCode).toBe(HttpStatus.NO_CONTENT)

        const createRes = await app.inject({
            method: 'POST',
            url: '/users/me/addresses',
            cookies,
            headers: headers(),
            payload: {
                street: 'New Replacement Street',
                city: 'Hamburg',
                province: 'Hamburg',
                postalCode: '20095',
            },
        })

        expect(createRes.statusCode).toBe(HttpStatus.CREATED)
        expect(createRes.json().data.id).toBeDefined()
    })
})