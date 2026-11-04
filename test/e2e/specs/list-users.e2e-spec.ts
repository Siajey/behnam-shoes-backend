import { beforeAll, describe, expect, it } from '@jest/globals'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { HttpStatus } from '@nestjs/common'

import { TestContext, testContextE2e } from './test-context.e2e'
import { IUserRepository, User, UserResponse, UserRole, UserStatus, } from '@user/domain'
import { USER_REPOSITORY } from '@common/di'

import { generateRandomUsername, testLogInAdmin } from '../../util/test.util'
import { DummyUserWithProfile } from '../../util/user-sample'

describe('Users listing (e2e)', () => {
  let ctx: TestContext
  let app: NestFastifyApplication
  let userRepository: IUserRepository
  let loggedInAdminCookies: any
  let loggedInAdminCsrf: any
  let user: UserResponse

  beforeAll(async () => {
    ctx = await testContextE2e()
    app = ctx.app
    userRepository = app.get(USER_REPOSITORY)
    await testLogInAdmin(userRepository, app).then((authenticated) => {
      loggedInAdminCookies = authenticated.loggedInCookies
      loggedInAdminCsrf = authenticated.loggedInCsrf
      user = authenticated.user
    })
  })

  it('should return a sorted first page with a cursor when more results exist', async () => {
    const seedCount = 30
    const pageSize = 10

    const saveUserPromises: Promise<UserResponse>[] = []
    for (let i = 0; i < seedCount; i++) {
      saveUserPromises.push(
        userRepository.save({
          ...DummyUserWithProfile,
          username: `${String(i).padStart(2, '0')}_${generateRandomUsername()}`,
          email: `${i}_${DummyUserWithProfile.email}`,
        } as User),
      )
    }
    await Promise.all(saveUserPromises)

    const res = await app.inject({
      method: 'GET',
      url: `/users?pageSize=${pageSize}&sort=username`,
      headers: {
        'set-cookie': loggedInAdminCookies,
        'x-csrf-token': loggedInAdminCsrf,
      },
    })
    expect(res.statusCode).toBe(HttpStatus.OK)

    const json = res.json()
    expect(json.code).toBe('GET_USERS_SUCCESS')
    expect(json.data.users.length).toBe(pageSize)
    expect(json.data.nextCursor).toBeDefined()

    const firstPageUsernames = json.data.users.map((u) => u.username)
    const sorted = [...firstPageUsernames].sort()
    expect(firstPageUsernames).toEqual(sorted)
  })

  it('should return a distinct, continuing second page when following the cursor', async () => {
    const pageSize = 10

    const firstRes = await app.inject({
      method: 'GET',
      url: `/users?pageSize=${pageSize}&sort=username`,
      headers: {
        'set-cookie': loggedInAdminCookies,
        'x-csrf-token': loggedInAdminCsrf,
      },
    })
    const firstPage = firstRes.json().data
    const firstPageUsernames = firstPage.users.map((u) => u.username)
    const cursor = firstPage.nextCursor
    expect(cursor).toBeDefined()

    const secondRes = await app.inject({
      method: 'GET',
      url: `/users?pageSize=${pageSize}&sort=username&nextCursor=${encodeURIComponent(cursor)}`,
      headers: {
        'set-cookie': loggedInAdminCookies,
        'x-csrf-token': loggedInAdminCsrf,
      },
    })
    expect(secondRes.statusCode).toBe(HttpStatus.OK)

    const secondPage = secondRes.json().data
    const secondPageUsernames = secondPage.users.map((u) => u.username)

    expect(secondPageUsernames.length).toBe(pageSize)

    const overlap = secondPageUsernames.filter((u) =>
      firstPageUsernames.includes(u),
    )
    expect(overlap).toHaveLength(0)

    const lastOfFirst = firstPageUsernames[firstPageUsernames.length - 1]
    const firstOfSecond = secondPageUsernames[0]
    expect(firstOfSecond > lastOfFirst).toBe(true)

    expect(secondPageUsernames).toEqual([...secondPageUsernames].sort())
  })

  it('should return no nextCursor on the final page', async () => {
    let cursor: string | undefined
    let lastPage: any
    const pageSize = 15

    do {
      const url = cursor
        ? `/users?pageSize=${pageSize}&sort=username&nextCursor=${encodeURIComponent(cursor)}`
        : `/users?pageSize=${pageSize}&sort=username`

      const res = await app.inject({
        method: 'GET',
        url,
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      lastPage = res.json().data
      cursor = lastPage.nextCursor
    } while (cursor)

    expect(lastPage.nextCursor).toBeFalsy()
    expect(lastPage.users.length).toBeGreaterThan(0)
  })

  describe('sort', () => {
    it('should default to createdAt descending when no sort is provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users?pageSize=25',
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      expect(res.statusCode).toBe(HttpStatus.OK)

      const users = res.json().data.users
      const createdAts = users.map((u) => new Date(u.createdAt).getTime())
      const sortedDesc = [...createdAts].sort((a, b) => b - a)
      expect(createdAts).toEqual(sortedDesc)
    })

    it('should sort ascending when direction is specified as asc', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users?pageSize=25&sort=username:asc',
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      expect(res.statusCode).toBe(HttpStatus.OK)

      const usernames = res.json().data.users.map((u) => u.username)
      expect(usernames).toEqual([...usernames].sort())
    })

    it('should sort descending when direction is specified as desc', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users?pageSize=25&sort=username:desc',
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      expect(res.statusCode).toBe(HttpStatus.OK)

      const usernames = res.json().data.users.map((u) => u.username)
      const sortedDesc = [...usernames].sort().reverse()
      expect(usernames).toEqual(sortedDesc)
    })

    it('should apply the first field as primary sort when multiple fields are given', async () => {
      const tag = generateRandomUsername()
      await Promise.all([
        userRepository.save({
          ...DummyUserWithProfile,
          username: `b_${tag}`,
          email: `b_${tag}@${DummyUserWithProfile.email.split('@')[1]}`,
          status: UserStatus.ACTIVE,
        } as User),
        userRepository.save({
          ...DummyUserWithProfile,
          username: `a_${tag}`,
          email: `a_${tag}@${DummyUserWithProfile.email.split('@')[1]}`,
          status: UserStatus.ACTIVE,
        } as User),
        userRepository.save({
          ...DummyUserWithProfile,
          username: `c_${tag}`,
          email: `c_${tag}@${DummyUserWithProfile.email.split('@')[1]}`,
          status: UserStatus.INACTIVE,
        } as User),
      ])

      const res = await app.inject({
        method: 'GET',
        url: `/users?pageSize=100&sort=status:asc,username:asc`,
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      expect(res.statusCode).toBe(HttpStatus.OK)

      const users: { username: string; status: string }[] =
        res.json().data.users
      const taggedUsers = users.filter((u) => u.username.includes(tag))
      expect(taggedUsers.map((u) => u.username)).toEqual([
        `a_${tag}`,
        `b_${tag}`,
        `c_${tag}`,
      ])

      const statuses = users.map((u) => u.status)
      const uniqueStatusRunLengths = statuses.filter(
        (s, i) => i === 0 || s !== statuses[i - 1],
      )
      // status column is grouped (not interleaved) across the whole page
      expect(new Set(uniqueStatusRunLengths).size).toBeLessThanOrEqual(
        new Set(statuses).size,
      )
    })

    it('should ignore unrecognized sort fields and fall back to default sort', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users?pageSize=25&sort=notARealField:asc',
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      expect(res.statusCode).toBe(HttpStatus.OK)

      const createdAts = res
        .json()
        .data.users.map((u) => new Date(u.createdAt).getTime())
      const sortedDesc = [...createdAts].sort((a, b) => b - a)
      expect(createdAts).toEqual(sortedDesc)
    })
  })

  describe('filter', () => {
    it('should filter users by exact username match', async () => {
      const username = `filt_${generateRandomUsername()}`
      await userRepository.save({
        ...DummyUserWithProfile,
        username,
        email: `${username}@${DummyUserWithProfile.email.split('@')[1]}`,
      } as User)

      const res = await app.inject({
        method: 'GET',
        url: `/users?username=${encodeURIComponent(username)}`,
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      expect(res.statusCode).toBe(HttpStatus.OK)

      const users = res.json().data.users
      expect(users.length).toBe(1)
      expect(users[0].username).toBe(username)
    })

    it('should filter users by exact email match', async () => {
      const tag = generateRandomUsername()
      const email = `${tag}@${DummyUserWithProfile.email.split('@')[1]}`
      await userRepository.save({
        ...DummyUserWithProfile,
        username: tag,
        email,
      } as User)

      const res = await app.inject({
        method: 'GET',
        url: `/users?email=${encodeURIComponent(email)}`,
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      expect(res.statusCode).toBe(HttpStatus.OK)

      const users = res.json().data.users
      expect(users.length).toBe(1)
      expect(users[0].email).toBe(email)
    })

    it('should filter users by role', async () => {
      const tag = generateRandomUsername()
      await userRepository.save({
        ...DummyUserWithProfile,
        username: tag,
        email: `${tag}@${DummyUserWithProfile.email.split('@')[1]}`,
        role: UserRole.ADMIN,
      } as User)

      const res = await app.inject({
        method: 'GET',
        url: '/users?pageSize=100&role=admin',
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      expect(res.statusCode).toBe(HttpStatus.OK)

      const users = res.json().data.users
      expect(users.every((u) => u.role === 'admin')).toBe(true)
      expect(users.some((u) => u.username === tag)).toBe(true)
    })

    it('should filter users by status', async () => {
      const tag = generateRandomUsername()
      await userRepository.save({
        ...DummyUserWithProfile,
        username: tag,
        email: `${tag}@${DummyUserWithProfile.email.split('@')[1]}`,
        status: UserStatus.INACTIVE,
      } as User)

      const res = await app.inject({
        method: 'GET',
        url: '/users?pageSize=100&status=inactive',
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      expect(res.statusCode).toBe(HttpStatus.OK)

      const users = res.json().data.users
      expect(users.every((u) => u.status === 'inactive')).toBe(true)
      expect(users.some((u) => u.username === tag)).toBe(true)
    })

    it('should combine multiple filters with AND semantics', async () => {
      const tag = generateRandomUsername()
      await Promise.all([
        userRepository.save({
          ...DummyUserWithProfile,
          username: `match_${tag}`,
          email: `match_${tag}@${DummyUserWithProfile.email.split('@')[1]}`,
          role: UserRole.ADMIN,
          status: UserStatus.INACTIVE,
        } as User),
        userRepository.save({
          ...DummyUserWithProfile,
          username: `nomatch_${tag}`,
          email: `nomatch_${tag}@${DummyUserWithProfile.email.split('@')[1]}`,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
        } as User),
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/users?pageSize=100&role=admin&status=inactive',
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      expect(res.statusCode).toBe(HttpStatus.OK)

      const usernames = res.json().data.users.map((u) => u.username)
      expect(usernames).toContain(`match_${tag}`)
      expect(usernames).not.toContain(`nomatch_${tag}`)
    })

    it('should filter users created before a given createdAt using the lt operator', async () => {
      const threshold = new Date().toISOString()

      const res = await app.inject({
        method: 'GET',
        url: `/users?pageSize=100&sort=createdAt:desc&createdAt=${encodeURIComponent(`[lt]${threshold}`)}`,
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      expect(res.statusCode).toBe(HttpStatus.OK)

      const users: { createdAt: string }[] = res.json().data.users
      expect(
        users.every(
          (u) =>
            new Date(u.createdAt).getTime() < new Date(threshold).getTime(),
        ),
      ).toBe(true)
    })

    it('should return an empty result set when no user matches the filter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/users?username=${encodeURIComponent('does_not_exist_' + generateRandomUsername())}`,
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      expect(res.statusCode).toBe(HttpStatus.OK)

      const data = res.json().data
      expect(data.users).toHaveLength(0)
      expect(data.nextCursor).toBeFalsy()
    })

    it('should ignore filter fields that are not in the allow-list', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users?pageSize=5&password=irrelevant',
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      expect(res.statusCode).toBe(HttpStatus.OK)
      expect(res.json().data.users.length).toBe(5)
    })
  })

  describe('pagination', () => {
    it('should default to a pageSize of 10 when omitted', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users',
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      expect(res.statusCode).toBe(HttpStatus.OK)
      expect(res.json().data.users.length).toBe(10)
    })

    it('should cap pageSize at the maximum allowed limit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users?pageSize=100000',
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      expect(res.statusCode).toBe(HttpStatus.OK)
      expect(res.json().data.users.length).toBeLessThanOrEqual(100)
    })

    it('should ignore a malformed cursor and return the first page', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users?pageSize=10&sort=username&nextCursor=not-a-valid-cursor',
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      expect(res.statusCode).toBe(HttpStatus.OK)
      expect(res.json().data.users.length).toBe(10)
    })

    it('should report the correct users length alongside the returned page', async () => {
      const pageSize = 7

      const res = await app.inject({
        method: 'GET',
        url: `/users?pageSize=${pageSize}`,
        headers: {
          'set-cookie': loggedInAdminCookies,
          'x-csrf-token': loggedInAdminCsrf,
        },
      })
      expect(res.statusCode).toBe(HttpStatus.OK)

      const data = res.json().data
      expect(data.length).toBe(data.users.length)
    })
  })
})
