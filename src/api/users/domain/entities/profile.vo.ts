export interface Address {
  street: string
  city: string
  state: string
  postalCode: string
  country: string
}

export class Profile {
  id: string
  userId: string
  firstName?: string
  lastName?: string
  addresses?: Address[]
  updatedAt?: Date
  createdAt: Date

  constructor(profile: Profile) {
    Object.assign(this, profile)
  }
}
