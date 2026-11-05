import {beforeAll, describe, expect, it} from '@jest/globals'
import {NestFastifyApplication} from '@nestjs/platform-fastify'
import {HttpStatus} from '@nestjs/common'

import {TestContext, testContextE2e} from './test-context.e2e'
import {
    IProfileRepository,
    IUserRepository,
    User,
    UserRole,
    UserStatus,
} from '@api/users/domain'
import {createUser, loginWithOtp, newPhone} from '../../util/test.util'
import {PROFILE_REPOSITORY} from '@common/di'

describe('ProfileController (e2e)', () => {
    let ctx: TestContext
    let app: NestFastifyApplication
    let admin: User

    let userRepository: IUserRepository
    let profileRepository: IProfileRepository
    let loggedInAdminCookies: any
    let loggedInAdminCsrf: any

    beforeAll(async () => {
        ctx = await testContextE2e()
        app = ctx.app
        userRepository = ctx.userRepository
        profileRepository = app.get(PROFILE_REPOSITORY)

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

    it('/users/:id (PATCH) should update user and create/update profile by admin', async () => {
        const userToUpdate = await createUser(userRepository, {
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
        })

        expect(userToUpdate.id).toBeDefined()

        const res = await app.inject({
            method: 'PATCH',
            url: `/users/${userToUpdate.id}`,
            payload: {
                status: UserStatus.ACTIVE,
                profile: {
                    firstName: 'Ali',
                    lastName: 'Test',
                },
            },
            cookies: loggedInAdminCookies,
            headers: {
                'x-csrf-token': loggedInAdminCsrf,
            },
        })

        expect(res.statusCode).toBe(200)

        const updatedUser = await userRepository.findByIdWithProfile(
            userToUpdate.id,
        )
        expect(updatedUser).toBeDefined()
        expect(updatedUser.status).toBe(UserStatus.ACTIVE)
        expect(updatedUser.profile).toBeDefined()
        expect(updatedUser.profile.firstName).toBe('Ali')
    })

    it('/users/me (PATCH) should update user profile', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/users/me',
            payload: {
                firstName: 'Mohamad',
                lastName: 'Doe',
            },
            cookies: loggedInAdminCookies,
            headers: {
                'x-csrf-token': loggedInAdminCsrf,
            },
        })
        expect(res.statusCode).toBe(200)
        const json = res.json()
        expect(json.code).toBe('UPDATE_USER_SUCCESS')
        expect(json.data).toBeDefined()
        expect(json.data.firstName).toBe('Mohamad')
        expect(json.data.lastName).toBe('Doe')

        const updated = await userRepository.findByIdWithProfile(admin.id)
        expect(updated.profile.firstName).toBe('Mohamad')
    })

    it('/users/me (PATCH) should update address when all fields are provided', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/users/me',
            payload: {
                address: {
                    street: '123 Main St',
                    city: 'Nuremberg',
                    province: 'Bavaria',
                    postalCode: '90402',
                },
            },
            cookies: loggedInAdminCookies,
            headers: {
                'x-csrf-token': loggedInAdminCsrf,
            },
        })

        expect(res.statusCode).toBe(200)
        const json = res.json()
        expect(json.data.addresses[0]).toMatchObject({
            street: '123 Main St',
            city: 'Nuremberg',
            province: 'Bavaria',
            postalCode: '90402',
        })
        const updated = await profileRepository.findByIdWithAddress(admin.id)
        expect(updated.profile.addresses).toBeDefined()
        expect(updated.profile.addresses[0]).toMatchObject({
            street: '123 Main St',
            city: 'Nuremberg',
            province: 'Bavaria',
            postalCode: '90402',
        })
    })

    it('/users/me (GET) should get logged-in user as me', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/users/me',
            cookies: loggedInAdminCookies,
            headers: {
                'x-csrf-token': loggedInAdminCsrf,
            },
        })
        expect(res.statusCode).toBe(200)
        const json = res.json()
        expect(json.data.profile.addresses[0]).toMatchObject({
            street: '123 Main St',
            city: 'Nuremberg',
            province: 'Bavaria',
            postalCode: '90402',
        })
    })

    it('/users/me (PATCH) should reject a partially filled address', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/users/me',
            payload: {
                address: {
                    city: 'Nuremberg',
                },
            },
            cookies: loggedInAdminCookies,
            headers: {
                'x-csrf-token': loggedInAdminCsrf,
            },
        })

        expect(res.statusCode).toBe(HttpStatus.BAD_REQUEST)
    })
})