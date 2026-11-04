export const DummyUser = {
  email: 'jane.doe@zalvolt.com',
  username: 'jane_doe',
  passwordHash: '$2a$10$examplehashvaluegoeshereforseedingonly',
  role: 'user',
  status: 'active',
}

export const DummyProfile = {
  firstName: 'Jane',
  lastName: 'Doe',
  bio: 'Renewable energy enthusiast and homeowner monitoring my Powerwall setup.',
  avatar: 'https://cdn.zalvolt.com/avatars/jane-doe.png',
  address: {
    street: '123 Sonnenallee',
    city: 'Nuremberg',
    state: 'Bavaria',
    country: 'DE',
    postalCode: '90402',
  },
}
export const DummyUserWithProfile = {
  ...DummyUser,
  profile: DummyProfile,
}
