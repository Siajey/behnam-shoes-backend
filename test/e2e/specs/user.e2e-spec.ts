import { beforeAll, describe, expect, it } from '@jest/globals'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { HttpStatus } from '@nestjs/common'

import { TestContext, testContextE2e } from './test-context.e2e'
import { IUserRepository, User, UserRole, UserStatus } from '@api/users/domain'
import { SESSION_CACHE_SERVICE } from '@common/di'
import { NotFoundError } from '@common/errors'
import { SessionCacheService } from '@api/session/application'
import { createUser, loginWithOtp, newPhone } from '../../util/test.util'

describe('UserController (e2e)', () => {
    let ctx: TestContext
    let app: NestFastifyApplication
    let admin: User
    let sessionCacheService: SessionCacheService

    let userRepository: IUserRepository
    let loggedInAdminCookies: any
    let loggedInAdminCsrf: any

    beforeAll(async () => {
        ctx = await testContextE2e()
        app = ctx.app
        userRepository = ctx.userRepository
        sessionCacheService = ctx.app.get(SESSION_CACHE_SERVICE)

        const adminUser = await createUser(userRepository, {
            phoneNumber: newPhone(),
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
        })
        admin = adminUser as unknown as User

        const loginResult = await loginWithOtp(app, adminUser)
        loggedInAdminCookies = loginResult.cookies
        loggedInAdminCsrf = loginResult.csrfToken
    })

    it('/users (POST) should create user by admin', async () => {
        const phoneNumber = newPhone()
        const res = await app.inject({
            method: 'POST',
            url: '/users',
            payload: {
                phoneNumber,
                role: UserRole.USER,
                status: UserStatus.ACTIVE,
            },
            cookies: loggedInAdminCookies,
            headers: {
                'x-csrf-token': loggedInAdminCsrf,
            },
        })
        expect(res.statusCode).toBe(201)
        const savedUser = await userRepository.findByPhoneNumber(phoneNumber)
        expect(savedUser).toBeDefined()
    })

    it('/users/:id (DELETE) should delete user by admin', async () => {
        const userToDelete = await createUser(userRepository, {
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
        })
        expect(userToDelete.id).toBeDefined()
        const res = await app.inject({
            method: 'DELETE',
            url: `/users/${userToDelete.id}`,
            cookies: loggedInAdminCookies,
            headers: {
                'x-csrf-token': loggedInAdminCsrf,
            },
        })
        expect(res.statusCode).toBe(204)
        await expect(
            userRepository.findByPhoneNumber(userToDelete.phoneNumber),
        ).rejects.toThrow(new NotFoundError({ message: 'errors.user.notFound' }))
    })

    it('/users (GET) should return paginated users for admin with sorting', async () => {
        const user1 = await createUser(userRepository, {
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
        })

        const user2 = await createUser(userRepository, {
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
        })

        const user3 = await createUser(userRepository, {
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
        })

        expect(user1.id).toBeDefined()
        expect(user2.id).toBeDefined()
        expect(user3.id).toBeDefined()

        const res = await app.inject({
            method: 'GET',
            url: `/users?pageSize=2&orderBy=createdAt`,
            cookies: loggedInAdminCookies,
            headers: {
                'x-csrf-token': loggedInAdminCsrf,
            },
        })

        expect(res.statusCode).toBe(200)

        const json = res.json()

        expect(json.code).toBe('GET_USERS_SUCCESS')
        expect(json.data).toBeDefined()
        expect(Array.isArray(json.data.users)).toBe(true)
        expect(json.data.users.length).toBeGreaterThanOrEqual(2)
        expect(json.data.length).toBeGreaterThanOrEqual(2)

        const sorted = [...json.data.users].sort((a, b) => a.id.localeCompare(b.id))
        expect(json.data.users.map((u: any) => u.id)).toEqual(sorted.map((u: any) => u.id))

        const cursor = json.data.nextCursor

        const resWithCursor = await app.inject({
            method: 'GET',
            url: `/users?pageSize=2&sort=createdAt&cursor=${cursor}`,
            cookies: loggedInAdminCookies,
            headers: {
                'x-csrf-token': loggedInAdminCsrf,
            },
        })
        expect(resWithCursor.statusCode).toBe(200)
        expect(resWithCursor.json().data.length).toBeGreaterThanOrEqual(1)
    })

    it('/users/count (GET) should return users count for admin with filters', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/users/count',
            cookies: loggedInAdminCookies,
            headers: {
                'x-csrf-token': loggedInAdminCsrf,
            },
        })
        expect(res.statusCode).toBe(200)

        const json = res.json()

        expect(json.code).toBe('GET_USERS_SUCCESS')
        expect(json.data).toBeDefined()
        expect(json.data).toBeGreaterThanOrEqual(4)
    })

    it('/users/:id (GET) should get user by admin', async () => {
        const userToGet = await createUser(userRepository, {
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
        })

        expect(userToGet.id).toBeDefined()

        const res = await app.inject({
            method: 'GET',
            url: `/users/${userToGet.id}`,
            cookies: loggedInAdminCookies,
            headers: {
                'x-csrf-token': loggedInAdminCsrf,
            },
        })

        expect(res.statusCode).toBe(200)
        const json = res.json()
        expect(json.code).toBe('GET_USERS_SUCCESS')
        expect(json.data).toBeDefined()
        expect(json.data.id).toBe(userToGet.id)
    })

    it('/users/me (GET) should return logged-in user', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/users/me',
            cookies: loggedInAdminCookies,
        })
        expect(res.statusCode).toBe(200)
        const json = res.json()
        expect(json.code).toBe('GET_USERS_SUCCESS')
        expect(json.data).toBeDefined()
        expect(json.data.phoneNumber).toBe(admin.phoneNumber)
    })

    it(`/users/me/ (DELETE) should delete user completely and check it's activities are deactivated`, async () => {
        const adminCachedObj = await sessionCacheService.getUserSession(admin.id)
        expect(adminCachedObj).toMatchObject({
            updatedAt: expect.any(String),
            status: 'active',
            role: 'admin',
        })

        const deleteRes = await app.inject({
            url: '/users/me',
            method: 'DELETE',
            cookies: loggedInAdminCookies,
            headers: {
                'x-csrf-token': loggedInAdminCsrf,
            },
        })
        expect(deleteRes.statusCode).toBe(HttpStatus.NO_CONTENT)
        await expect(userRepository.findById(admin.id)).rejects.toThrow(
            NotFoundError,
        )

        const cachedObj = await sessionCacheService.getUserSession(admin.id)
        expect(cachedObj).toBeUndefined()
    })
})