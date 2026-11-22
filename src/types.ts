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
  id?: number
  name: string
  owner: string
  category: string
  region: string
  ownerAge?: number | null
  employeeCount?: number | null
  monthlyRevenue?: number | null
  storeInfo?: string | null
  address?: string | null
}

export interface AssistantResult {
  text: string
  customer?: {
    rating: number
    sentiment?: 'positive' | 'neutral' | 'negative'
    keywords: string[]
  }
  sources?: { title: string; url: string }[]
}
