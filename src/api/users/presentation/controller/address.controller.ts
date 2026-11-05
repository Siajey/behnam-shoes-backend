import {
    Controller,
    Delete,
    Get,
    HttpStatus,
    Inject,
    NotFoundException,
    Param,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common'
import { FastifyRequest } from 'fastify'

import { Roles } from '@common/decorator'
import { SuccessResponse } from '@common/api'
import { UserRole } from '@api/users/domain'
import { ProfileAddressSchema } from '@api/users/presentation'
import { CSRFGuard, JwtSessionGuard, RolesGuard } from '@api/session/presentation'
import {
    ICreateAddress,
    IDeleteAddress,
    IGetMyAddresses,
    ISetDefaultAddress,
    IUpdateAddress,
} from '@api/users/application'
import {
    CREATE_ADDRESS,
    DELETE_ADDRESS,
    GET_MY_ADDRESSES,
    SET_DEFAULT_ADDRESS,
    UPDATE_ADDRESS,
} from '@common/di'

@UseGuards(JwtSessionGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.USER)
@Controller('users/me/addresses')
export default class AddressController {
    constructor(
        @Inject(GET_MY_ADDRESSES)
        private readonly getMyAddresses: IGetMyAddresses,
        @Inject(CREATE_ADDRESS)
        private readonly createAddress: ICreateAddress,
        @Inject(UPDATE_ADDRESS)
        private readonly updateAddress: IUpdateAddress,
        @Inject(SET_DEFAULT_ADDRESS)
        private readonly setDefaultAddress: ISetDefaultAddress,
        @Inject(DELETE_ADDRESS)
        private readonly deleteAddress: IDeleteAddress,
    ) {}

    @Get()
    async getMyAddressesController(@Req() req: FastifyRequest) {
        const id = req.user['id']
        if (id === undefined) {
            throw new NotFoundException('errors.user.notFound')
        }
        const addresses = await this.getMyAddresses.execute(id)
        return new SuccessResponse({
            path: '/users/me/addresses',
            code: 'GET_ADDRESSES_SUCCESS',
            status: HttpStatus.OK,
            timestamp: new Date(),
            messageObj: { message: 'common.address.getAddressesSuccess' },
            data: addresses,
        })
    }

    @UseGuards(CSRFGuard)
    @Post()
    async createAddressController(@Req() req: FastifyRequest) {
        const id = req.user['id']
        const body = req.body
        if (id === undefined) {
            throw new NotFoundException('errors.user.notFound')
        }
        const parsedBody = ProfileAddressSchema.parse(body)
        const address = await this.createAddress.execute(id, parsedBody)
        return new SuccessResponse({
            path: '/users/me/addresses',
            code: 'CREATE_ADDRESS_SUCCESS',
            status: HttpStatus.CREATED,
            timestamp: new Date(),
            messageObj: { message: 'common.address.createAddressSuccess' },
            data: address,
        })
    }

    @UseGuards(CSRFGuard)
    @Patch(':id')
    async updateAddressController(
        @Req() req: FastifyRequest,
        @Param('id') addressId: string,
    ) {
        const id = req.user['id']
        const body = req.body
        if (id === undefined) {
            throw new NotFoundException('errors.user.notFound')
        }
        const parsedBody = ProfileAddressSchema.partial().parse(body)
        const address = await this.updateAddress.execute(
            id,
            addressId,
            parsedBody,
        )
        return new SuccessResponse({
            path: `/users/me/addresses/${addressId}`,
            code: 'UPDATE_ADDRESS_SUCCESS',
            status: HttpStatus.OK,
            timestamp: new Date(),
            messageObj: { message: 'common.address.updateAddressSuccess' },
            data: address,
        })
    }

    @UseGuards(CSRFGuard)
    @Post(':id/default')
    async setDefaultAddressController(
        @Req() req: FastifyRequest,
        @Param('id') addressId: string,
    ) {
        const id = req.user['id']
        if (id === undefined) {
            throw new NotFoundException('errors.user.notFound')
        }
        const address = await this.setDefaultAddress.execute(id, addressId)
        return new SuccessResponse({
            path: `/users/me/addresses/${addressId}/default`,
            code: 'SET_DEFAULT_ADDRESS_SUCCESS',
            status: HttpStatus.OK,
            timestamp: new Date(),
            messageObj: { message: 'common.address.setDefaultAddressSuccess' },
            data: address,
        })
    }

    @UseGuards(CSRFGuard)
    @Delete(':id')
    async deleteAddressController(
        @Req() req: FastifyRequest,
        @Param('id') addressId: string,
    ) {
        const id = req.user['id']
        if (id === undefined) {
            throw new NotFoundException('errors.user.notFound')
        }
        await this.deleteAddress.execute(id, addressId)
        return new SuccessResponse({
            path: `/users/me/addresses/${addressId}`,
            code: 'DELETE_ADDRESS_SUCCESS',
            status: HttpStatus.NO_CONTENT,
            timestamp: new Date(),
            messageObj: { message: 'common.address.deleteAddressSuccess' },
            data: null,
        })
    }
}