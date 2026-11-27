import { Body, Controller, Delete, Get, Inject, Post, Put } from '@nestjs/common'

import {
  ICreateSettingsImageUpload, IGetSettings, IRemoveHeroImage, IUpdateHero,
} from '@api/settings/application'
import { User } from '@api/users/domain'
import { SuccessResponse } from '@common/api'
import { AdminOnly, AdminWriteOnly, ReqUser } from '@common/decorator'
import {
  CREATE_SETTINGS_IMAGE_UPLOAD, FILE_STORAGE, GET_SETTINGS, REMOVE_HERO_IMAGE, UPDATE_HERO,
} from '@common/di'
import { ZodValidationPipe } from '@common/validations'
import { IFileStorage } from '@common/storage'

import {
  CreateSettingsImageUploadBody, CreateSettingsImageUploadSchema, UpdateHeroBody, UpdateHeroSchema,
} from '../dto'
import { SettingsPresenter } from '../presenters'

@Controller('admin/settings')
export default class AdminSettingsController {
  constructor(
    @Inject(GET_SETTINGS) private readonly getSettings: IGetSettings,
    @Inject(UPDATE_HERO) private readonly updateHero: IUpdateHero,
    @Inject(REMOVE_HERO_IMAGE) private readonly removeHeroImage: IRemoveHeroImage,
    @Inject(CREATE_SETTINGS_IMAGE_UPLOAD) private readonly createUpload: ICreateSettingsImageUpload,
    @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
  ) {}

  private readonly urlOf = (key: string): string => this.storage.publicUrl(key)

  @Get()
  @AdminOnly()
  async getController() {
    return new SuccessResponse({
      messageObj: { message: 'common.settings.adminGetSuccess' },
      code: 'SETTINGS_ADMIN_GET_SUCCESS',
      path: '/admin/settings',
      data: SettingsPresenter.toAdmin(await this.getSettings.execute(), this.urlOf),
    })
  }

  @Post('images/upload-url')
  @AdminWriteOnly()
  async uploadUrlController(
    @Body(new ZodValidationPipe(CreateSettingsImageUploadSchema)) body: CreateSettingsImageUploadBody,
  ) {
    const target = await this.createUpload.execute(body)
    return new SuccessResponse({
      messageObj: { message: 'common.settings.uploadUrlSuccess' },
      code: 'SETTINGS_UPLOAD_URL_SUCCESS',
      path: '/admin/settings/images/upload-url',
      data: {
        key: target.key,
        method: target.method,
        url: target.url,
        headers: target.headers,
        expiresInSeconds: target.expiresInSeconds,
        publicUrl: target.publicUrl,
      },
    })
  }

  @Put('hero')
  @AdminWriteOnly()
  async heroController(
    @Body(new ZodValidationPipe(UpdateHeroSchema)) body: UpdateHeroBody,
    @ReqUser() user: User,
  ) {
    const hero = await this.updateHero.execute(body, user.id)
    return new SuccessResponse({
      messageObj: { message: 'common.settings.heroUpdateSuccess' },
      code: 'SETTINGS_HERO_UPDATE_SUCCESS',
      path: '/admin/settings/hero',
      data: { hero: SettingsPresenter.hero(hero, this.urlOf) },
    })
  }

  @Delete('hero/image')
  @AdminWriteOnly()
  async removeHeroImageController(@ReqUser() user: User) {
    const hero = await this.removeHeroImage.execute(user.id)
    return new SuccessResponse({
      messageObj: { message: 'common.settings.heroImageRemoveSuccess' },
      code: 'SETTINGS_HERO_IMAGE_REMOVE_SUCCESS',
      path: '/admin/settings/hero/image',
      data: { hero: SettingsPresenter.hero(hero, this.urlOf) },
    })
  }
}
