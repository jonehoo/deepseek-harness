/**
 * Client-side LLM streaming connector for PM Studio.
 * Connects directly to DeepSeek or compatible OpenAI-standard LLM endpoints.
 */

export interface LlmConfig {
  apiKey: string
  baseURL: string
  model: string
}

const STORAGE_KEY = 'dsh_opc_llm_config'

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  apiKey: '',
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-chat',
}

export function getLlmConfig(): LlmConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_LLM_CONFIG
    const parsed = JSON.parse(raw) as Partial<LlmConfig>
    return {
      apiKey: parsed.apiKey || '',
      baseURL: parsed.baseURL || DEFAULT_LLM_CONFIG.baseURL,
      model: parsed.model || DEFAULT_LLM_CONFIG.model,
    }
  } catch {
    return DEFAULT_LLM_CONFIG
  }
}

export function saveLlmConfig(cfg: LlmConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  } catch (err) {
    console.error('Failed to save LLM config', err)
  }
}

export interface AmbientDshLlm {
  configured: boolean
  provider: string
  model: string
  baseURL: string
  apiKey: string
}

declare global {
  interface Window {
    dshAmbientLlm?: {
      getConfig(): Promise<AmbientDshLlm>
    }
  }
}

let cachedAmbientLlm: AmbientDshLlm | null = null

export async function getAmbientLlm(forceRefresh = false): Promise<AmbientDshLlm | null> {
  if (cachedAmbientLlm && !forceRefresh) return cachedAmbientLlm
  if (typeof window !== 'undefined' && window.dshAmbientLlm?.getConfig) {
    try {
      const res = await window.dshAmbientLlm.getConfig()
      if (res && res.configured) {
        cachedAmbientLlm = res
        return res
      }
    } catch (e) {
      console.warn('dshAmbientLlm query error:', e)
    }
  }
  return null
}

export interface EffectiveLlmConfig extends LlmConfig {
  source: 'base' | 'custom' | 'fallback'
  providerName?: string
}

export async function resolveEffectiveLlmConfig(): Promise<EffectiveLlmConfig> {
  // 1. Check if user configured an explicit custom key in localStorage
  const manual = getLlmConfig()
  if (manual.apiKey && manual.apiKey.trim().length > 0) {
    return { ...manual, source: 'custom', providerName: '用户自定义' }
  }

  // 2. Query ambient config directly from DSH base!
  const ambient = await getAmbientLlm()
  if (ambient && ambient.configured && ambient.apiKey) {
    return {
      apiKey: ambient.apiKey,
      baseURL: ambient.baseURL || 'https://api.deepseek.com',
      model: ambient.model || 'deepseek-chat',
      source: 'base',
      providerName: ambient.provider || 'DSH 底座模型',
    }
  }

  return { ...DEFAULT_LLM_CONFIG, source: 'fallback', providerName: '本地专业模板引擎' }
}

export function clearCustomLlmConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Call DeepSeek / OpenAI-compatible chat completion endpoint with SSE streaming.
 * @param messages System and user prompt messages
 * @param onChunk Callback for each incremental text token
 * @param signal Cancellation signal
 * @returns Complete generated response text
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  onChunk: (delta: string, accumulated: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const config = await resolveEffectiveLlmConfig()
  const apiKey = config.apiKey.trim()

  if (!apiKey) {
    throw new Error('MISSING_API_KEY')
  }

  const endpoint = `${config.baseURL.replace(/\/+$/, '')}/chat/completions`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'deepseek-chat',
      messages,
      stream: true,
      temperature: 0.3,
    }),
    signal: signal ?? null,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`LLM_API_ERROR: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('RESPONSE_BODY_UNREADABLE')
  }

  const decoder = new TextDecoder('utf-8')
  let accumulated = ''
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) break
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) continue
        if (trimmed === 'data: [DONE]') return accumulated

        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6))
            const delta = data.choices?.[0]?.delta?.content || ''
            if (delta) {
              accumulated += delta
              onChunk(delta, accumulated)
            }
          } catch {
            // Ignore parse errors on partial chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return accumulated
}
