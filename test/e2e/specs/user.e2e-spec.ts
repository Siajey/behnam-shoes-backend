import { beforeAll, describe, expect, it } from '@jest/globals'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import * as bcrypt from 'bcryptjs'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { HttpStatus } from '@nestjs/common'
import * as supertest from 'supertest'

import { TestContext, testContextE2e } from './test-context.e2e'
import { createUniqueUsername } from '../../util/test.util'
import { IUserRepository, User, UserResponse, UserRole, UserStatus, } from '@user/domain'
import { deserializeCookies } from '@common/util'
import { SESSION_CACHE_SERVICE } from '@common/di'
import { AVATAR_UPLOADS_PATH } from '@common/constants'
import { NotFoundError } from '@common/errors'
import { SessionCacheService } from '@session/application'

describe('UserController (e2e)', () => {
  let ctx: TestContext
  let app: NestFastifyApplication
  let admin: UserResponse
  let sessionCacheService: SessionCacheService

  let userRepository: IUserRepository
  let loggedInAdminCookies: any
  let loggedInAdminCsrf: any

  beforeAll(async () => {
    ctx = await testContextE2e()
    app = ctx.app
    userRepository = ctx.userRepository
    sessionCacheService = ctx.app.get(SESSION_CACHE_SERVICE)

    const password = 'Poiuytrewq1'
    const hashedPass = await bcrypt.hash(password, 10)

    admin = await userRepository.save({
      email: 'admin@gmail.com',
      username: createUniqueUsername(),
      passwordHash: hashedPass,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
    } as User)

    const loginResult = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        emailOrUsername: 'admin@gmail.com',
        password: password,
      },
    })
    loggedInAdminCookies = loginResult.headers['set-cookie']
    loggedInAdminCsrf =
      loginResult.cookies?.['csrf_token'] ||
      deserializeCookies(loggedInAdminCookies)['csrf_token']
  })

  it('/users (POST) should create user by admin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        email: 'user@gmail.com',
        username: createUniqueUsername(),
        password: 'Poiuytrewq1',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
      headers: {
        'set-cookie': loggedInAdminCookies,
        'x-csrf-token': loggedInAdminCsrf,
      },
    })
    expect(res.statusCode).toBe(201)
    const savedUser = await userRepository.findForLogin('user@gmail.com')
    expect(savedUser).toBeDefined()
  })

  it('/users/:id (DELETE) should delete user by admin', async () => {
    const userToDelete = await userRepository.save({
      email: 'EmailOrPhoneNumber@gmail.com',
      username: createUniqueUsername(),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      passwordHash: 'passwordHash',
    } as User)
    expect(userToDelete.id).toBeDefined()
    const res = await app.inject({
      method: 'DELETE',
      url: `/users/${userToDelete.id}`,
      headers: {
        'set-cookie': loggedInAdminCookies,
        'x-csrf-token': loggedInAdminCsrf,
      },
    })
    expect(res.statusCode).toBe(204)
    await expect(
      userRepository.findForLogin('EmailOrPhoneNumber@gmail.com'),
    ).rejects.toThrow(new NotFoundError({ message: 'errors.user.notFound' }))
  })

  it('/users (GET) should return paginated users for admin with sorting', async () => {
    const user1 = await userRepository.save({
      email: 'a_user@gmail.com',
      username: createUniqueUsername(),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      passwordHash: 'passwordHash',
    } as User)

    const user2 = await userRepository.save({
      email: 'b_user@gmail.com',
      username: createUniqueUsername(),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      passwordHash: 'passwordHash',
    } as User)

    const user3 = await userRepository.save({
      email: 'c_user@gmail.com',
      username: createUniqueUsername(),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      passwordHash: 'passwordHash',
    } as User)

    expect(user1.id).toBeDefined()
    expect(user2.id).toBeDefined()
    expect(user3.id).toBeDefined()

    const res = await app.inject({
      method: 'GET',
      url: `/users?pageSize=2&orderBy=createdAt`,
      headers: {
        'set-cookie': loggedInAdminCookies,
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

    const sorted = [...json.data.users].sort((a, b) => a.id - b.id)
    expect(json.data.users.map((u) => u.id)).toEqual(sorted.map((u) => u.id))

    const cursor = json.data.nextCursor

    const resWithCursor = await app.inject({
      method: 'GET',
      url: `/users?pageSize=2&sort=createdAt&cursor=${cursor}`,
      headers: {
        'set-cookie': loggedInAdminCookies,
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
      headers: {
        'set-cookie': loggedInAdminCookies,
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
    const userToGet = await userRepository.save({
      email: 'get_user@gmail.com',
      username: createUniqueUsername(),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      passwordHash: 'passwordHash',
    } as User)

    expect(userToGet.id).toBeDefined()

    const res = await app.inject({
      method: 'GET',
      url: `/users/${userToGet.id}`,
      headers: {
        'set-cookie': loggedInAdminCookies,
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
      headers: {
        'set-cookie': loggedInAdminCookies,
      },
    })
    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.code).toBe('GET_USERS_SUCCESS')
    expect(json.data).toBeDefined()
    expect(json.data.email).toBe('admin@gmail.com')
  })

  it(`/users/me/ (DELETE) should delete user completely and check it's activities are deactivated`, async () => {
    const filePath = path.join(__dirname, '../../fixtures/test-avatar.png')
    const updateAvatarRes = await supertest(app.getHttpServer())
      .patch('/users/me/avatar')
      .set('x-csrf-token', loggedInAdminCsrf)
      .set('Cookie', loggedInAdminCookies)
      .attach('avatar', filePath)
    expect(updateAvatarRes.statusCode).toBe(200)
    const updated = await userRepository.findByIdWithProfile(admin.id)
    expect(updated.profile.avatar).toContain('test-avatar.png')

    const adminCachedObj = await sessionCacheService.getUserSession(admin.id)
    expect(adminCachedObj).toMatchObject({
      updatedAt: expect.any(String),
      status: 'active',
      role: 'admin',
    })

    const deleteRes = await app.inject({
      url: '/users/me',
      method: 'DELETE',
      headers: {
        'set-cookie': loggedInAdminCookies,
        'x-csrf-token': loggedInAdminCsrf,
      },
    })
    expect(deleteRes.statusCode).toBe(HttpStatus.NO_CONTENT)
    await expect(userRepository.findById(admin.id)).rejects.toThrow(
      NotFoundError,
    )

    const avatarStorePath = path.join(
      process.cwd(),
      'test',
      AVATAR_UPLOADS_PATH,
    )
    const uploadedFiles = fs.readdirSync(avatarStorePath)
    expect(uploadedFiles).not.toContain(updated.profile.avatar.split('/').pop())

    const cachedObj = await sessionCacheService.getUserSession(admin.id)
    expect(cachedObj).toBeUndefined()
  })
})
