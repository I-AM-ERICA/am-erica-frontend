import type { AppPage } from '../types'

const pages: AppPage[] = ['intro', 'login', 'setup', 'dashboard', 'policy', 'marketing', 'customer', 'sales', 'history', 'settings']

export function readRoute(hash: string): AppPage {
  const route = hash.replace(/^#/, '') as AppPage
  return pages.includes(route) ? route : 'intro'
}

export function resolveRoute(route: AppPage, hasStore: boolean, isAuthenticated: boolean): AppPage {
  if (route === 'intro') return route
  if (!isAuthenticated) return 'login'
  if (route === 'login') return hasStore ? 'dashboard' : 'setup'
  return route !== 'setup' && !hasStore ? 'setup' : route
}
