import { Brand, Category } from '@api/product/domain'

export interface CategoryNode {
    id: string
    name: string
    slug: string
    children: CategoryNode[]
}

export class TaxonomyPresenter {
    static categoryTree(categories: Category[]): CategoryNode[] {
        const nodes = new Map<string, CategoryNode>(
            categories.map((c) => [c.id, { id: c.id, name: c.name, slug: c.slug, children: [] }]),
        )
        const roots: CategoryNode[] = []
        for (const c of categories) {
            const node = nodes.get(c.id) as CategoryNode
            const parent = c.parentId ? nodes.get(c.parentId) : undefined
            ;(parent ? parent.children : roots).push(node)
        }
        return roots
    }

    static adminCategory(c: Category) {
        return {
            id: c.id,
            name: c.name,
            slug: c.slug,
            parentId: c.parentId,
            sortOrder: c.sortOrder,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
        }
    }

    static publicBrand(b: Brand) {
        return { id: b.id, name: b.name, slug: b.slug, logoKey: b.logoKey }
    }

    static adminBrand(b: Brand) {
        return {
            ...TaxonomyPresenter.publicBrand(b),
            createdAt: b.createdAt.toISOString(),
            updatedAt: b.updatedAt.toISOString(),
        }
    }
}