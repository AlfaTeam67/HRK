export interface Recommendation {
  id: string
  title: string
  confidence: string
  summary: string
}

export interface NewsItem {
  id: string
  title: string
  source: string
  publishedAt: string
}

export type LlmProvider = 'OPENAI' | 'ANTHROPIC' | 'GEMINI'
