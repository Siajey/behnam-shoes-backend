import {Address, Profile, User, UserRole, UserStatus} from "@api/users/domain";

export const DummyAddress = new Address({
    id: 'addr_1',
    profileId: 'prof_1',
    province: 'Bavaria',
    city: 'Nuremberg',
    street: '123 Sonnenallee',
    postalCode: '90402',
    isDefault: true,
    createdAt: new Date(),
})

export const DummyProfile = new Profile({
    id: 'prof_1',
    userId: 'user_1',
    firstName: 'Jane',
    lastName: 'Doe',
    createdAt: new Date(),

})

export const DummyUser = new User({
    id: 'user_1',
    phoneNumber: '+4915123456789',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
})

export const DummyUserWithProfile = new User({
    ...DummyUser,
    profile: DummyProfile,
})