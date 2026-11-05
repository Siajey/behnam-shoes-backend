import {HttpStatus} from '@nestjs/common'
import {NestFastifyApplication} from '@nestjs/platform-fastify'
import {beforeAll, describe, expect, it} from '@jest/globals'

import {TestContext, testContextE2e} from './test-context.e2e'
import {IUserRepository, UserRole, UserStatus} from '@api/users/domain'

import {createUser, loginWithOtp, newPhone} from '../../util/test.util'

describe('Users listing (e2e)', () => {
    let ctx: TestContext
    let app: NestFastifyApplication
    let userRepository: IUserRepository
    let cookies: Record<string, string>
    let csrfToken: string

    const adminHeaders = () => ({
        'x-csrf-token': csrfToken,
    })

    const listUsers = (query = '') =>
        app.inject({
            method: 'GET',
            url: `/users${query ? `?${query}` : ''}`,
            cookies,
            headers: adminHeaders(),
        })

    beforeAll(async () => {
        ctx = await testContextE2e()
        app = ctx.app
        userRepository = ctx.userRepository

        const admin = await createUser(userRepository, {
            phoneNumber: newPhone(),
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
        })

        const authenticated = await loginWithOtp(app, admin)
        cookies = authenticated.cookies
        csrfToken = authenticated.csrfToken

        await Promise.all(
            Array.from({length: 30}, () =>
                createUser(userRepository),
            ),
        )
    })

    describe('cursor pagination', () => {
        it('returns a sorted first page with a cursor when more results exist', async () => {
            const pageSize = 10
            const res = await listUsers(`pageSize=${pageSize}&sort=phoneNumber`)

            expect(res.statusCode).toBe(HttpStatus.OK)
            expect(res.json()).toMatchObject({
                code: 'GET_USERS_SUCCESS',
            })
            expect(res.json().data.users).toHaveLength(pageSize)
            expect(res.json().data.nextCursor).toBeDefined()

            const phoneNumbers = res.json().data.users.map((user: any) => user.phoneNumber)

            expect(phoneNumbers).toEqual([...phoneNumbers].sort())
        })

        it('returns a distinct, continuing second page when following the cursor', async () => {
            const pageSize = 10

            const firstRes = await listUsers(`pageSize=${pageSize}&sort=phoneNumber`)
            const firstPage = firstRes.json().data
            const firstPagePhoneNumbers = firstPage.users.map((user: any) => user.phoneNumber)

            expect(firstPage.nextCursor).toBeDefined()

            const secondRes = await listUsers(
                `pageSize=${pageSize}&sort=phoneNumber&nextCursor=${encodeURIComponent(firstPage.nextCursor)}`,
            )

            expect(secondRes.statusCode).toBe(HttpStatus.OK)

            const secondPage = secondRes.json().data
            const secondPagePhoneNumbers = secondPage.users.map((user: any) => user.phoneNumber)

            expect(secondPagePhoneNumbers).toHaveLength(pageSize)
            expect(secondPagePhoneNumbers.some((phoneNumber: string) =>
                firstPagePhoneNumbers.includes(phoneNumber),
            )).toBe(false)

            expect(secondPagePhoneNumbers[0] > firstPagePhoneNumbers.at(-1)).toBe(true)
            expect(secondPagePhoneNumbers).toEqual([...secondPagePhoneNumbers].sort())
        })

        it('returns no nextCursor on the final page', async () => {
            const pageSize = 15
            const visitedCursors = new Set<string>()
            let cursor: string | undefined
            let lastPage: any

            do {
                const query = cursor
                    ? `pageSize=${pageSize}&sort=phoneNumber&nextCursor=${encodeURIComponent(cursor)}`
                    : `pageSize=${pageSize}&sort=phoneNumber`

                const res = await listUsers(query)

                expect(res.statusCode).toBe(HttpStatus.OK)

                lastPage = res.json().data
                cursor = lastPage.nextCursor

                if (cursor) {
                    expect(visitedCursors.has(cursor)).toBe(false)
                    visitedCursors.add(cursor)
                }
            } while (cursor)

            expect(lastPage.nextCursor).toBeFalsy()
            expect(lastPage.users.length).toBeGreaterThan(0)
        })
    })

    describe('sorting', () => {
        it('defaults to createdAt descending when no sort is provided', async () => {
            const res = await listUsers('pageSize=25')

            expect(res.statusCode).toBe(HttpStatus.OK)

            const createdAts = res.json().data.users.map(
                (user: any) => new Date(user.createdAt).getTime(),
            )

            expect(createdAts).toEqual(
                [...createdAts].sort((a, b) => b - a),
            )
        })

        it('sorts ascending when direction is specified as asc', async () => {
            const res = await listUsers('pageSize=25&sort=phoneNumber:asc')

            expect(res.statusCode).toBe(HttpStatus.OK)

            const phoneNumbers = res.json().data.users.map((user: any) => user.phoneNumber)

            expect(phoneNumbers).toEqual([...phoneNumbers].sort())
        })

        it('sorts descending when direction is specified as desc', async () => {
            const res = await listUsers('pageSize=25&sort=phoneNumber:desc')

            expect(res.statusCode).toBe(HttpStatus.OK)

            const phoneNumbers = res.json().data.users.map((user: any) => user.phoneNumber)

            expect(phoneNumbers).toEqual([...phoneNumbers].sort().reverse())
        })

        it('applies multiple sort fields in the specified order', async () => {
            const phonePrefix = '0988'
            const user1 = await createUser(userRepository, {
                phoneNumber: `${phonePrefix}2`,
                status: UserStatus.ACTIVE,
            })
            const user2 = await createUser(userRepository, {
                phoneNumber: `${phonePrefix}1`,
                status: UserStatus.ACTIVE,
            })
            const user3 = await createUser(userRepository, {
                phoneNumber: `${phonePrefix}3`,
                status: UserStatus.INACTIVE,
            })

            const res = await listUsers(
                'pageSize=100&sort=status:asc,phoneNumber:asc',
            )

            expect(res.statusCode).toBe(HttpStatus.OK)

            const users: { phoneNumber: string; status: string }[] =
                res.json().data.users

            const expectedPhoneNumbers = [user1.phoneNumber, user2.phoneNumber, user3.phoneNumber]
            const targetUsers = users.filter((user) =>
                expectedPhoneNumbers.includes(user.phoneNumber),
            )

            expect(targetUsers.map((user) => user.phoneNumber)).toEqual([
                user2.phoneNumber,
                user1.phoneNumber,
                user3.phoneNumber,
            ])
        })

        it('ignores unrecognized sort fields and falls back to the default sort', async () => {
            const res = await listUsers(
                'pageSize=25&sort=notARealField:asc',
            )

            expect(res.statusCode).toBe(HttpStatus.OK)

            const createdAts = res.json().data.users.map(
                (user: any) => new Date(user.createdAt).getTime(),
            )

            expect(createdAts).toEqual(
                [...createdAts].sort((a, b) => b - a),
            )
        })
    })

    describe('filtering', () => {
        it('filters users by exact phoneNumber match', async () => {
            const user = await createUser(userRepository)

            const res = await listUsers(
                `phoneNumber=${encodeURIComponent(user.phoneNumber)}`,
            )

            expect(res.statusCode).toBe(HttpStatus.OK)

            const users = res.json().data.users

            expect(users).toHaveLength(1)
            expect(users[0].phoneNumber).toBe(user.phoneNumber)
        })

        it('filters users by role', async () => {
            const user = await createUser(userRepository, {
                role: UserRole.ADMIN,
            })

            const res = await listUsers('pageSize=100&role=admin')

            expect(res.statusCode).toBe(HttpStatus.OK)

            const users = res.json().data.users

            expect(users.every((user: any) => user.role === 'admin')).toBe(true)
            expect(users.some((u: any) => u.phoneNumber === user.phoneNumber)).toBe(true)
        })

        it('filters users by status', async () => {
            const user = await createUser(userRepository, {
                status: UserStatus.INACTIVE,
            })

            const res = await listUsers('pageSize=100&status=inactive')

            expect(res.statusCode).toBe(HttpStatus.OK)

            const users = res.json().data.users

            expect(users.every((user: any) => user.status === 'inactive')).toBe(true)
            expect(users.some((u: any) => u.phoneNumber === user.phoneNumber)).toBe(true)
        })

        it('combines multiple filters with AND semantics', async () => {
            const matchUser = await createUser(userRepository, {
                role: UserRole.ADMIN,
                status: UserStatus.INACTIVE,
            })
            const nomatchUser = await createUser(userRepository, {
                role: UserRole.ADMIN,
                status: UserStatus.ACTIVE,
            })

            const res = await listUsers(
                'pageSize=100&role=admin&status=inactive',
            )

            expect(res.statusCode).toBe(HttpStatus.OK)

            const phoneNumbers = res.json().data.users.map((user: any) => user.phoneNumber)

            expect(phoneNumbers).toContain(matchUser.phoneNumber)
            expect(phoneNumbers).not.toContain(nomatchUser.phoneNumber)
        })

        it('filters users created before a given createdAt using the lt operator', async () => {
            const threshold = new Date().toISOString()

            const res = await listUsers(
                `pageSize=100&sort=createdAt:desc&createdAt=${encodeURIComponent(`[lt]${threshold}`)}`,
            )

            expect(res.statusCode).toBe(HttpStatus.OK)

            const users: { createdAt: string }[] = res.json().data.users

            expect(
                users.every(
                    (user) =>
                        new Date(user.createdAt).getTime() <
                        new Date(threshold).getTime(),
                ),
            ).toBe(true)
        })

        it('returns an empty result set when no user matches the filter', async () => {
            const phoneNumber = newPhone()

            const res = await listUsers(
                `phoneNumber=${encodeURIComponent(phoneNumber)}`,
            )

            expect(res.statusCode).toBe(HttpStatus.OK)

            const data = res.json().data

            expect(data.users).toHaveLength(0)
            expect(data.nextCursor).toBeFalsy()
        })

        it('ignores filter fields that are not in the allow-list', async () => {
            const res = await listUsers('pageSize=5&password=irrelevant')

            expect(res.statusCode).toBe(HttpStatus.OK)
            expect(res.json().data.users).toHaveLength(5)
        })
    })

    describe('pagination parameters', () => {
        it('defaults to a pageSize of 10 when omitted', async () => {
            const res = await listUsers()

            expect(res.statusCode).toBe(HttpStatus.OK)
            expect(res.json().data.users).toHaveLength(10)
        })

        it('caps pageSize at the maximum allowed limit', async () => {
            const res = await listUsers('pageSize=100000')

            expect(res.statusCode).toBe(HttpStatus.OK)
            expect(res.json().data.users.length).toBeLessThanOrEqual(100)
        })

        it('ignores a malformed cursor and returns the first page', async () => {
            const res = await listUsers(
                'pageSize=10&sort=phoneNumber&nextCursor=not-a-valid-cursor',
            )

            expect(res.statusCode).toBe(HttpStatus.OK)
            expect(res.json().data.users).toHaveLength(10)
        })

        it('reports the correct users length alongside the returned page', async () => {
            const pageSize = 7
            const res = await listUsers(`pageSize=${pageSize}`)

            expect(res.statusCode).toBe(HttpStatus.OK)

            const data = res.json().data

            expect(data.length).toBe(data.users.length)
        })
    })
})