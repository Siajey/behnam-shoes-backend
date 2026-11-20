import {Brand, Category} from '@api/product/domain'
import {UrlOf} from "./product.presenter";
import {UploadTarget} from "@common/storage";

const url = (key: string | null, urlOf: UrlOf) => (key ? urlOf(key) : null)

export interface CategoryNode {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
    children: CategoryNode[]
}

export class TaxonomyPresenter {
    static categoryTree(categories: Category[],urlOf: UrlOf): CategoryNode[] {
        const nodes = new Map<string, CategoryNode>(
            categories.map((c) => [
                c.id,
                {id: c.id, name: c.name, slug: c.slug, imageUrl: url(c.imageKey, urlOf), children: []},
            ]),
        )
        const roots: CategoryNode[] = []
        for (const c of categories) {
            const node = nodes.get(c.id) as CategoryNode
            const parent = c.parentId ? nodes.get(c.parentId) : undefined
            ;(parent ? parent.children : roots).push(node)
        }
        return roots
    }

    static adminCategory(c: Category, urlOf: UrlOf) {
        return {
            id: c.id,
            name: c.name,
            slug: c.slug,
            parentId: c.parentId,
            sortOrder: c.sortOrder,
            imageKey: c.imageKey,
            imageUrl: url(c.imageKey, urlOf),
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
        }
    }

    static publicBrand(b: Brand,urlOf: UrlOf) {
        return {
            id: b.id,
            name: b.name,
            slug: b.slug,
            logoKey: b.logoKey,
            logoUrl: url(b.logoKey, urlOf),
            imageUrl: url(b.imageKey ?? null, urlOf),
        }
    }

    static adminBrand(b: Brand, urlOf: UrlOf) {
        return {
            ...TaxonomyPresenter.publicBrand(b, urlOf),
            logoKey: b.logoKey,
            imageKey: b.imageKey,
            createdAt: b.createdAt.toISOString(),
            updatedAt: b.updatedAt.toISOString(),
        }
    }
    static uploadTarget(t: UploadTarget) {
        return {
            key: t.key,
            uploadUrl: t.url,
            method: t.method,
            fields: t.fields,
            headers: t.headers,
            expiresInSeconds: t.expiresInSeconds,
            publicUrl: t.publicUrl,
        }
    }
}