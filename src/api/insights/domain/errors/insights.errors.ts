import {ConflictError} from '@common/errors'

export class RefreshInProgressError extends ConflictError {
    constructor() {
        super({
            message: 'errors.insights.refreshInProgress',
            code: 'INSIGHTS_REFRESH_IN_PROGRESS'
        })
    }
}
