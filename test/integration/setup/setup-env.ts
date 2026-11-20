import {resolve} from "path";
import {existsSync, readFileSync} from "node:fs";

function loadTestEnv(): void {
    const envPath = resolve(process.cwd(), 'env/test/.env')
    if (!existsSync(envPath)) return

    const content = readFileSync(envPath, 'utf8')
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue

        const normalized = line.startsWith('export ') ? line.slice(7).trim() : line
        const eqIndex = normalized.indexOf('=')
        if (eqIndex === -1) continue

        const key = normalized.slice(0, eqIndex).trim()
        let value = normalized.slice(eqIndex + 1).trim()

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1)
        }

        if (process.env[key] === undefined) {
            process.env[key] = value
        }
    }
}

loadTestEnv()