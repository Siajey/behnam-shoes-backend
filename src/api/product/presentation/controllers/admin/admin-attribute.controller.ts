import {Body, Controller, Delete, Get, HttpStatus, Inject, Param, Patch, Post} from '@nestjs/common'

import {
    ICreateAttribute, IDeleteAttribute, IEditAttribute, IGetAttribute, IListAttributes,
} from '@api/product/application'
import {User} from '@api/users/domain'
import {SuccessResponse} from '@common/api'
import {AdminOnly, AdminWriteOnly, ReqUser} from '@common/decorator'
import {
    CREATE_ATTRIBUTE, DELETE_ATTRIBUTE, EDIT_ATTRIBUTE, GET_ATTRIBUTE, LIST_ATTRIBUTES,
} from '@common/di'
import {uuidSchema, ZodValidationPipe} from '@common/validations'

import {
    CreateAttributeBody, CreateAttributeSchema, EditAttributeBody, EditAttributeSchema,
} from '../../dtos'
import {AttributePresenter} from '../../presenters'

const idPipe = new ZodValidationPipe(uuidSchema)

@Controller('admin/attributes')
export default class AdminAttributeController {
    constructor(
        @Inject(LIST_ATTRIBUTES) private readonly listAttributes: IListAttributes,
        @Inject(GET_ATTRIBUTE) private readonly getAttribute: IGetAttribute,
        @Inject(CREATE_ATTRIBUTE) private readonly createAttribute: ICreateAttribute,
        @Inject(EDIT_ATTRIBUTE) private readonly editAttribute: IEditAttribute,
        @Inject(DELETE_ATTRIBUTE) private readonly deleteAttribute: IDeleteAttribute,
    ) {
    }

    @Get()
    @AdminOnly()
    async listController() {
        const definitions = await this.listAttributes.execute()
        return new SuccessResponse({
            messageObj: {message: 'common.attribute.listSuccess'},
            code: 'ATTRIBUTE_LIST_SUCCESS',
            path: '/admin/attributes',
            data: definitions.map(AttributePresenter.definition),
        })
    }

    @Get(':id')
    @AdminOnly()
    async getController(@Param('id', idPipe) id: string) {
        return new SuccessResponse({
            messageObj: {message: 'common.attribute.getSuccess'},
            code: 'ATTRIBUTE_GET_SUCCESS',
            path: `/admin/attributes/${id}`,
            data: AttributePresenter.definition(await this.getAttribute.execute(id)),
        })
    }

    @Post()
    @AdminWriteOnly()
    async createController(
        @Body(new ZodValidationPipe(CreateAttributeSchema)) body: CreateAttributeBody,
        @ReqUser() user: User,
    ) {
        const definition = await this.createAttribute.execute(body, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.attribute.createSuccess'},
            code: 'ATTRIBUTE_CREATE_SUCCESS',
            path: '/admin/attributes',
            status: HttpStatus.CREATED,
            data: AttributePresenter.definition(definition),
        })
    }

    @Patch(':id')
    @AdminWriteOnly()
    async editController(
        @Param('id', idPipe) id: string,
        @Body(new ZodValidationPipe(EditAttributeSchema)) body: EditAttributeBody,
        @ReqUser() user: User,
    ) {
        const definition = await this.editAttribute.execute({id, ...body}, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.attribute.updateSuccess'},
            code: 'ATTRIBUTE_UPDATE_SUCCESS',
            path: `/admin/attributes/${id}`,
            data: AttributePresenter.definition(definition),
        })
    }

    @Delete(':id')
    @AdminWriteOnly()
    async deleteController(@Param('id', idPipe) id: string, @ReqUser() user: User) {
        await this.deleteAttribute.execute(id, user.id)
        return new SuccessResponse({
            messageObj: {message: 'common.attribute.deleteSuccess'},
            code: 'ATTRIBUTE_DELETE_SUCCESS',
            path: `/admin/attributes/${id}`,
            data: null,
        })
    }
}
