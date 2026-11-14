export type AssistantId = 'policy' | 'marketing' | 'customer' | 'sales'
export type PageId = 'dashboard' | AssistantId | 'history' | 'settings'
export type AppPage = 'intro' | 'login' | 'setup' | PageId

export interface Activity {
  id: string
  assistant: AssistantId
  title: string
  description: string
  createdAt: string
  content: string
  imageUrl?: string
}

export interface StoreProfile {
  name: string
  owner: string
  category: string
  region: string
}

export interface AssistantResult {
  text: string
  sources?: { title: string; url: string }[]
}
