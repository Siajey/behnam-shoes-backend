import {IProfileRepository} from "@api/users/domain";
import {IGetShippingInfo, ShippingInfo} from "@api/users/application";
import {ValidationError} from "@common/errors";

export default class GetShippingInfoUseCase implements IGetShippingInfo {
    constructor(
        private readonly profiles: IProfileRepository,
    ) {
    }

    async execute(
        userId: string,
        addressId: string,
    ): Promise<ShippingInfo> {
        const shippingInfo = await this.profiles.findShippingInfo(
            userId,
            addressId,
        )

        if (!shippingInfo) {
            throw new ValidationError({
                code: 'ORDER_RECIPIENT_INCOMPLETE',
                message: 'errors.validation.address.shippingAddressIsIncomplete'
            })
        }

        return shippingInfo
    }
}