import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Inject,
  NotFoundException,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common'
import { FastifyRequest } from 'fastify'

import { ReqUser, Roles } from '@common/decorator'
import { SuccessResponse } from '@common/api'
import { Profile, User, UserRole } from '@api/users/domain'
import { UserProfileSchema } from '@api/users/presentation'
import { CSRFGuard, JwtSessionGuard, RolesGuard } from '@api/session/presentation'
import {
  IDeleteMe,
  IGetMe,
  IUpdateMe,
} from '@api/users/application'
import {
  DELETE_ME,
  GET_ME,
  UPDATE_ME,
} from '@common/di'

@UseGuards(JwtSessionGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.USER)
@Controller('users')
export default class ProfileController {
  constructor(
    @Inject(GET_ME)
    private readonly getMe: IGetMe,
    @Inject(UPDATE_ME)
    private readonly updateMe: IUpdateMe,
    @Inject(DELETE_ME)
    private readonly deleteMe: IDeleteMe,
  ) {}

  @UseGuards(CSRFGuard)
  @Patch('/me')
  async updateMeController(@Req() req: FastifyRequest) {
    const id = req.user['id']
    const body = req.body
    if (id === undefined) {
      throw new NotFoundException('errors.user.notFound')
    }
    const parsedBody = UserProfileSchema.parse(body)
    const user = await this.updateMe.execute(id, parsedBody as Partial<Profile>)
    return new SuccessResponse({
      path: '/users/me',
      code: 'UPDATE_USER_SUCCESS',
      status: HttpStatus.OK,
      timestamp: new Date(),
      messageObj: { message: 'common.user.updateUserSuccess' },
      data: user,
    })
  }

  @Get('/me')
  async getMeController(@Req() req: FastifyRequest) {
    const id = req.user['id']
    if (id === undefined) {
      throw new NotFoundException('errors.user.notFound')
    }
    const user = await this.getMe.execute(id)
    return new SuccessResponse({
      path: '/users/me',
      code: 'GET_USERS_SUCCESS',
      status: HttpStatus.OK,
      timestamp: new Date(),
      messageObj: { message: 'common.user.getUsersSuccess' },
      data: user,
    })
  }

  @UseGuards(CSRFGuard)
  @Delete('/me')
  async deleteMeController(@ReqUser() user: User) {
    await this.deleteMe.execute(user.id)
    return new SuccessResponse({
      path: '/users/me',
      code: 'DELETE_ME_SUCCESS',
      status: HttpStatus.NO_CONTENT,
      timestamp: new Date(),
      messageObj: { message: 'common.user.DELETE_ME_SUCCESS' },
      data: null,
    })
  }
}
