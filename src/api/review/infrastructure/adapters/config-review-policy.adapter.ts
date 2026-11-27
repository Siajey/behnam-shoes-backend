import { Inject, Injectable } from '@nestjs/common'
import { ConfigProvider } from '@common/configuration'
import { CONFIG_PROVIDER } from '@common/di'
import { IReviewPolicy } from '@api/review/application'

@Injectable()
export class ConfigReviewPolicy implements IReviewPolicy {
  constructor(@Inject(CONFIG_PROVIDER) private readonly config: ConfigProvider) {}
  requiresPurchase(): boolean {
    return this.config.getOptional('REVIEW_REQUIRE_PURCHASE') !== 'false'
  }
}
