export type NotificationType = 'error' | 'warning' | 'info'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  description?: string
}

type Subscriber = (n: AppNotification) => void

let _subscriber: Subscriber | null = null

export function registerSubscriber(fn: Subscriber | null): void {
  _subscriber = fn
}

export function notify(params: Omit<AppNotification, 'id'>): void {
  _subscriber?.({ ...params, id: Math.random().toString(36).slice(2) })
}
