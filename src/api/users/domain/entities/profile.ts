import {Address} from "@api/users/domain";

export class Profile {
    id: string
    userId: string| null
    firstName: string | null
    lastName: string | null
    addresses?: Address[]
    updatedAt?: Date
    createdAt: Date

    constructor(profile: Profile) {
        Object.assign(this, profile)
    }
}