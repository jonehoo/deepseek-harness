import { useState, useEffect, useCallback } from 'react'
import {
  IconSettingsOutline16,
  IconCheckOutline14,
  IconRefreshOutline14,
} from '@deepseek-ai/dsh-client-ui-primitives'
import css from './LlmSettingsModal.module.css'
import {
  getAmbientLlm,
  getLlmConfig,
  saveLlmConfig,
  clearCustomLlmConfig,
  testLlmConnection,
  resolveEffectiveLlmConfig,
  type EffectiveLlmConfig,
  type AmbientDshLlm,
  type AmbientProviderItem,
} from './llmClient.ts'

export interface LlmSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onConfigSaved: (config: EffectiveLlmConfig) => void
}

interface ProviderSelectionItem {
  id: string
  displayName: string
  model: string
  baseURL: string
  apiKey: string
}

export function LlmSettingsModal({ isOpen, onClose, onConfigSaved }: LlmSettingsModalProps) {
  const [ambient, setAmbient] = useState<AmbientDshLlm | null>(null)
  const [selectedProviderId, setSelectedProviderId] = useState<string>('deepseek-official')
  const [apiKey, setApiKey] = useState<string>('')
  const [baseURL, setBaseURL] = useState<string>('https://api.deepseek.com')
  const [model, setModel] = useState<string>('deepseek-chat')

  const [testing, setTesting] = useState<boolean>(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Initialize and load current configs
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    void (async () => {
      const amb = await getAmbientLlm(true)
      if (cancelled) return
      setAmbient(amb)

      const saved = getLlmConfig()
      if (saved.apiKey && saved.apiKey.trim().length > 0) {
        setSelectedProviderId(saved.providerId || 'custom')
        setApiKey(saved.apiKey)
        setBaseURL(saved.baseURL)
        setModel(saved.model)
      } else if (amb && amb.configured) {
        setSelectedProviderId(amb.provider || 'deepseek-official')
        setApiKey(amb.apiKey)
        setBaseURL(amb.baseURL)
        setModel(amb.model)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen])

  const handleSelectProvider = useCallback((item: AmbientProviderItem | ProviderSelectionItem) => {
    setSelectedProviderId(item.id)
    setApiKey(item.apiKey || '')
    setBaseURL(item.baseURL || 'https://api.deepseek.com')
    setModel(item.model || 'deepseek-chat')
    setTestResult(null)
  }, [])

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    const res = await testLlmConnection({ apiKey, baseURL, model, providerId: selectedProviderId })
    setTesting(false)
    setTestResult({
      success: res.success,
      message: res.message,
    })
  }

  const handleSave = async () => {
    saveLlmConfig({
      apiKey: apiKey.trim(),
      baseURL: baseURL.trim(),
      model: model.trim(),
      providerId: selectedProviderId,
    })
    const effective = await resolveEffectiveLlmConfig()
    onConfigSaved(effective)
    onClose()
  }

  const handleResetToAmbient = async () => {
    clearCustomLlmConfig()
    if (ambient) {
      setSelectedProviderId(ambient.provider || 'deepseek-official')
      setApiKey(ambient.apiKey || '')
      setBaseURL(ambient.baseURL || 'https://api.deepseek.com')
      setModel(ambient.model || 'deepseek-chat')
    } else {
      setSelectedProviderId('deepseek-official')
      setApiKey('')
      setBaseURL('https://api.deepseek.com')
      setModel('deepseek-chat')
    }
    setTestResult(null)
    const effective = await resolveEffectiveLlmConfig()
    onConfigSaved(effective)
  }

  if (!isOpen) return null

  // Collect provider cards
  const providerList: Array<{ id: string; displayName: string; model: string; baseURL: string; apiKey: string; badge?: string }> = []

  // Add detected ambient providers
  if (ambient?.availableProviders && ambient.availableProviders.length > 0) {
    for (const p of ambient.availableProviders) {
      let badge = '已配置'
      if (p.id === 'mac') badge = '本地私有 · 免充值'
      if (p.id === 'deepseek-official') badge = '公网官方'
      providerList.push({
        id: p.id,
        displayName: p.displayName,
        model: p.model,
        baseURL: p.baseURL,
        apiKey: p.apiKey,
        badge,
      })
    }
  } else {
    providerList.push({
      id: 'deepseek-official',
      displayName: 'DeepSeek 官方底座',
      model: 'deepseek-chat',
      baseURL: 'https://api.deepseek.com',
      apiKey: ambient?.apiKey || '',
      badge: '公网官方',
    })
  }

  // Always offer custom option
  providerList.push({
    id: 'custom',
    displayName: '自定义 OpenAI 兼容接口',
    model: 'custom-model',
    baseURL: 'https://api.openai.com/v1',
    apiKey: '',
    badge: '自由定制',
  })

  return (
    <div className={css.modalBackdrop} onClick={onClose}>
      <div className={css.modalCard} onClick={e => e.stopPropagation()}>
        <div className={css.header}>
          <div className={css.titleGroup}>
            <div className={css.titleIcon}>
              <IconSettingsOutline16 size={20} />
            </div>
            <div>
              <h2 className={css.title}>数字人底座大模型与推理配置</h2>
              <p className={css.subtitle}>
                数字人全工序均由真实大模型实时流式推理驱动。可选择官方底座、本地免充值私有模型或自定义代理。
              </p>
            </div>
          </div>
          <button type="button" className={css.closeButton} onClick={onClose} aria-label="关闭">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={css.currentBadgeBar}>
          <div className={css.statusIndicator}>
            <span className={apiKey ? css.dot : css.dotWarning} />
            <span>
              当前激活模式：
              <strong style={{ color: '#f8fafc', marginLeft: '4px' }}>
                {selectedProviderId === 'mac'
                  ? 'MAC 本地大模型 (Qwen3.6-35B-A3B) · 免充值毫秒流式'
                  : selectedProviderId === 'deepseek-official'
                    ? 'DeepSeek 官方 API (deepseek-chat)'
                    : `自定义 [${selectedProviderId}]`}
              </strong>
            </span>
          </div>
          <span style={{ color: '#94a3b8' }}>
            {apiKey ? '凭据已装载' : '未配置凭据'}
          </span>
        </div>

        <div>
          <div className={css.sectionTitle}>快速选择可用模型引擎</div>
          <div className={css.providerList}>
            {providerList.map((p) => {
              const active = selectedProviderId === p.id
              return (
                <div
                  key={p.id}
                  className={`${css.providerCard} ${active ? css.providerCardActive : ''}`}
                  onClick={() => handleSelectProvider(p)}
                >
                  <div className={css.providerCardHeader}>
                    <span className={css.providerName}>{p.displayName}</span>
                    {p.badge && (
                      <span className={p.id === 'mac' ? css.providerTag : css.providerTagReady}>
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <div className={css.providerDetail}>
                    模型: {p.model}
                  </div>
                  <div className={css.providerDetail} style={{ opacity: 0.7 }}>
                    {p.baseURL}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className={css.formFields}>
          <div className={css.field}>
            <label className={css.label}>API 端点地址 (Base URL)</label>
            <input
              type="text"
              className={css.input}
              value={baseURL}
              onChange={e => setBaseURL(e.target.value)}
              placeholder="https://api.deepseek.com"
            />
          </div>

          <div className={css.field}>
            <label className={css.label}>模型标识 (Model)</label>
            <input
              type="text"
              className={css.input}
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="deepseek-chat 或 Qwen3.6-35B-A3B-uncensored"
            />
          </div>

          <div className={css.field}>
            <label className={css.label}>API 密钥 (API Key)</label>
            <input
              type="password"
              className={css.input}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>

          <div className={css.testBar}>
            <button
              type="button"
              className={css.testBtn}
              onClick={handleTestConnection}
              disabled={testing || !apiKey.trim()}
            >
              {testing ? (
                <>
                  <IconRefreshOutline14 size={13} />
                  <span>正在连通性测试...</span>
                </>
              ) : (
                <>
                  <IconRefreshOutline14 size={13} />
                  <span>测试连通性与余额</span>
                </>
              )}
            </button>

            {testResult && (
              <span className={`${css.testResult} ${testResult.success ? css.testSuccess : css.testError}`}>
                {testResult.success ? (
                  <IconCheckOutline14 size={14} />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
                <span>{testResult.message}</span>
              </span>
            )}
          </div>
        </div>

        <div className={css.footer}>
          <button type="button" className={css.resetBtn} onClick={handleResetToAmbient}>
            恢复底座默认配置
          </button>
          <div className={css.actionGroup}>
            <button type="button" className={css.cancelBtn} onClick={onClose}>
              取消
            </button>
            <button type="button" className={css.saveBtn} onClick={handleSave}>
              <IconCheckOutline14 size={14} />
              <span>保存并应用</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
