export interface UserSessionState {
    updatedAt: string
    status: string
    role: string
}

export interface ISessionCacheRepository {
  getUserSession(userId: string): Promise<UserSessionState | undefined>

  setUserSession(userId: string, data: UserSessionState): Promise<void>

  invalidateUserSession(userId: string): Promise<void>
}
