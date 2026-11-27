import {expect} from '@jest/globals'

import {Api} from '../../util/api.util'
import {fakeFileStorage} from '../../util/fake-file-storage'

export const MB = 1024 * 1024
export const UPLOAD_URL = '/admin/settings/images/upload-url'

export const uploadSettingsImage = async (admin: Api, body: {contentType?: string; sizeBytes?: number} = {}) => {
    const payload = {contentType: 'image/webp', sizeBytes: 2048, ...body}
    const res = await admin.post(UPLOAD_URL, payload)
    expect(res.statusCode).toBe(200)
    const target = res.json().data as {
        key: string; method: string; url: string; headers: Record<string, string>; expiresInSeconds: number; publicUrl: string
    }
    fakeFileStorage.simulateUpload(target.key, {sizeBytes: payload.sizeBytes, contentType: payload.contentType})
    return target
}

export const putHero = (admin: Api, body: Record<string, unknown>) => admin.put('/admin/settings/hero', body)

export const publicSettings = async (api: Api) => {
    const res = await api.get('/settings')
    expect(res.statusCode).toBe(200)
    return res.json().data as {hero: {imageUrl: string | null; altText: string | null}}
}

export const adminSettings = async (admin: Api) => {
    const res = await admin.get('/admin/settings')
    expect(res.statusCode).toBe(200)
    return res.json().data as {hero: {imageKey: string | null; imageUrl: string | null; altText: string | null}}
}

export const resetHero = async (admin: Api) => {
    await putHero(admin, {altText: null})
    await admin.delete('/admin/settings/hero/image')
}
