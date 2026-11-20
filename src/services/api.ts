// Empty in local development: Vite forwards /api to Spring Boot.
// Static hosting uses the public backend origin, without an /api suffix.
const apiOrigin = (import.meta.env.VITE_API_BASE_URL?.trim() ?? '').replace(/\/+$/, '')

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiOrigin}${path}`, init)
}
