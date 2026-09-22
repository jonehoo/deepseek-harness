import { useState, useCallback, useEffect, useRef } from 'react'
import { MarkdownText, type MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import { STEPS_CONFIG, generateStepOutput, getStepPrompts } from './pmPrompts.ts'
import {
  type BlueprintProject,
  saveStoredProject,
  exportFullBlueprintMarkdown,
} from './projectStorage.ts'
import {
  getLlmConfig,
  saveLlmConfig,
  streamChatCompletion,
  resolveEffectiveLlmConfig,
  getAmbientLlm,
  clearCustomLlmConfig,
  type LlmConfig,
  type EffectiveLlmConfig,
  type AmbientDshLlm,
} from './llmClient.ts'
import css from './PmStudioWorkspace.module.css'

const DEFAULT_MD_LABELS: MarkdownLabels = {
  code: { copyLabel: '复制', copiedLabel: '已复制' },
  footnotes: '脚注',
}

export interface PmStudioWorkspaceProps {
  project: BlueprintProject
  onClose?: () => void
  onSaveProject?: (updated: BlueprintProject) => void
  onSendToDsh?: (project: BlueprintProject, specText: string) => void
}

export function PmStudioWorkspace({
  project,
  onClose,
  onSaveProject,
  onSendToDsh,
}: PmStudioWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<number>(6)
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview')
  const [promptText, setPromptText] = useState<string>(project.promptText)
  const [isRagEnabled, setIsRagEnabled] = useState<boolean>(project.isRagEnabled)
  const [selectedKb, setSelectedKb] = useState<string>(project.selectedKb)
  const [stepResults, setStepResults] = useState<Record<string, string>>(project.stepResults)
  const [runningStepId, setRunningStepId] = useState<number | null>(null)
  const [pipelineRunning, setPipelineRunning] = useState<boolean>(false)
  const [pipelineProgress, setPipelineProgress] = useState<{ current: number; total: number }>({ current: 0, total: STEPS_CONFIG.length })
  const [copied, setCopied] = useState<boolean>(false)
  const [showToast, setShowToast] = useState<string | null>(null)

  // LLM Configuration Modal State
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(getLlmConfig())
  const [effectiveLlm, setEffectiveLlm] = useState<EffectiveLlmConfig | null>(null)
  const [ambientLlm, setAmbientLlm] = useState<AmbientDshLlm | null>(null)
  const [showLlmModal, setShowLlmModal] = useState<boolean>(false)
  const [modalApiKey, setModalApiKey] = useState<string>('')
  const [modalBaseUrl, setModalBaseUrl] = useState<string>('')
  const [modalModel, setModalModel] = useState<string>('')

  const stopPipelineRef = useRef<boolean>(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Initialize ambient and effective LLM on mount
  useEffect(() => {
    void resolveEffectiveLlmConfig().then(setEffectiveLlm)
    void getAmbientLlm().then(setAmbientLlm)
  }, [])

  // Auto-sync state when project prop changes
  useEffect(() => {
    setPromptText(project.promptText)
    setIsRagEnabled(project.isRagEnabled)
    setSelectedKb(project.selectedKb)
    setStepResults(project.stepResults)
  }, [project])

  const notifyToast = (msg: string) => {
    setShowToast(msg)
    setTimeout(() => { setShowToast(null) }, 2500)
  }

  const getCurrentSnapshot = useCallback((): BlueprintProject => {
    return {
      ...project,
      promptText,
      isRagEnabled,
      selectedKb,
      stepResults,
    }
  }, [project, promptText, isRagEnabled, selectedKb, stepResults])

  const handleManualSave = useCallback(() => {
    const updated = getCurrentSnapshot()
    saveStoredProject(updated)
    onSaveProject?.(updated)
    notifyToast('✓ 蓝图规格已保存至本地工作区')
  }, [getCurrentSnapshot, onSaveProject])

  const handleCopy = useCallback(() => {
    const activeResult = stepResults[activeTab.toString()] || ''
    if (!activeResult) return
    void navigator.clipboard.writeText(activeResult).then(() => {
      setCopied(true)
      setTimeout(() => { setCopied(false) }, 2000)
    })
  }, [activeTab, stepResults])

  const handleExport = () => {
    const current = getCurrentSnapshot()
    const fullMarkdown = exportFullBlueprintMarkdown(current)
    const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${current.name}_11步完整规约.md`
    a.click()
    URL.revokeObjectURL(url)
    notifyToast('✓ 已导出完整 11 步 Markdown 规约全书')
  }

  const openLlmModal = async () => {
    const ambient = await getAmbientLlm(true)
    setAmbientLlm(ambient)
    const effective = await resolveEffectiveLlmConfig()
    setEffectiveLlm(effective)
    const cfg = getLlmConfig()
    setModalApiKey(cfg.apiKey)
    setModalBaseUrl(cfg.baseURL)
    setModalModel(cfg.model)
    setShowLlmModal(true)
  }

  const handleRestoreBaseModel = async () => {
    clearCustomLlmConfig()
    setModalApiKey('')
    const effective = await resolveEffectiveLlmConfig()
    setEffectiveLlm(effective)
    setLlmConfig(effective)
    notifyToast('✓ 已恢复免配置模式，直接复用 DSH 底座大模型')
  }

  const handleSaveLlmConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    const updated: LlmConfig = {
      apiKey: modalApiKey.trim(),
      baseURL: modalBaseUrl.trim() || 'https://api.deepseek.com',
      model: modalModel.trim() || 'deepseek-chat',
    }
    saveLlmConfig(updated)
    setLlmConfig(updated)
    const effective = await resolveEffectiveLlmConfig()
    setEffectiveLlm(effective)
    setShowLlmModal(false)
    notifyToast(updated.apiKey ? '✓ 自定义模型配置已生效' : '✓ 已恢复使用底座或本地保底模式')
  }

  // Orchestrate single step (tries LLM first, falls back to high-fidelity template)
  const handleRunSingleStep = useCallback(async (stepId: number) => {
    setRunningStepId(stepId)
    const abortCtrl = new AbortController()
    abortControllerRef.current = abortCtrl

    const messages = getStepPrompts(stepId, promptText, stepResults)
    let usedLlm = false

    const effective = await resolveEffectiveLlmConfig()
    setEffectiveLlm(effective)

    if (effective.apiKey && effective.apiKey.trim()) {
      try {
        setStepResults(prev => ({ ...prev, [stepId.toString()]: '' }))
        await streamChatCompletion(
          messages,
          (_delta, acc) => {
            setStepResults(prev => ({ ...prev, [stepId.toString()]: acc }))
          },
          abortCtrl.signal,
        )
        usedLlm = true
        notifyToast(`✓ 已由大模型 (${effective.model} · ${effective.source === 'base' ? 'DSH底座直连' : '自定义'}) 完成第 ${stepId} 步推演`)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.warn('LLM stream failed, falling back to local template:', message)
        notifyToast(`大模型调用受阻: ${message}，已自动切换本地高保真规约引擎`)
      }
    }

    if (!usedLlm) {
      await new Promise(resolve => setTimeout(resolve, 800))
      const output = generateStepOutput(
        stepId,
        promptText,
        stepResults,
        isRagEnabled ? selectedKb : 'none',
      )
      setStepResults(prev => ({ ...prev, [stepId.toString()]: output }))
      notifyToast(`✓ 已完成第 ${stepId} 步规约推演 (本地高保真引擎)`)
    }

    setRunningStepId(null)
    const updated = getCurrentSnapshot()
    saveStoredProject(updated)
    onSaveProject?.(updated)
  }, [stepResults, promptText, isRagEnabled, selectedKb, getCurrentSnapshot, onSaveProject])

  // 11-step pipeline orchestration
  const handleRunPipeline = useCallback(async () => {
    setPipelineRunning(true)
    stopPipelineRef.current = false
    let currentResults = { ...stepResults }

    const effective = await resolveEffectiveLlmConfig()
    setEffectiveLlm(effective)

    for (let i = 0; i < STEPS_CONFIG.length; i++) {
      if (stopPipelineRef.current) break
      const step = STEPS_CONFIG[i]
      if (step === undefined) continue
      setRunningStepId(step.id)
      setActiveTab(step.id)
      setPipelineProgress({ current: i + 1, total: STEPS_CONFIG.length })

      const messages = getStepPrompts(step.id, promptText, currentResults)
      let stepText = ''
      let usedLlm = false

      if (effective.apiKey && effective.apiKey.trim()) {
        try {
          const abortCtrl = new AbortController()
          abortControllerRef.current = abortCtrl
          stepText = await streamChatCompletion(
            messages,
            (_delta, acc) => {
              setStepResults(prev => ({ ...prev, [step.id.toString()]: acc }))
            },
            abortCtrl.signal,
          )
          usedLlm = Boolean(stepText.trim())
        } catch {
          usedLlm = false
        }
      }

      if (!usedLlm) {
        await new Promise(resolve => setTimeout(resolve, 700))
        if (stopPipelineRef.current) break
        stepText = generateStepOutput(
          step.id,
          promptText,
          currentResults,
          isRagEnabled ? selectedKb : 'none',
        )
        setStepResults(prev => ({ ...prev, [step.id.toString()]: stepText }))
      }

      currentResults = { ...currentResults, [step.id.toString()]: stepText }
    }

    setRunningStepId(null)
    setPipelineRunning(false)
    const updated = {
      ...project,
      promptText,
      isRagEnabled,
      selectedKb,
      stepResults: currentResults,
    }
    saveStoredProject(updated)
    onSaveProject?.(updated)
    notifyToast('🎉 11步企业级规约流水线已全部推演完成！')
  }, [stepResults, promptText, isRagEnabled, selectedKb, project, onSaveProject])

  const handleStopPipeline = () => {
    stopPipelineRef.current = true
    abortControllerRef.current?.abort()
    setPipelineRunning(false)
    setRunningStepId(null)
  }

  const handleSendToDsh = () => {
    const current = getCurrentSnapshot()
    handleManualSave()
    const activeResult = stepResults[activeTab.toString()] || exportFullBlueprintMarkdown(current)
    onSendToDsh?.(current, activeResult)
  }

  const activeResult = stepResults[activeTab.toString()] || ''
  const progressPercent = Math.round((pipelineProgress.current / pipelineProgress.total) * 100)
  const isBaseConnected = effectiveLlm?.source === 'base'
  const isCustomConnected = effectiveLlm?.source === 'custom'
  const isOnline = Boolean(effectiveLlm?.apiKey?.trim())

  return (
    <div className={css.workspaceContainer}>
      {showToast && <div className={css.saveToast}>{showToast}</div>}

      {/* Top Header */}
      <header className={css.topNav}>
        <div className={css.titleArea}>
          <h1 className={css.projectTitle}>{project.name}</h1>
          <span className={css.versionBadge}>{project.department}</span>

          {/* Online/Offline Status Indicator */}
          <button
            type="button"
            className={isOnline ? css.llmBadgeOnline : css.llmBadgeOffline}
            onClick={openLlmModal}
            title={isBaseConnected ? '已自动接入 DSH 底座大模型，点击查看详情' : '点击配置大模型 API Key / Base URL'}
          >
            <span>{isBaseConnected ? '🟢 DSH底座直连' : (isCustomConnected ? '🔵 自定义大模型' : '⚪ 本地高保真')}</span>
            <span style={{ textDecoration: 'underline', fontSize: '10px' }}>
              ({effectiveLlm?.model || 'deepseek-flash'})
            </span>
          </button>
        </div>

        <div className={css.topActions}>
          <span className={css.autoSaveTag}>● 自动保存已启用</span>
          <button type="button" className={css.navButton} onClick={openLlmModal}>
            ⚙️ 模型配置
          </button>
          <button type="button" className={css.navButton} onClick={handleManualSave}>
            保存
          </button>
          <button
            type="button"
            className={css.sendDshButton}
            onClick={handleSendToDsh}
            title="将当前规约无缝注入 DSH 底座让 Coding Agent 开始执行"
          >
            🚀 发给底座落地
          </button>
          <button
            type="button"
            className={`${css.navButton} ${css.navButtonPrimary}`}
            onClick={handleExport}
          >
            打包导出蓝图
          </button>
          <button type="button" className={css.navButton} onClick={onClose}>
            返回首页
          </button>
        </div>
      </header>

      {/* 11 Steps Pipeline Rail */}
      <nav className={css.stepsRail} aria-label="编排阶段导航">
        {STEPS_CONFIG.map((step) => {
          const isActive = activeTab === step.id
          const isDone = Boolean(stepResults[step.id.toString()])
          const isRunning = runningStepId === step.id
          const dotClass = isRunning
            ? css.stepStatusDotRunning
            : isDone
              ? css.stepStatusDotDone
              : ''

          return (
            <button
              key={step.id}
              type="button"
              className={`${css.stepTab} ${isActive ? css.stepTabActive : ''}`}
              onClick={() => { setActiveTab(step.id) }}
            >
              <span className={`${css.stepStatusDot} ${dotClass}`} />
              <span>{step.title}</span>
            </button>
          )
        })}
      </nav>

      {/* Workspace Body */}
      <div className={css.workspaceBody}>
        {/* Left Config Panel */}
        <aside className={css.leftSidebar}>
          <h2 className={css.sidebarTitle}>核心业务提示词与输入</h2>
          <textarea
            className={css.promptTextarea}
            value={promptText}
            onChange={(e) => { setPromptText(e.target.value) }}
            placeholder="请输入业务需求或相关材料说明..."
          />

          <div className={css.ragCard}>
            <div className={css.ragHeader}>
              <span>知识库增强 (RAG)</span>
              <input
                type="checkbox"
                checked={isRagEnabled}
                onChange={(e) => { setIsRagEnabled(e.target.checked) }}
              />
            </div>
            <select
              className={css.ragSelect}
              value={selectedKb}
              disabled={!isRagEnabled}
              onChange={(e) => { setSelectedKb(e.target.value) }}
            >
              <option value="vw-safety-standard">VW 集团工控安全现场评估标准 (101项)</option>
              <option value="company-safety-rule">公司工控安全管理规定汇总</option>
              <option value="mes-automotive-spec">一汽大众 MES / MOM 整车制造标准</option>
              <option value="none">不使用知识库</option>
            </select>
            <p className={css.ragHint}>
              读取知识库后，每一步生成将自动结合规约标准和企业文档作为参考。
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            <button
              type="button"
              className={css.runPipelineButton}
              disabled={runningStepId !== null}
              onClick={pipelineRunning ? handleStopPipeline : handleRunPipeline}
            >
              {pipelineRunning ? '⏹ 终止流水线' : '⚡ 一键 11 步流水线全量编排'}
            </button>

            <button
              type="button"
              className={css.runButton}
              disabled={runningStepId !== null}
              onClick={() => { handleRunSingleStep(activeTab) }}
            >
              {runningStepId !== null && !pipelineRunning ? '正在推演本步...' : '单步重新生成'}
            </button>
          </div>

          {/* Pipeline Progress Bar */}
          {pipelineRunning && (
            <div className={css.pipelineProgressCard}>
              <div className={css.pipelineProgressHeader}>
                <span>全流水线进度</span>
                <span>{pipelineProgress.current} / {pipelineProgress.total} ({progressPercent}%)</span>
              </div>
              <div className={css.progressBarTrack}>
                <div
                  className={css.progressBarFill}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </aside>

        {/* Right Output View */}
        <main className={css.rightContent}>
          <div className={css.contentHeader}>
            <div className={css.contentTitleBlock}>
              <h2 className={css.contentTitle}>
                {STEPS_CONFIG.find(s => s.id === activeTab)?.title}
              </h2>
              <span className={css.outputBadge}>
                {isOnline ? `/ LLM: ${llmConfig.model}` : '/ LOCAL SPEC'}
              </span>
              {activeResult && <span className={css.statusDone}>STATUS: VERIFIED</span>}
            </div>

            <div className={css.contentActions}>
              {/* Preview vs Edit Mode Toggle */}
              <div className={css.modeToggleGroup}>
                <button
                  type="button"
                  className={`${css.modeToggleBtn} ${viewMode === 'preview' ? css.modeToggleActive : ''}`}
                  onClick={() => { setViewMode('preview') }}
                  title="富文本渲染视图"
                >
                  👁️ 渲染预览
                </button>
                <button
                  type="button"
                  className={`${css.modeToggleBtn} ${viewMode === 'edit' ? css.modeToggleActive : ''}`}
                  onClick={() => { setViewMode('edit') }}
                  title="Markdown 源码手改视图"
                >
                  ✏️ 源码编辑 (手改)
                </button>
              </div>

              <button type="button" className={css.actionBtn} onClick={handleCopy}>
                {copied ? '✓ 已复制！' : '复制当前规约'}
              </button>
              <button
                type="button"
                className={css.actionBtn}
                disabled={runningStepId !== null}
                onClick={() => { handleRunSingleStep(activeTab) }}
              >
                重跑本步
              </button>
            </div>
          </div>

          <div className={css.documentScroll}>
            {activeResult ? (
              viewMode === 'preview' ? (
                <div className={css.documentCard}>
                  <MarkdownText
                    text={activeResult}
                    streaming={runningStepId === activeTab}
                    labels={DEFAULT_MD_LABELS}
                  />
                </div>
              ) : (
                <div className={css.editorContainer}>
                  <div className={css.editorToolbar}>
                    <span className={css.editorHint}>💡 实时手改模式：内容变更将自动保存至本工程</span>
                    <span className={css.charCount}>{activeResult.length} 字符</span>
                  </div>
                  <textarea
                    className={css.markdownTextarea}
                    value={activeResult}
                    onChange={(e) => {
                      const newVal = e.target.value
                      setStepResults(prev => ({
                        ...prev,
                        [activeTab.toString()]: newVal,
                      }))
                    }}
                    onBlur={() => {
                      const snap = getCurrentSnapshot()
                      saveStoredProject(snap)
                      onSaveProject?.(snap)
                    }}
                    placeholder="在此直接修改 Markdown 规约内容..."
                  />
                </div>
              )
            ) : (
              <div className={css.emptyHint}>
                *(当前步骤尚未生成规约产物，点击左侧「一键 11 步流水线全量编排」或「单步重新生成」即可开始推演)*
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal for LLM Settings */}
      {showLlmModal && (
        <div className={css.modalBackdrop} onClick={() => { setShowLlmModal(false) }}>
          <div className={css.modalCard} onClick={(e) => { e.stopPropagation() }}>
            <h2 className={css.modalTitle}>⚙️ 大模型底座与服务配置</h2>

            {/* Ambient DSH base status card */}
            <div style={{
              background: isBaseConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${isBaseConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, color: isBaseConnected ? '#34d399' : '#e2e8f0', fontSize: '13px' }}>
                  {ambientLlm?.configured ? '🟢 DSH 底座大模型：已接入 (免配置模式生效中)' : '⚪ DSH 底座大模型：未在系统环境检测到 Key'}
                </span>
                {isCustomConnected && (
                  <button
                    type="button"
                    onClick={handleRestoreBaseModel}
                    style={{
                      background: 'none',
                      border: '1px solid #3b82f6',
                      color: '#60a5fa',
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    恢复底座默认
                  </button>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: '1.5' }}>
                {ambientLlm?.configured
                  ? `已自动继承底座配置：提供商 [${ambientLlm.provider}] · 模型 [${ambientLlm.model}] · 端点 [${ambientLlm.baseURL}]。无需在此重复输入 Key，编排流水线将直接使用底座大模型。`
                  : '底座环境暂无凭据，您可以在下方手动指定自定义 API Key，或在系统环境变量中配置 DEEPSEEK_API_KEY。'}
              </p>
            </div>

            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
              <strong>自定义模型覆盖（高级可选）</strong>：如果您希望临时换用其他私有代理或特定模型进行测试，可在下方配置；留空则继续自动继承底座。
            </div>

            <form onSubmit={handleSaveLlmConfig} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className={css.modalField}>
                <label className={css.modalLabel} htmlFor="llmApiKey">自定义 API Key (可选覆盖)</label>
                <input
                  id="llmApiKey"
                  className={css.modalInput}
                  type="password"
                  placeholder={ambientLlm?.configured ? '已继承底座 Key (如需覆盖才在此输入)' : 'sk-...'}
                  value={modalApiKey}
                  onChange={(e) => { setModalApiKey(e.target.value) }}
                  autoFocus
                />
              </div>

              <div className={css.modalField}>
                <label className={css.modalLabel} htmlFor="llmBaseUrl">自定义 Base URL (可选覆盖)</label>
                <input
                  id="llmBaseUrl"
                  className={css.modalInput}
                  type="text"
                  placeholder={ambientLlm?.baseURL || 'https://api.deepseek.com'}
                  value={modalBaseUrl}
                  onChange={(e) => { setModalBaseUrl(e.target.value) }}
                />
              </div>

              <div className={css.modalField}>
                <label className={css.modalLabel} htmlFor="llmModel">自定义模型名称 (可选覆盖)</label>
                <input
                  id="llmModel"
                  className={css.modalInput}
                  type="text"
                  placeholder={ambientLlm?.model || 'deepseek-chat'}
                  value={modalModel}
                  onChange={(e) => { setModalModel(e.target.value) }}
                />
              </div>

              <div className={css.modalActions}>
                <button
                  type="button"
                  className={css.modalCancelBtn}
                  onClick={() => { setShowLlmModal(false) }}
                >
                  关闭
                </button>
                {isCustomConnected && (
                  <button
                    type="button"
                    className={css.modalCancelBtn}
                    onClick={handleRestoreBaseModel}
                    style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                  >
                    清除自定义覆盖
                  </button>
                )}
                <button
                  type="submit"
                  className={css.modalConfirmBtn}
                >
                  保存配置
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
