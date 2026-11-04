import axios, { isAxiosError } from 'axios'
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import * as fs from 'node:fs'
import { createReadStream } from 'node:fs'
import * as bcrypt from 'bcryptjs'

import { FileService, StorageType } from '@common/file'
import { AVATAR_UPLOADS_PATH } from '@common/constants'
import { IUserRepository, User, UserRole, UserStatus } from '@user/domain'
import { deserializeCookies } from '@common/util'

export const deleteUploadedAvatarImages = async (fileService: FileService) => {
  const files = await fileService.listFiles(AVATAR_UPLOADS_PATH, 'local')
  if (files && files.length > 0)
    await fileService.deleteFile(
      files.map((path) => `test${AVATAR_UPLOADS_PATH}/${path}`),
      'local',
    )
}

export const createUniqueUsername = () => {
  const random = randomStringGenerator()
  return 'u_' + random.slice(0, 15)
}

export const testUploadFileWithPresignedUrl = async (
  app: NestFastifyApplication,
  endpoint: string,
  filePath: string,
  loggedInCookie: any,
  loggedInCsrf: any,
) => {
  const response = await app.inject({
    url: endpoint + `?key=${filePath.split('/').pop()}`,
    method: 'POST',
    headers: {
      'set-cookie': loggedInCookie,
      'x-csrf-token': loggedInCsrf,
    },
  })
  const presignedUrl = await response.json()
  const stats = fs.statSync(filePath)
  const fileStream = createReadStream(filePath)
  try {
    return await axios.put(presignedUrl.data, fileStream, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': stats.size,
      },
      maxBodyLength: Infinity,
    })
  } catch (e) {
    if (isAxiosError(e)) {
      console.log(e.response.data)
    } else console.log(e)
  }
}

export const deleteUploadedImagesToCloud = async (
  fileService: FileService,
  storageType: StorageType,
  path: string,
) => {
  const files = await fileService.listFiles(path, storageType)
  if (files && files.length > 0)
    await fileService.deleteFile(
      files.map((key) => key),
      storageType,
    )
}

export const testLogInAdmin = async (
  userRepository: IUserRepository,
  app: NestFastifyApplication,
) => {
  const password = 'Poiuytrewq1'
  const hashedPass = await bcrypt.hash(password, 10)
  const user = await userRepository.save({
    email: 'user@gmail.com',
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
      emailOrUsername: 'user@gmail.com',
      password: password,
    },
  })
  const loggedInCookies = loginResult.headers['set-cookie']
  const loggedInCsrf =
    loginResult.cookies?.['csrf_token'] ||
    deserializeCookies(loggedInCookies)['csrf_token']
  return {
    user,
    loggedInCookies,
    loggedInCsrf,
    password,
  }
}

export const testGetFileByUrl = async (path: string) => {
  return await axios.get(path, {
    responseType: 'arraybuffer',
  })
}

export const delay = (delay = 1000) =>
  new Promise((resolve) => {
    return setTimeout(() => {
      resolve(delay)
    }, delay)
  })

export const generateRandomUsername = () => {
  return 'user' + Math.random().toString(36).slice(2, 8)
}
