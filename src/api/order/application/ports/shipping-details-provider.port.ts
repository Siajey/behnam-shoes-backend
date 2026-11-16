export interface ShippingDetails {
  address: {
    province: string
    city: string
    street: string
    postalCode: string
  }
  recipient: { firstName: string; lastName: string; phoneNumber: string }
}

export interface IShippingDetailsProvider {
  get(userId: string, addressId: string): Promise<ShippingDetails>
}
