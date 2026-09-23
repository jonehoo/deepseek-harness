/**
 * Client-side LLM streaming connector for PM Studio & Trainer Studio.
 * Connects directly to DeepSeek, local high-performance engines (MAC / Zhijie), or compatible OpenAI endpoints.
 */

export interface LlmConfig {
  apiKey: string
  baseURL: string
  model: string
  providerId?: string
}

const STORAGE_KEY = 'dsh_opc_llm_config'

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  apiKey: '',
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  providerId: 'deepseek-official',
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
      providerId: parsed.providerId || DEFAULT_LLM_CONFIG.providerId,
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

export interface AmbientProviderItem {
  id: string
  displayName: string
  model: string
  baseURL: string
  apiKey: string
  configured: boolean
}

export interface AmbientDshLlm {
  configured: boolean
  provider: string
  model: string
  baseURL: string
  apiKey: string
  availableProviders?: AmbientProviderItem[]
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
  const manual = getLlmConfig()

  // If user explicitly configured custom settings in modal
  if (manual.apiKey && manual.apiKey.trim().length > 0) {
    let model = manual.model || 'deepseek-chat'
    if (manual.baseURL.includes('api.deepseek.com') && model === 'deepseek-flash') {
      model = 'deepseek-chat'
    }
    return {
      ...manual,
      model,
      source: 'custom',
      providerName: manual.providerId === 'custom' ? '用户自定义' : (manual.providerId || '自定义模型'),
    }
  }

  // Otherwise, query ambient config directly from DSH base environment
  const ambient = await getAmbientLlm()
  if (ambient && ambient.configured && ambient.apiKey) {
    let model = ambient.model || 'deepseek-chat'
    if ((ambient.baseURL || '').includes('api.deepseek.com') && model === 'deepseek-flash') {
      model = 'deepseek-chat'
    }
    return {
      apiKey: ambient.apiKey,
      baseURL: ambient.baseURL || 'https://api.deepseek.com',
      model,
      providerId: ambient.provider || 'deepseek-official',
      source: 'base',
      providerName: ambient.provider === 'deepseek-official' ? 'DeepSeek 官方底座' : (ambient.provider || 'DSH 底座模型'),
    }
  }

  return { ...DEFAULT_LLM_CONFIG, source: 'fallback', providerName: '未配置大模型凭据' }
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
 * Test connectivity and latency of an LLM configuration endpoint.
 */
export async function testLlmConnection(config: LlmConfig): Promise<{ success: boolean; latencyMs: number; message: string }> {
  const start = Date.now()
  const apiKey = config.apiKey.trim()
  if (!apiKey) {
    return { success: false, latencyMs: 0, message: '请先填写或选择 API Key' }
  }

  const endpoint = `${config.baseURL.replace(/\/+$/, '')}/chat/completions`
  let model = config.model.trim() || 'deepseek-chat'
  if (endpoint.includes('api.deepseek.com') && model === 'deepseek-flash') {
    model = 'deepseek-chat'
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: '测试连接' }],
        max_tokens: 3,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(8000),
    })

    const latencyMs = Date.now() - start
    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      let friendly = errorText
      try {
        const j = JSON.parse(errorText)
        if (j.error?.message) friendly = j.error.message
      } catch {}

      if (friendly.includes('Insufficient Balance') || response.status === 402) {
        return {
          success: false,
          latencyMs,
          message: 'API 账户余额不足 (Insufficient Balance)，请充值或切换至免充值本地底座',
        }
      }
      if (response.status === 401) {
        return { success: false, latencyMs, message: '认证失败 (401 Unauthorized)，API Key 无效' }
      }
      return { success: false, latencyMs, message: `调用异常 [HTTP ${response.status}]: ${friendly}` }
    }

    return { success: true, latencyMs, message: `连接成功 (耗时 ${latencyMs}ms)` }
  } catch (err: unknown) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Call DeepSeek / OpenAI-compatible chat completion endpoint with SSE streaming.
 * Supports standard delta.content as well as delta.reasoning_content (thinking models).
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  onChunk: (delta: string, accumulated: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const config = await resolveEffectiveLlmConfig()
  const apiKey = config.apiKey.trim()

  if (!apiKey) {
    throw new Error('未配置大模型 API Key。请点击右上角「模型配置」绑定底座凭据或选择本地模型。')
  }

  const endpoint = `${config.baseURL.replace(/\/+$/, '')}/chat/completions`
  let model = config.model || 'deepseek-chat'
  if (endpoint.includes('api.deepseek.com') && model === 'deepseek-flash') {
    model = 'deepseek-chat'
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.3,
    }),
    signal: signal ?? null,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    let userFriendly = errorText
    try {
      const errJson = JSON.parse(errorText)
      if (errJson.error?.message) {
        userFriendly = errJson.error.message
      }
    } catch {}

    if (userFriendly.includes('Insufficient Balance') || response.status === 402) {
      throw new Error('API 账户余额不足 (Insufficient Balance)。请前往服务商控制台充值，或在右上角切换至本地模型。')
    }
    if (response.status === 401) {
      throw new Error('API Key 无效或未授权 (401 Unauthorized)。请检查配置中的密钥。')
    }
    throw new Error(`模型调用异常 [HTTP ${response.status}]: ${userFriendly}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('无法读取模型返回的数据流 (Response body unreadable)')
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
            const delta = data.choices?.[0]?.delta
            // Support both standard content and reasoning_content
            const chunk = delta?.content || delta?.reasoning_content || ''
            if (chunk) {
              accumulated += chunk
              onChunk(chunk, accumulated)
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
