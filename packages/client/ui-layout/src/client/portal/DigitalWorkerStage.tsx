import { useState, useRef, useCallback } from 'react'
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
      transform: `rotateY(${clampedX * 6}deg) rotateX(${-clampedY * 4}deg) translate3d(${clampedX * 8}px, ${clampedY * 4}px, 20px)`,
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
      {/* Top Header */}
      <div className={css.stageHeader}>
        <h2 className={css.stageTitle}>数字员工集结地</h2>
        <span className={css.stageSubtitle}>Agent Hub for OPC · 企业数字化落地协同指挥中枢</span>
      </div>

      <div className={css.stageBody}>
        {/* Left Info Panel: 职责与使命 */}
        <aside className={`${css.infoPanel} ${css.infoPanelLeft}`}>
          <span className={css.infoEyebrow}>工作职责</span>
          <h3 className={css.infoTitle}>我能为你做什么</h3>
          <p className={css.infoDescription}>{currentWorker.userDescription}</p>
          {currentWorker.callExample && (
            <div className={css.commandExample}>
              <span className={css.commandExampleLabel}>推荐指令 / 常用呼叫</span>
              <strong className={css.commandExampleText}>“{currentWorker.callExample}”</strong>
            </div>
          )}
        </aside>

        {/* Center: 3D Avatar Stage */}
        <div className={css.avatarStage}>
          <div className={css.avatarParallax} style={parallaxStyle}>
            <img
              src={currentWorker.avatar}
              alt={currentWorker.name}
              className={css.avatarImage}
              draggable={false}
            />
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
            开始工作
          </button>
        </div>

        {/* Right Info Panel: 能力分层 */}
        <aside className={`${css.infoPanel} ${css.infoPanelRight}`}>
          <span className={css.infoEyebrow}>岗位能力</span>
          <h3 className={css.infoTitle}>能力分层</h3>
          <div className={css.capabilityList}>
            {currentWorker.capabilityLayers.map(layer => (
              <div key={layer.level} className={css.capabilityItem}>
                <b className={css.capabilityBadge}>{layer.level}</b>
                <span className={css.capabilityText}>{layer.items.join(' / ')}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Bottom Roster Bar */}
      <nav className={css.rosterStrip} aria-label="数字员工切换">
        {DIGITAL_WORKERS.map((worker) => {
          const isActive = worker.id === activeId
          return (
            <button
              key={worker.id}
              type="button"
              className={`${css.rosterItem} ${isActive ? css.rosterItemActive : ''}`}
              onClick={() => { handleSelect(worker) }}
            >
              <span>{worker.name}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
