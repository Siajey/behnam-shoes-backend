import { forwardRef, Module } from '@nestjs/common'

import { SessionProviders } from '@api/session/infrastructure'
import { CryptoModule } from '@common/security'
import { CustomCacheModule } from '@common/cache'
import UserModule from '@api/users/user.module'

@Module({
  imports: [CustomCacheModule, CryptoModule, forwardRef(() => UserModule)],
  providers: [...SessionProviders],
  exports: [...SessionProviders, CryptoModule],
})
export default class SessionModule {}
