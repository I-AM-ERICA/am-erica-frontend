/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STAFF_IMAGE_BASE_URL?: string
  readonly VITE_API_MODE?: 'demo' | 'live'
  readonly VITE_NAVER_CLIENT_ID?: string
  readonly VITE_NAVER_REDIRECT_URI?: string
}
