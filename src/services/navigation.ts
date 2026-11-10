import type { AppPage } from '../types'

const pages: AppPage[] = ['intro', 'setup', 'dashboard', 'policy', 'marketing', 'customer', 'sales', 'history', 'settings']

export function readRoute(hash: string): AppPage {
  const route = hash.replace(/^#/, '') as AppPage
  return pages.includes(route) ? route : 'intro'
}

export function resolveRoute(route: AppPage, hasStore: boolean): AppPage {
  return route !== 'intro' && route !== 'setup' && !hasStore ? 'setup' : route
}
