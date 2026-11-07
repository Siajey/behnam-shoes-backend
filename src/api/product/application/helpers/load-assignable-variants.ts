import {
    IVariantRepository,
    Variant,
    VariantAlreadyAssignedError,
    VariantNotFoundError,
} from '@api/product/domain'

export async function loadAssignableVariants(
    repository: IVariantRepository,
    ids: string[],
): Promise<Variant[]> {
    const unique = [...new Set(ids)]
    if (unique.length === 0) return []

    const found = await repository.findByIds(unique)
    const foundIds = new Set(found.map((v) => v.id))
    const missing = unique.filter((id) => !foundIds.has(id))
    if (missing.length) throw new VariantNotFoundError({ ids: missing })

    const assigned = found.filter((v) => v.isAssigned).map((v) => v.id)
    if (assigned.length) throw new VariantAlreadyAssignedError(assigned)

    return found
}