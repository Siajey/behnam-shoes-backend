import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import * as bcrypt from 'bcryptjs'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as supertest from 'supertest'
import { HttpStatus } from '@nestjs/common'

import { TestContext, testContextE2e } from './test-context.e2e'
import {
  createUniqueUsername,
  deleteUploadedAvatarImages,
} from '../../util/test.util'
import { FileService } from '@common/file'
import {
  IUserRepository,
  User,
  UserResponse,
  UserRole,
  UserStatus,
} from '@user/domain'
import { deserializeCookies } from '@common/util'
import { FILE_SERVICE } from '@common/di'
import { AVATAR_UPLOADS_PATH } from '@common/constants'

describe('ProfileController (e2e)', () => {
  let ctx: TestContext
  let app: NestFastifyApplication
  let admin: UserResponse

  let userRepository: IUserRepository
  let loggedInAdminCookies: any
  let loggedInAdminCsrf: any
  let fileService: FileService

  beforeAll(async () => {
    ctx = await testContextE2e()
    app = ctx.app
    fileService = app.get(FILE_SERVICE)
    userRepository = ctx.userRepository

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

  it('/users/:id (PATCH) should update user and create/update profile by admin', async () => {
    const userToUpdate = await userRepository.save({
      email: 'patch_user@gmail.com',
      username: createUniqueUsername(),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      passwordHash: 'passwordHash',
    } as User)

    expect(userToUpdate.id).toBeDefined()

    const res = await app.inject({
      method: 'PATCH',
      url: `/users/${userToUpdate.id}`,
      payload: {
        status: UserStatus.ACTIVE,
        profile: {
          firstName: 'Ali',
          lastName: 'Test',
          bio: 'Updated Bio',
        },
      },
      headers: {
        'set-cookie': loggedInAdminCookies,
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
    expect(updatedUser.profile.bio).toBe('Updated Bio')
  })

  it('/users/me (PATCH) should update user profile', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      payload: {
        firstName: 'Mohamad',
        lastName: 'Doe',
        bio: 'This is my updated bio.',
      },
      headers: {
        'set-cookie': loggedInAdminCookies,
        'x-csrf-token': loggedInAdminCsrf,
      },
    })

    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.code).toBe('UPDATE_USER_SUCCESS')
    expect(json.data).toBeDefined()
    expect(json.data.firstName).toBe('Mohamad')
    expect(json.data.lastName).toBe('Doe')
    expect(json.data.bio).toBe('This is my updated bio.')

    const updated = await userRepository.findByIdWithProfile(admin.id)
    expect(updated.profile.firstName).toBe('Mohamad')
    expect(updated.profile.bio).toBe('This is my updated bio.')
  })

  it('/users/me (PATCH) should update address when all fields are provided', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      payload: {
        address: {
          street: '123 Main St',
          city: 'Nuremberg',
          state: 'Bavaria',
          country: 'DE',
          postalCode: '90402',
        },
      },
      headers: {
        'set-cookie': loggedInAdminCookies,
        'x-csrf-token': loggedInAdminCsrf,
      },
    })
    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.data.address).toMatchObject({
      street: '123 Main St',
      city: 'Nuremberg',
      state: 'Bavaria',
      country: 'DE',
      postalCode: '90402',
    })

    const updated = await userRepository.findByIdWithProfile(admin.id)
    expect(updated.profile.address).toMatchObject({
      street: '123 Main St',
      city: 'Nuremberg',
      state: 'Bavaria',
      country: 'DE',
      postalCode: '90402',
    })
  })

  it('/users/me (GET) should get logged-in user as me', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: {
        'set-cookie': loggedInAdminCookies,
        'x-csrf-token': loggedInAdminCsrf,
      },
    })
    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.data.profile.address).toMatchObject({
      street: '123 Main St',
      city: 'Nuremberg',
      state: 'Bavaria',
      country: 'DE',
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
          country: 'DE',
        },
      },
      headers: {
        'set-cookie': loggedInAdminCookies,
        'x-csrf-token': loggedInAdminCsrf,
      },
    })

    expect(res.statusCode).toBe(HttpStatus.BAD_REQUEST)
    const json = res.json()
    expect(json.message).toContain(
      'All address fields (street, city, postal code, and country) are required.',
    )
  })

  it('/users/me/avatar (PATCH) should update user avatar', async () => {
    const filePath = path.join(__dirname, '../../fixtures/test-avatar.png')
    const res = await supertest(app.getHttpServer())
      .patch('/users/me/avatar')
      .set('x-csrf-token', loggedInAdminCsrf)
      .set('Cookie', loggedInAdminCookies)
      .attach('avatar', filePath)

    expect(res.statusCode).toBe(200)
    const updated = await userRepository.findByIdWithProfile(admin.id)
    expect(updated.profile.avatar).toContain('test-avatar.png')
  })

  it('/users/me/avatar (GET) should get user avatar', async () => {
    const updated = await userRepository.findByIdWithProfile(admin.id)
    const res = await supertest(app.getHttpServer())
      .get(updated.profile.avatar)
      .set('Cookie', loggedInAdminCookies)

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/^image\/(png|jpeg|jpg)$/)
  })

  it('/users/me/avatar (DELETE) should delete user avatar', async () => {
    const avatarStorePath = path.join(
      process.cwd(),
      'test',
      AVATAR_UPLOADS_PATH,
    )
    const uploadedFiles = fs.readdirSync(avatarStorePath)
    const updated = await userRepository.findByIdWithProfile(admin.id)
    const savedAvatarFile = updated.profile.avatar.split('/').pop()
    expect(uploadedFiles).toContain(savedAvatarFile)
    expect(updated.profile.avatar).toContain('test-avatar.png')

    const res = await app.inject({
      url: '/users/me/avatar',
      method: 'DELETE',
      headers: {
        'set-cookie': loggedInAdminCookies,
        'x-csrf-token': loggedInAdminCsrf,
      },
    })
    expect(res.statusCode).toBe(HttpStatus.NO_CONTENT)

    const afterDelete = await userRepository.findByIdWithProfile(admin.id)
    expect(afterDelete.profile.avatar).toBeNull()
    expect(uploadedFiles).toContain(savedAvatarFile)
  })

  afterAll(async () => {
    await deleteUploadedAvatarImages(fileService)
  })
})
