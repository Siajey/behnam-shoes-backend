export class Profile {
    id: string
    userId: string
    firstName?: string
    lastName?: string
    updatedAt?: Date
    createdAt: Date

    constructor(profile: Profile) {
        Object.assign(this, profile)
    }
}