import {User} from "@api/users";

declare module 'fastify' {
    interface FastifyRequest {
        user: User
    }
}