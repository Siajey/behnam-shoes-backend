import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'

import { SuccessResponse } from '@common/api'
import { CSRFGuard, JwtSessionGuard, RolesGuard } from '@api/session/presentation'
import { Roles } from '@common/decorator'
import { ZodValidationPipe } from '@common/validations'
import {
  CreateUserDto,
  CreateUserSchema,
  UpdateUserDto,
  UpdateUserSchema,
} from '../dto'
import { User, UserRole } from '@api/users/domain'
import {
  ICountUsers,
  ICreateUser,
  IDeleteUser,
  IGetUserById,
  IGetUsers,
  IUpdateUser,
} from '@api/users/application'
import {
  COUNT_USERS,
  CREATE_USER,
  DELETE_USER,
  GET_USER_BY_ID,
  GET_USERS,
  UPDATE_USER,
} from '@common/di'

@UseGuards(JwtSessionGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('users')
export default class UserController {
  constructor(
    @Inject(CREATE_USER)
    private readonly createUser: ICreateUser,
    @Inject(UPDATE_USER)
    private readonly updateUser: IUpdateUser,
    @Inject(GET_USER_BY_ID)
    private readonly getUserById: IGetUserById,
    @Inject(GET_USERS)
    private readonly getUsers: IGetUsers,
    @Inject(COUNT_USERS)
    private readonly countUsers: ICountUsers,
    @Inject(DELETE_USER)
    private readonly deleteUser: IDeleteUser,
  ) {}

  @UseGuards(CSRFGuard)
  @Post('/')
  async createUserController(
    @Body(new ZodValidationPipe(CreateUserSchema)) body: CreateUserDto,
  ) {
    const user = await this.createUser.execute(body as unknown as User)

    return new SuccessResponse({
      path: '/users',
      code: 'CREATE_USER_SUCCESS',
      status: HttpStatus.CREATED,
      timestamp: new Date(),
      messageObj: { message: 'common.user.createUserSuccess' },
      data: user,
    })
  }

  @UseGuards(CSRFGuard)
  @Delete('/:id')
  async deleteUserController(@Param('id') id: string) {
    try {
      await this.deleteUser.execute(id)
    } catch {
      throw new NotFoundException('errors.user.notFound')
    }
    return new SuccessResponse({
      path: '/users/:id',
      code: 'DELETE_USER_SUCCESS',
      status: HttpStatus.NO_CONTENT,
      data: null,
    })
  }

  @Get('/')
  async findAllUsers(@Query() ...params: any) {
    const users = await this.getUsers.execute({
      pageSize: params[0].pageSize,
      nextCursor: params[0].nextCursor,
      sort: params[0].sort,
      filterFields: {
        phoneNumber: params[0]['phoneNumber'],
        role: params[0]['role'],
        status: params[0]['status'],
      },
    })
    return new SuccessResponse({
      path: '/users',
      code: 'GET_USERS_SUCCESS',
      messageObj: {
        message: 'common.user.getUsersSuccess',
      },
      status: HttpStatus.OK,
      data: users,
    })
  }

  @Get('/count')
  async count(@Query() ...params: any) {
    const users = await this.countUsers.execute({
      pageSize: params[0].pageSize,
      phoneNumber: params[0]['phoneNumber'],
      role: params[0]['role'],
      status: params[0]['status'],
    })
    return new SuccessResponse({
      path: '/users',
      code: 'GET_USERS_SUCCESS',
      messageObj: {
        message: 'common.user.getUsersSuccess',
      },
      status: HttpStatus.OK,
      data: users,
    })
  }

  @Get('/:id')
  async findUserById(@Param('id') id: string) {
    const user = await this.getUserById.execute(id)
    return new SuccessResponse({
      path: '/users/:id',
      code: 'GET_USERS_SUCCESS',
      messageObj: {
        message: 'common.user.getUsersSuccess',
      },
      status: HttpStatus.OK,
      data: user,
    })
  }

  @UseGuards(CSRFGuard)
  @Patch('/:id')
  async updateUserController(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
  ) {
    const parsedBody = UpdateUserSchema.parse(body)
    const updatedUser = await this.updateUser.execute({
      ...(parsedBody as Partial<User>),
      id,
    })
    return new SuccessResponse({
      path: '/users/:id',
      messageObj: {
        message: 'common.user.updateUserSuccess',
      },
      code: 'UPDATE_USER_SUCCESS',
      status: HttpStatus.OK,
      data: updatedUser,
    })
  }
}
