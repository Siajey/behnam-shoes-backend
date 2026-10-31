export interface UpdateItemDto<T> {
  where: Partial<T>
  data: Partial<T>
}

export interface ListQuery<AllowedField extends string> {
  pageSize?: number
  sort?: string
  nextCursor?: string
  filterFields?: Partial<Record<AllowedField, string | number>>
}
