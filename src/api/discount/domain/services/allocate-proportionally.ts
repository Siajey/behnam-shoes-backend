export function allocateProportionally(total: number, weights: readonly number[]): number[] {
    const sum = weights.reduce((a, w) => a + w, 0)
    if (total <= 0 || sum <= 0) return weights.map(() => 0)

    const big = (n: number) => BigInt(n)
    const parts = weights.map((w) => {
        const product = big(total) * big(w)
        return { base: product / big(sum), remainder: product % big(sum) }
    })

    const allocated = parts.reduce((a, p) => a + p.base, BigInt(0))
    const leftover = Number(big(total) - allocated)

    const order = parts
        .map((_, i) => i)
        .sort((a, b) =>
            parts[b].remainder > parts[a].remainder ? 1 : parts[b].remainder < parts[a].remainder ? -1 : a - b,
        )

    const result = parts.map((p) => Number(p.base))
    for (let k = 0; k < leftover; k++) result[order[k]] += 1
    return result
}