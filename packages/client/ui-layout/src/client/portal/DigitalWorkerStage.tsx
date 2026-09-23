import { useState, useRef, useCallback } from 'react'
import {
  IconUserOutline16,
  IconAgentPresetOutline16,
  IconBranchOutline16,
  IconPaperPlaneOutline14,
  IconRightUpOutline16,
  IconCheckOutline14,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { DIGITAL_WORKERS, type DigitalWorker } from './digitalWorkers.ts'
import css from './DigitalWorkerStage.module.css'

export interface DigitalWorkerStageProps {
  onStartWork?: (worker: DigitalWorker) => void
  onSelectWorker?: (worker: DigitalWorker) => void
}

export function DigitalWorkerStage({ onStartWork, onSelectWorker }: DigitalWorkerStageProps) {
  const [activeId, setActiveId] = useState<string>('pm-studio')
  const [parallaxStyle, setParallaxStyle] = useState<{ transform: string }>({ transform: '' })
  const stageRef = useRef<HTMLDivElement>(null)

  const fallbackWorker: DigitalWorker = DIGITAL_WORKERS[0] as DigitalWorker
  const currentWorker: DigitalWorker = DIGITAL_WORKERS.find(w => w.id === activeId) ?? fallbackWorker

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const x = (e.clientX - centerX) / (rect.width / 2)
    const y = (e.clientY - centerY) / (rect.height / 2)

    // Clamp between -1 and 1
    const clampedX = Math.max(-1, Math.min(1, x))
    const clampedY = Math.max(-1, Math.min(1, y))

    setParallaxStyle({
      transform: `rotateY(${clampedX * 5}deg) rotateX(${-clampedY * 3.5}deg) translate3d(${clampedX * 6}px, ${clampedY * 3}px, 15px)`,
    })
  }, [])

  const handlePointerLeave = useCallback(() => {
    setParallaxStyle({
      transform: 'rotateY(0deg) rotateX(0deg) translate3d(0, 0, 0)',
    })
  }, [])

  const handleSelect = (worker: DigitalWorker) => {
    setActiveId(worker.id)
    onSelectWorker?.(worker)
  }

  const handleStart = () => {
    onStartWork?.(currentWorker)
  }

  return (
    <div
      ref={stageRef}
      className={css.stageContainer}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* Decorative Technical Crosshairs / Grid Accents */}
      <div className={`${css.techMarker} ${css.techMarkerTL}`} aria-hidden="true" />
      <div className={`${css.techMarker} ${css.techMarkerTR}`} aria-hidden="true" />
      <div className={`${css.techMarker} ${css.techMarkerBL}`} aria-hidden="true" />
      <div className={`${css.techMarker} ${css.techMarkerBR}`} aria-hidden="true" />

      {/* Top Header */}
      <header className={css.stageHeader}>
        <div className={css.headerLeft}>
          <h2 className={css.stageTitle}>数字员工集结地</h2>
          <div className={css.stageLiveTag}>
            <span className={css.liveDot} />
            <span>OPC 协同矩阵 · 9 位数字化员工就绪</span>
          </div>
        </div>

        <div className={css.headerRight}>
          <div className={css.stageSubtitle}>
            <IconBranchOutline16 size={13} className={css.headerIcon} />
            <span>Agent Hub for OPC · 企业数字化落地协同指挥中枢</span>
          </div>
        </div>
      </header>

      {/* Main Stage Body */}
      <div className={css.stageBody}>
        {/* Left Info Panel: 职责与使命 (HUD Glassmorphism) */}
        <aside className={`${css.infoPanel} ${css.infoPanelLeft}`}>
          <div className={css.panelHeaderRow}>
            <span className={css.infoEyebrow}>
              <IconUserOutline16 size={13} className={css.eyebrowIcon} />
              <span>岗位核心职责</span>
            </span>
            <span className={css.modeBadge}>
              {currentWorker.mode === 'pm-studio'
                ? '蓝图设计工坊'
                : currentWorker.mode === 'trainer-studio'
                  ? '课件流水线'
                  : '智能对话协同'}
            </span>
          </div>

          <h3 className={css.infoTitle}>我能为你做什么</h3>
          <p className={css.infoDescription}>{currentWorker.userDescription}</p>

          {currentWorker.callExample && (
            <div
              className={css.commandExample}
              onClick={handleStart}
              role="button"
              tabIndex={0}
              title="点击以推荐指令快速呼叫"
            >
              <div className={css.commandExampleHeader}>
                <div className={css.commandIconWrap}>
                  <IconPaperPlaneOutline14 size={11} />
                </div>
                <span className={css.commandExampleLabel}>推荐呼叫指令 / 常用场景</span>
                <span className={css.commandQuickAction}>快速呼叫 ›</span>
              </div>
              <div className={css.commandExampleBubble}>
                “{currentWorker.callExample}”
              </div>
            </div>
          )}

          <div className={css.panelFooterNote}>
            <IconCheckOutline14 size={12} className={css.checkIcon} />
            <span>已接入企业私有知识库与标准业务规约</span>
          </div>
        </aside>

        {/* Center: 3D Holographic Avatar Stage */}
        <div className={css.avatarStage}>
          <div className={css.avatarHeroUnit}>
            {/* Holographic Projection Pedestal beneath feet */}
            <div className={css.holoPodium} aria-hidden="true">
              <div className={css.holoVerticalBeam} />
              <div className={css.holoSpotlight} />
              <div className={css.holoRings}>
                <div className={css.holoRingOuter} />
                <div className={css.holoRingMiddle} />
                <div className={css.holoRingInner} />
              </div>
            </div>

            {/* 3D Avatar Parallax Frame */}
            <div className={css.avatarParallax} style={parallaxStyle}>
              <img
                src={currentWorker.avatar}
                alt={currentWorker.name}
                className={css.avatarImage}
                draggable={false}
              />
            </div>

            {/* Identity & Action CTA */}
            <div className={css.avatarIdentityBlock}>
              <div className={css.workerStatusPill}>
                <span className={css.statusPillDot} />
                <span>
                  {currentWorker.mode === 'pm-studio'
                    ? '11步规约推演引擎 · 运行中'
                    : currentWorker.mode === 'trainer-studio'
                      ? 'T1~T8 课件流水线 · 运行中'
                      : '企业专家协同引擎 · 就绪'}
                </span>
              </div>

              <div className={css.avatarCopy}>
                <strong className={css.avatarName}>{currentWorker.name}</strong>
                <span className={css.avatarRole}>{currentWorker.roleTitle}</span>
              </div>

              <button
                type="button"
                className={css.actionButton}
                onClick={handleStart}
              >
                <span className={css.actionButtonIcon}>
                  {currentWorker.mode === 'pm-studio' || currentWorker.mode === 'trainer-studio' ? (
                    <IconRightUpOutline16 size={15} />
                  ) : (
                    <IconPaperPlaneOutline14 size={14} />
                  )}
                </span>
                <span>
                  {currentWorker.mode === 'pm-studio'
                    ? '进入蓝图设计工坊'
                    : currentWorker.mode === 'trainer-studio'
                      ? '进入培训课件工坊'
                      : '开启专属协同对话'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Info Panel: 岗位能力分层模型 (HUD Glassmorphism) */}
        <aside className={`${css.infoPanel} ${css.infoPanelRight}`}>
          <div className={css.panelHeaderRow}>
            <span className={css.infoEyebrow}>
              <IconAgentPresetOutline16 size={13} className={css.eyebrowIcon} />
              <span>能力分层模型</span>
            </span>
            <span className={css.levelCountBadge}>
              3 阶递进架构
            </span>
          </div>

          <h3 className={css.infoTitle}>专业技能矩阵</h3>

          <div className={css.capabilityList}>
            {currentWorker.capabilityLayers.map((layer) => {
              const isL1 = layer.level === 'L1'
              const isL2 = layer.level === 'L2'
              const badgeStyle = isL1
                ? css.capabilityBadgeL1
                : isL2
                  ? css.capabilityBadgeL2
                  : css.capabilityBadgeL3
              const levelName = isL1
                ? '基础执行层'
                : isL2
                  ? '分析研判层'
                  : '决策支撑层'

              return (
                <div key={layer.level} className={css.capabilityItem}>
                  <div className={`${css.capabilityBadge} ${badgeStyle}`}>
                    {layer.level}
                  </div>
                  <div className={css.capabilityDetails}>
                    <div className={css.capabilityLevelName}>{levelName}</div>
                    <div className={css.capabilityTags}>
                      {layer.items.map((item, idx) => (
                        <span key={idx} className={css.capabilityTag}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className={css.panelFooterTelemetry}>
            <div className={css.telemetryItem}>
              <span className={css.telemetryDot} />
              <span>底座响应: DeepSeek 实时流式推演</span>
            </div>
            <div className={css.telemetryItem}>
              <span className={css.telemetryDot} />
              <span>知识库支撑: 101 项工业与业务规约</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom Floating Cyber Dock */}
      <nav className={css.rosterStrip} aria-label="数字员工切换">
        <div className={css.rosterDock}>
          {DIGITAL_WORKERS.map((worker) => {
            const isActive = worker.id === activeId
            return (
              <button
                key={worker.id}
                type="button"
                className={`${css.rosterItem} ${isActive ? css.rosterItemActive : ''}`}
                onClick={() => { handleSelect(worker) }}
              >
                {isActive && <span className={css.rosterActiveDot} />}
                <span className={css.rosterItemName}>{worker.name}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
