import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { resolve } from 'path'

import { CONFIG_PROVIDER } from '@common/di'
import { NestConfigProvider } from './nest-config.service'

const ROOT_DIR = resolve(__dirname, '../../../')

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validatePredefined: true,
      envFilePath: [
        ROOT_DIR + `/env/${process.env.NODE_ENV}/.env`,
        process.env.NODE_ENV === 'production'
          ? '/run/app-secrets/secret-state.env'
          : '',
      ],
    }),
  ],
  providers: [
    {
      provide: CONFIG_PROVIDER,
      useClass: NestConfigProvider,
    },
  ],
  exports: [CONFIG_PROVIDER],
})
export class CustomConfigModule {}
