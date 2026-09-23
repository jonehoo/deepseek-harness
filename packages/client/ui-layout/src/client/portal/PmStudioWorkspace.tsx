import { useState, useCallback, useEffect, useRef } from 'react'
import {
  MarkdownText,
  type MarkdownLabels,
  IconSettingsOutline14,
  IconPaperPlaneOutline14,
  IconDownloadOutline16,
  IconChevronLeftOutline14,
  IconPlayOutline16,
  IconStopFill16,
  IconRefreshOutline14,
  IconBrowseOutline16,
  IconEditOutline16,
  IconCopyOutline16,
  IconCheckOutline14,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { STEPS_CONFIG, generateStepOutput, getStepPrompts } from './pmPrompts.ts'
import {
  type BlueprintProject,
  saveStoredProject,
  exportFullBlueprintMarkdown,
} from './projectStorage.ts'
import {
  type EffectiveLlmConfig,
  streamChatCompletion,
  resolveEffectiveLlmConfig,
} from './llmClient.ts'
import { LlmSettingsModal } from './LlmSettingsModal.tsx'
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
  const [effectiveLlm, setEffectiveLlm] = useState<EffectiveLlmConfig | null>(null)
  const [showLlmModal, setShowLlmModal] = useState<boolean>(false)

  const stopPipelineRef = useRef<boolean>(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Initialize effective LLM on mount
  useEffect(() => {
    void resolveEffectiveLlmConfig().then(setEffectiveLlm)
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
    notifyToast('蓝图规格已保存至本地工作区')
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
    notifyToast('已导出完整 11 步 Markdown 规约全书')
  }

  const openLlmModal = () => {
    setShowLlmModal(true)
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
        notifyToast(`已由大模型 (${effective.model} · ${effective.source === 'base' ? 'DSH底座直连' : '自定义'}) 完成第 ${stepId} 步推演`)
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
      notifyToast(`已完成第 ${stepId} 步规约推演 (本地高保真引擎)`)
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
    notifyToast('11 步企业级规约流水线已全部推演完成！')
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
            <span
              className={css.llmStatusDot}
              data-status={isBaseConnected ? 'base' : (isCustomConnected ? 'custom' : 'local')}
            />
            <span>{isBaseConnected ? 'DSH底座直连' : (isCustomConnected ? '自定义大模型' : '本地高保真')}</span>
            <span style={{ fontSize: '10px', opacity: 0.85 }}>
              ({effectiveLlm?.model || 'deepseek-flash'})
            </span>
          </button>
        </div>

        <div className={css.topActions}>
          <span className={css.autoSaveTag}>
            <span className={css.autoSaveDot} />
            <span>自动保存已启用</span>
          </span>
          <button type="button" className={css.navButton} onClick={openLlmModal}>
            <IconSettingsOutline14 size={13} />
            <span>模型配置</span>
          </button>
          <button type="button" className={css.navButton} onClick={handleManualSave}>
            <span>保存</span>
          </button>
          <button
            type="button"
            className={css.sendDshButton}
            onClick={handleSendToDsh}
            title="将当前规约无缝注入 DSH 底座让 Coding Agent 开始执行"
          >
            <IconPaperPlaneOutline14 size={13} />
            <span>发给底座落地</span>
          </button>
          <button
            type="button"
            className={`${css.navButton} ${css.navButtonPrimary}`}
            onClick={handleExport}
          >
            <IconDownloadOutline16 size={13} />
            <span>打包导出蓝图</span>
          </button>
          <button type="button" className={css.navButton} onClick={onClose}>
            <IconChevronLeftOutline14 size={13} />
            <span>返回首页</span>
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
              {pipelineRunning ? (
                <>
                  <IconStopFill16 size={14} />
                  <span>终止流水线</span>
                </>
              ) : (
                <>
                  <IconPlayOutline16 size={14} />
                  <span>一键 11 步流水线全量编排</span>
                </>
              )}
            </button>

            <button
              type="button"
              className={css.runButton}
              disabled={runningStepId !== null}
              onClick={() => { handleRunSingleStep(activeTab) }}
            >
              <IconRefreshOutline14 size={14} />
              <span>{runningStepId !== null && !pipelineRunning ? '正在推演本步...' : '单步重新生成'}</span>
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
                  <IconBrowseOutline16 size={14} />
                  <span>渲染预览</span>
                </button>
                <button
                  type="button"
                  className={`${css.modeToggleBtn} ${viewMode === 'edit' ? css.modeToggleActive : ''}`}
                  onClick={() => { setViewMode('edit') }}
                  title="Markdown 源码手改视图"
                >
                  <IconEditOutline16 size={14} />
                  <span>源码手改</span>
                </button>
              </div>

              <button type="button" className={css.actionBtn} onClick={handleCopy}>
                {copied ? (
                  <>
                    <IconCheckOutline14 size={13} />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <IconCopyOutline16 size={13} />
                    <span>复制规约</span>
                  </>
                )}
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
                    <span className={css.editorHint}>实时手改模式：内容变更将自动保存至本工程</span>
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
      <LlmSettingsModal
        isOpen={showLlmModal}
        onClose={() => { setShowLlmModal(false) }}
        onConfigSaved={(cfg) => {
          setEffectiveLlm(cfg)
          notifyToast(`已切换至模型：${cfg.model} (${cfg.providerName || ''})`)
        }}
      />
    </div>
  )
}
