import { Module } from '@nestjs/common'

import UserModule from '@api/users/user.module'
import { AuthController } from '@api/auth/presentation'
import { AuthProviders } from '@api/auth/infrastructure'
import { CryptoModule } from '@common/security'
import { SenderModule } from '@common/sender'
import { CustomCacheModule } from '@common/cache'
import SessionModule from '@session/session.module'

@Module({
  imports: [
    CustomCacheModule,
    CryptoModule,
    SenderModule,
    SessionModule,
    UserModule,
  ],
  controllers: [AuthController],
  providers: [...AuthProviders],
})
export default class AuthModule {}
