import { AdminOrderListCriteria } from '@api/order/domain'

import { AdminListOrdersQuery } from '../dto'

export function toAdminOrderListCriteria(q: AdminListOrdersQuery): AdminOrderListCriteria {
  return {
    pageSize: q.pageSize,
    nextCursor: q.nextCursor,
    statuses: q.statuses,
    from: q.from,
    to: q.to,
    orderNumber: q.orderNumber,
  }
}
