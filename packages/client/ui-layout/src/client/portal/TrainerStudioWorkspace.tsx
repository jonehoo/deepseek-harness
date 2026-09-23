import { useState, useCallback, useEffect, useRef } from 'react'
import {
  MarkdownText,
  type MarkdownLabels,
  IconSettingsOutline16,
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
import {
  TRAINER_STEPS_CONFIG,
  generateTrainerStepOutput,
  getTrainerStepPrompts,
  type TrainerCourseMeta,
} from './trainerPrompts.ts'
import {
  type BlueprintProject,
  saveStoredProject,
  exportFullTrainerCoursewareMarkdown,
} from './projectStorage.ts'
import {
  type EffectiveLlmConfig,
  streamChatCompletion,
  resolveEffectiveLlmConfig,
} from './llmClient.ts'
import { LlmSettingsModal } from './LlmSettingsModal.tsx'
import css from './TrainerStudioWorkspace.module.css'

const DEFAULT_MD_LABELS: MarkdownLabels = {
  code: { copyLabel: '复制', copiedLabel: '已复制' },
  footnotes: '脚注',
}

export interface TrainerStudioWorkspaceProps {
  project: BlueprintProject
  onClose?: () => void
  onSaveProject?: (updated: BlueprintProject) => void
  onSendToDsh?: (project: BlueprintProject, coursewareText: string) => void
}

export function TrainerStudioWorkspace({
  project,
  onClose,
  onSaveProject,
  onSendToDsh,
}: TrainerStudioWorkspaceProps) {
  const [activeStepId, setActiveStepId] = useState<string>('t1_outline')
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview')

  const [courseMeta, setCourseMeta] = useState<TrainerCourseMeta>(() => {
    return (
      project.trainerMeta || {
        title: `${project.name}实操认证培训`,
        industry: '汽车工业 / 智能制造',
        targetAudience: '车间班组长、工艺工程师、工控协调员',
        durationMinutes: 120,
        stylePreset: '专业科技蓝',
      }
    )
  })

  const [stepResults, setStepResults] = useState<Record<string, string>>(() => {
    return project.trainerStepResults || {}
  })

  const [runningStepId, setRunningStepId] = useState<string | null>(null)
  const [pipelineRunning, setPipelineRunning] = useState<boolean>(false)
  const [pipelineProgress, setPipelineProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: TRAINER_STEPS_CONFIG.length,
  })
  const [showToast, setShowToast] = useState<string | null>(null)

  // LLM Configuration & Status State
  const [effectiveLlm, setEffectiveLlm] = useState<EffectiveLlmConfig | null>(null)
  const [showLlmModal, setShowLlmModal] = useState<boolean>(false)
  const [llmError, setLlmError] = useState<string | null>(null)

  const stopPipelineRef = useRef<boolean>(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Initialize effective LLM on mount
  useEffect(() => {
    void resolveEffectiveLlmConfig().then(setEffectiveLlm)
  }, [])

  // Auto-sync when project prop updates
  useEffect(() => {
    if (project.trainerMeta) {
      setCourseMeta(project.trainerMeta)
    }
    if (project.trainerStepResults) {
      setStepResults(project.trainerStepResults)
    }
  }, [project])

  const notifyToast = (msg: string) => {
    setShowToast(msg)
    setTimeout(() => {
      setShowToast(null)
    }, 2500)
  }

  const getCurrentSnapshot = useCallback((): BlueprintProject => {
    return {
      ...project,
      trainerMeta: courseMeta,
      trainerStepResults: stepResults,
      updatedAt: formatNow(),
    }
  }, [project, courseMeta, stepResults])

  // Save changes to storage and parent
  const persistChanges = useCallback(
    (newResults: Record<string, string>, newMeta = courseMeta) => {
      const updated: BlueprintProject = {
        ...project,
        trainerMeta: newMeta,
        trainerStepResults: newResults,
        updatedAt: formatNow(),
      }
      saveStoredProject(updated)
      onSaveProject?.(updated)
    },
    [project, courseMeta, onSaveProject],
  )

  const handleMetaChange = (field: keyof TrainerCourseMeta, value: string | number) => {
    const nextMeta = { ...courseMeta, [field]: value }
    setCourseMeta(nextMeta)
    persistChanges(stepResults, nextMeta)
  }

  const handleContentEdit = (text: string) => {
    const nextResults = { ...stepResults, [activeStepId]: text }
    setStepResults(nextResults)
    persistChanges(nextResults)
  }

  // Execute a single step with real LLM streaming
  const runStep = async (stepId: string) => {
    if (runningStepId !== null) return

    setRunningStepId(stepId)
    setActiveStepId(stepId)
    setLlmError(null)
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    // Clear current step content for streaming
    setStepResults(prev => ({ ...prev, [stepId]: '' }))

    const promptMessages = getTrainerStepPrompts(
      stepId,
      project.promptText,
      courseMeta,
      stepResults,
    )

    let accumulated = ''
    try {
      await streamChatCompletion(
        promptMessages,
        (delta) => {
          accumulated += delta
          setStepResults(prev => ({ ...prev, [stepId]: accumulated }))
        },
        abortController.signal,
      )

      const finalResults = { ...stepResults, [stepId]: accumulated }
      setStepResults(finalResults)
      persistChanges(finalResults)
      setLlmError(null)
      notifyToast(`工序 ${stepId} 由大模型实时推演完成`)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        notifyToast(`已中止工序 ${stepId} 推演`)
      } else {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('LLM stream error:', err)
        setLlmError(msg)
        notifyToast(`大模型调用受阻: ${msg}`)
      }
    } finally {
      setRunningStepId(null)
      abortControllerRef.current = null
    }
  }

  // Explicit user action to use offline knowledge base rule template
  const applyOfflineTemplate = (stepId: string) => {
    const fallbackOutput = generateTrainerStepOutput(stepId, courseMeta, project.promptText)
    const finalResults = { ...stepResults, [stepId]: fallbackOutput }
    setStepResults(finalResults)
    persistChanges(finalResults)
    setLlmError(null)
    notifyToast(`工序 ${stepId} 已应用离线合规知识库模版`)
  }

  // Execute all 8 steps in sequence
  const runFullPipeline = async () => {
    if (pipelineRunning || runningStepId !== null) return

    setPipelineRunning(true)
    stopPipelineRef.current = false
    setPipelineProgress({ current: 0, total: TRAINER_STEPS_CONFIG.length })

    let currentResults = { ...stepResults }

    for (let i = 0; i < TRAINER_STEPS_CONFIG.length; i++) {
      if (stopPipelineRef.current) break

      const step = TRAINER_STEPS_CONFIG[i]
      if (!step) continue

      setPipelineProgress({ current: i + 1, total: TRAINER_STEPS_CONFIG.length })
      setRunningStepId(step.id)
      setActiveStepId(step.id)

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      currentResults = { ...currentResults, [step.id]: '' }
      setStepResults(currentResults)

      const promptMessages = getTrainerStepPrompts(
        step.id,
        project.promptText,
        courseMeta,
        currentResults,
      )

      let accumulated = ''
      try {
        await streamChatCompletion(
          promptMessages,
          (delta) => {
            accumulated += delta
            setStepResults(prev => ({ ...prev, [step.id]: accumulated }))
          },
          abortController.signal,
        )
        currentResults = { ...currentResults, [step.id]: accumulated }
        setStepResults(currentResults)
        persistChanges(currentResults)
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          break
        }
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('Pipeline LLM stream error:', err)
        setLlmError(msg)
        notifyToast(`流水线第 ${step.num} 步大模型调用受阻: ${msg}`)
        break
      } finally {
        setRunningStepId(null)
        abortControllerRef.current = null
      }
    }

    setPipelineRunning(false)
    notifyToast('8 阶课件流水线全工序推演已完成')
  }

  const stopExecution = () => {
    stopPipelineRef.current = true
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setPipelineRunning(false)
    setRunningStepId(null)
    notifyToast('已停止推演')
  }

  // Copy current step markdown
  const handleCopyCurrent = async () => {
    const text = stepResults[activeStepId] || ''
    if (!text) {
      notifyToast('当前工序暂无内容')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      notifyToast('已复制当前工序 Markdown 到剪贴板')
    } catch {
      notifyToast('复制失败')
    }
  }

  // Export full courseware markdown
  const handleDownloadFull = () => {
    const fullText = exportFullTrainerCoursewareMarkdown(getCurrentSnapshot())
    const blob = new Blob([fullText], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `【课件全案】${courseMeta.title}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    notifyToast('已导出完整课件全案 Markdown 文档')
  }

  // Send to DSH agent session
  const handleSendDsh = () => {
    const fullText = exportFullTrainerCoursewareMarkdown(getCurrentSnapshot())
    onSendToDsh?.(project, fullText)
  }

  // Open LLM Settings Modal
  const openLlmModal = () => {
    setShowLlmModal(true)
  }

  const fallbackStep = TRAINER_STEPS_CONFIG[0]
  const currentStepConfig =
    (TRAINER_STEPS_CONFIG.find(s => s.id === activeStepId) ?? fallbackStep) ?? {
      id: 'T1',
      num: 'T1',
      title: '提纲简报',
      phase: '阶段一',
      description: '课件整体架构与核心技能点提纲',
      badgeColor: '#059669',
    }
  const currentContent = stepResults[activeStepId] || ''
  const isCurrentStepRunning = runningStepId === activeStepId

  const completedCount = TRAINER_STEPS_CONFIG.filter(s => !!stepResults[s.id]?.trim()).length

  return (
    <div className={css.workspaceContainer}>
      {/* Top Header Navigation */}
      <header className={css.topNav}>
        <div className={css.titleArea}>
          <button type="button" className={css.backButton} onClick={onClose} title="返回集结地">
            <IconChevronLeftOutline14 size={14} />
            <span>返回集结地</span>
          </button>
          <span className={css.trainerBadge}>Trainer Studio</span>
          <h2 className={css.projectTitle}>{courseMeta.title}</h2>
        </div>

        <div className={css.topActions}>
          <div className={css.autoSaveTag}>
            <span className={css.autoSaveDot} />
            <span>已自动保存</span>
          </div>

          {/* Active LLM Model Badge & Quick Switcher */}
          <button
            type="button"
            className={css.llmBadgeButton}
            onClick={openLlmModal}
            title="点击切换或配置数字人底座大模型"
          >
            <span
              className={css.llmStatusDot}
              data-status={effectiveLlm?.apiKey ? 'ready' : 'empty'}
            />
            <span>
              底座: {effectiveLlm?.model || '未绑定'} ({effectiveLlm?.providerName || 'DSH'})
            </span>
            <IconSettingsOutline16 size={13} />
          </button>

          <button
            type="button"
            className={css.navButton}
            onClick={handleCopyCurrent}
            title="复制当前步骤 Markdown"
          >
            <IconCopyOutline16 size={14} />
            <span>复制步骤</span>
          </button>

          <button
            type="button"
            className={css.navButton}
            onClick={handleDownloadFull}
            title="导出全部 8 步课件 Markdown"
          >
            <IconDownloadOutline16 size={14} />
            <span>导出全案</span>
          </button>

          <button
            type="button"
            className={`${css.navButton} ${css.navButtonPrimary}`}
            onClick={handleSendDsh}
            title="将课件全案推送到 DeepSeek 智能体会话"
          >
            <IconPaperPlaneOutline14 size={13} />
            <span>推送到 DSH 会话</span>
          </button>
        </div>
      </header>

      {/* Main Body Layout */}
      <div className={css.mainLayout}>
        {/* Left: Course Meta & 8-Step Timeline */}
        <aside className={css.timelineSidebar}>
          {/* Course Configuration Card */}
          <div className={css.courseMetaCard}>
            <div className={css.metaHeader}>
              <span className={css.metaTitle}>课程规约参数</span>
              <span className={css.metaPill}>8 阶流水线</span>
            </div>

            <div className={css.metaGrid}>
              <div className={css.metaField}>
                <label className={css.metaLabel}>所属行业</label>
                <input
                  type="text"
                  className={css.metaInput}
                  value={courseMeta.industry}
                  onChange={e => handleMetaChange('industry', e.target.value)}
                />
              </div>

              <div className={css.metaField}>
                <label className={css.metaLabel}>建议课时 (min)</label>
                <input
                  type="number"
                  className={css.metaInput}
                  value={courseMeta.durationMinutes}
                  onChange={e => handleMetaChange('durationMinutes', Number(e.target.value) || 60)}
                />
              </div>
            </div>

            <div className={css.metaField}>
              <label className={css.metaLabel}>目标受众</label>
              <input
                type="text"
                className={css.metaInput}
                value={courseMeta.targetAudience}
                onChange={e => handleMetaChange('targetAudience', e.target.value)}
              />
            </div>
          </div>

          {/* Global Pipeline Action */}
          <div className={css.pipelineControls}>
            {pipelineRunning || runningStepId !== null ? (
              <button type="button" className={css.stopButton} onClick={stopExecution}>
                <IconStopFill16 size={14} />
                <span>停止推演</span>
              </button>
            ) : (
              <button type="button" className={css.runAllButton} onClick={runFullPipeline}>
                <IconPlayOutline16 size={14} />
                <span>全工序自动推演 (T1~T8)</span>
              </button>
            )}

            {pipelineRunning && (
              <div className={css.progressBarContainer}>
                <div className={css.progressBarLabel}>
                  <span>推演流水线执行中...</span>
                  <span>
                    {pipelineProgress.current} / {pipelineProgress.total}
                  </span>
                </div>
                <div className={css.progressBarTrack}>
                  <div
                    className={css.progressBarFill}
                    style={{
                      width: `${(pipelineProgress.current / pipelineProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Step Timeline Items */}
          <div className={css.stepsList}>
            {TRAINER_STEPS_CONFIG.map((step) => {
              const isActive = step.id === activeStepId
              const isRunning = runningStepId === step.id
              const hasContent = !!stepResults[step.id]?.trim()

              return (
                <div
                  key={step.id}
                  className={`${css.stepItem} ${isActive ? css.stepItemActive : ''}`}
                  onClick={() => setActiveStepId(step.id)}
                >
                  <div className={css.stepBadge} style={{ backgroundColor: step.badgeColor }}>
                    {step.num}
                  </div>
                  <div className={css.stepInfo}>
                    <div className={css.stepTitle}>{step.title}</div>
                    <div className={css.stepDesc}>{step.description}</div>
                  </div>
                  <div className={css.stepStatusIcon}>
                    {isRunning ? (
                      <span className={css.statusRunning} />
                    ) : hasContent ? (
                      <IconCheckOutline14 size={14} className={css.statusCheck} />
                    ) : (
                      <span className={css.statusPending} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </aside>

        {/* Right: Step Canvas Editor & Markdown Preview */}
        <main className={css.contentArea}>
          {/* Step Action Header */}
          <div className={css.stepHeader}>
            <div className={css.stepHeaderLeft}>
              <span
                className={css.stepHeaderBadge}
                style={{ backgroundColor: currentStepConfig.badgeColor }}
              >
                {currentStepConfig.num}
              </span>
              <div>
                <h3 className={css.stepHeaderTitle}>{currentStepConfig.title}</h3>
                <span className={css.stepHeaderDesc}>{currentStepConfig.description}</span>
              </div>
            </div>

            <div className={css.stepHeaderActions}>
              <div className={css.viewModeToggle}>
                <button
                  type="button"
                  className={`${css.toggleBtn} ${viewMode === 'preview' ? css.toggleBtnActive : ''}`}
                  onClick={() => setViewMode('preview')}
                >
                  <IconBrowseOutline16 size={13} />
                  <span>预览</span>
                </button>
                <button
                  type="button"
                  className={`${css.toggleBtn} ${viewMode === 'edit' ? css.toggleBtnActive : ''}`}
                  onClick={() => setViewMode('edit')}
                >
                  <IconEditOutline16 size={13} />
                  <span>源码</span>
                </button>
              </div>

              <button
                type="button"
                className={css.runStepBtn}
                onClick={() => runStep(activeStepId)}
                disabled={isCurrentStepRunning || pipelineRunning}
              >
                <IconRefreshOutline14 size={12} />
                <span>{isCurrentStepRunning ? '推演中...' : '推演本工序'}</span>
              </button>
            </div>
          </div>

          {/* Document Content View */}
          <div className={css.documentScroll}>
            {llmError && (
              <div className={css.llmErrorAlert}>
                <div className={css.llmErrorHeader}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>底座大模型调用受阻：{llmError}</span>
                </div>
                <p className={css.llmErrorDesc}>
                  数字人全流程均接入真实大模型进行实时流式推演。未能成功获取响应通常是因为官方 API 余额不足（Insufficient Balance）或网络未连通。您可以一键切换至本地免充值私有模型（MAC·Qwen）或重新配置密钥。
                </p>
                <div className={css.llmErrorActions}>
                  <button
                    type="button"
                    className={`${css.llmErrorActionBtn} ${css.llmErrorActionPrimary}`}
                    onClick={() => setShowLlmModal(true)}
                  >
                    切换 / 配置大模型
                  </button>
                  <button
                    type="button"
                    className={css.llmErrorActionBtn}
                    onClick={() => runStep(activeStepId)}
                    disabled={isCurrentStepRunning || pipelineRunning}
                  >
                    重试推演
                  </button>
                  <button
                    type="button"
                    className={css.llmErrorActionBtn}
                    onClick={() => applyOfflineTemplate(activeStepId)}
                  >
                    临时使用离线知识库模版生成
                  </button>
                </div>
              </div>
            )}

            <div className={css.documentPaper}>
              {viewMode === 'preview' ? (
                currentContent ? (
                  <MarkdownText text={currentContent} labels={DEFAULT_MD_LABELS} />
                ) : (
                  <div className={css.emptyState}>
                    <span className={css.emptyStateTitle}>该工序尚未生成交付物</span>
                    <p className={css.emptyStateDesc}>
                      点击右上角「推演本工序」或左侧「全工序自动推演」，OPC 流程合规培训师将基于业务规约自动生成标准化课件内容。
                    </p>
                    <button
                      type="button"
                      className={css.runStepBtn}
                      onClick={() => runStep(activeStepId)}
                    >
                      <IconPlayOutline16 size={13} />
                      <span>立即开始推演</span>
                    </button>
                  </div>
                )
              ) : (
                <textarea
                  className={css.rawEditor}
                  value={currentContent}
                  onChange={e => handleContentEdit(e.target.value)}
                  placeholder="在此直接编辑当前步骤的 Markdown 源码，系统将实时保存..."
                />
              )}
            </div>
          </div>

          {/* Bottom Telemetry Status Bar */}
          <footer className={css.telemetryFooter}>
            <div className={css.telemetryLeft}>
              <div className={css.llmModelBadge}>
                <span className={css.modelDot} />
                <span>模型底座：{effectiveLlm?.model || 'deepseek-chat'} ({effectiveLlm?.providerName || 'DSH'})</span>
              </div>
              <span>
                {isCurrentStepRunning ? '正在实时生成内容...' : '知识库与规约体系已校验'}
              </span>
            </div>

            <div>
              <span>已完成 {completedCount} / 8 个工序交付物</span>
            </div>
          </footer>
        </main>
      </div>

      {/* Floating Toast Notification */}
      {showToast && <div className={css.toastOverlay}>{showToast}</div>}

      {/* Shared LLM Settings Modal */}
      <LlmSettingsModal
        isOpen={showLlmModal}
        onClose={() => setShowLlmModal(false)}
        onConfigSaved={(cfg) => {
          setEffectiveLlm(cfg)
          setLlmError(null)
          notifyToast(`已切换至模型：${cfg.model} (${cfg.providerName || ''})`)
        }}
      />
    </div>
  )
}

function formatNow(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${date} ${hours}:${minutes}`
}
