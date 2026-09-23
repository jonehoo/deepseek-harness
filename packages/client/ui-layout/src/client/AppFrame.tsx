/**
 * Three-column shell frame, registered into the built-in 'root' slot (the web
 * shell renders only 'root'). Owns the grid tracks (sidebar | center |
 * rightbar), the drag handles (pointer capture + rAF throttle), the column
 * solve (columns.ts), and the child-slot render decisions: the sidebar slot
 * receives live parameters from that solve. The root-scoped main slot selects
 * the Conversation or a global panel. Each column occupant owns its Session
 * binding and reports the geometry it needs.
 *
 * The right column is a track, not a box: its occupant draws its panel anchored
 * to the frame's right edge at the resolved normal width, and the
 * track only decides whether the centre makes room for it. The occupant reports
 * shown/track/fullscreen through `ctx.layout`; fullscreen keeps the reported
 * track but hides the outer resize handle. Everything arrives through the framework
 * shares — zero cordis or framework imports, zero self-made hooks.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  PropsLocale, PropsRenderSlots, PropsRuntime, PropsStore,
} from '@deepseek-ai/dsh-client-ui-slots'
import { computeColumns, RIGHTBAR_DEFAULT_RATIO, SIDEBAR_AUTO_COLLAPSE, SIDEBAR_COLLAPSED, SIDEBAR_DEFAULT } from './columns.ts'
import { DocumentTitle } from './DocumentTitle.tsx'
import type { createLayoutStore } from './stores.ts'
import { IconUserOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { OpcPortalShell } from './portal/OpcPortalShell.tsx'
import css from './AppFrame.module.css'

/** Full composed props: runtime share + child-slot render share + store share. */
export type AppFrameProps =
  & PropsRuntime<'root'>
  & PropsRenderSlots<'sidebar' | 'main' | 'rightbar' | 'shell.overlay'>
  & PropsStore<ReturnType<typeof createLayoutStore>>
  & PropsLocale<'common'>

/** Center column grid item (session-body building block). */
function CenterColumn(props: { children?: ReactNode }) {
  return <div className={css.centerCol}>{props.children}</div>
}

/** Subscribe to the main key without subscribing the column frame to each panel id. */
function MainPanel({ usePanelInfo, renderSlot }: Pick<PropsRuntime<'root'>, 'usePanelInfo'> & PropsRenderSlots<'main'>) {
  const panelId = usePanelInfo(info => info.activePanelId)
  return renderSlot('main', {}, { entryKey: panelId ?? 'conversation' })
}

/**
 * Right column grid item. Zero-width unless the occupant asked for a track; the
 * occupant's panel is positioned against the column's right edge, which never
 * moves, so it can hang over the centre when there is no track.
 */
function RightbarColumn(props: { children?: ReactNode }) {
  return <div className={css.rightbarCol} data-rightbar-col>{props.children}</div>
}

/**
 * One drag handle: pointer capture, rAF-throttled dx reports against the drag-start origin.
 * `side` keys the hover-reveal CSS to the owning column.
 */
function DragHandle(props: { side: 'sidebar' | 'rightbar'; left: number; onStart: () => void; onDrag: (dx: number) => void; onEnd: () => void }) {
  const [dragging, setDragging] = useState(false)
  const origin = useRef(0)
  const latest = useRef(0)
  const frame = useRef<number | null>(null)
  const capture = useRef<{ element: HTMLDivElement; id: number } | null>(null)
  const callbacks = useRef({ onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd })
  callbacks.current = { onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd }

  const endDrag = useCallback(() => {
    const active = capture.current
    if (active === null) return
    capture.current = null
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null }
    if (active.element.hasPointerCapture(active.id)) active.element.releasePointerCapture(active.id)
    setDragging(false)
    callbacks.current.onEnd()
  }, [])
  useEffect(() => endDrag, [endDrag])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || capture.current !== null) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    capture.current = { element: e.currentTarget, id: e.pointerId }
    origin.current = e.clientX
    latest.current = e.clientX
    callbacks.current.onStart()
    setDragging(true)
  }, [])
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (capture.current?.id !== e.pointerId) return
    latest.current = e.clientX
    frame.current ??= requestAnimationFrame(() => {
      frame.current = null
      callbacks.current.onDrag(latest.current - origin.current)
    })
  }, [])
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (capture.current?.id !== e.pointerId) return
    callbacks.current.onDrag(e.clientX - origin.current)
    endDrag()
  }, [endDrag])
  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (capture.current?.id === e.pointerId) endDrag()
  }, [endDrag])

  return (
    <div
      className={css.handle}
      style={{ left: props.left }}
      data-side={props.side}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
    />
  )
}

/** The three-column frame (see module doc). */
export function AppFrame({
  useStore,
  useSessions,
  usePanelInfo,
  actions,
  renderSlot,
  t,
}: AppFrameProps) {
  const layoutInfo = useStore(state => state.layoutInfo)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const viewport = layoutInfo.viewportWidth

  // Track the frame's own box (not the window): rAF-throttled ResizeObserver.
  useLayoutEffect(() => {
    const el = frameRef.current
    /* v8 ignore next -- the ref is always attached by effect time: the frame div renders unconditionally. */
    if (el === null) return
    let raf: number | null = null
    let disposed = false
    const measure = () => {
      const width = el.getBoundingClientRect().width
      if (width > 0) actions.setViewportWidth(width)
    }
    measure()
    const observer = new ResizeObserver(() => {
      if (disposed) return
      raf ??= requestAnimationFrame(() => {
        raf = null
        measure()
      })
    })
    observer.observe(el)
    return () => {
      disposed = true
      observer.disconnect()
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [actions])

  const narrow = viewport < SIDEBAR_AUTO_COLLAPSE
  const sidebarCollapsed = narrow ? !layoutInfo.narrowExpanded : layoutInfo.sidebar === 0
  const sidebarPreference = sidebarCollapsed
    ? 0
    : layoutInfo.sidebar === 0 ? SIDEBAR_DEFAULT : layoutInfo.sidebar
  const rightbarPreference = layoutInfo.rightbar ?? viewport * RIGHTBAR_DEFAULT_RATIO
  // Desktop reopen controls occupy the macOS session header or Windows caption row.
  const collapsedWidth = document.documentElement.dataset.platform === 'darwin'
    || document.documentElement.hasAttribute('data-windows-titlebar') ? 0 : SIDEBAR_COLLAPSED
  // Opening on a narrow frame collapses the left sidebar. Eligibility must
  // include that space before the occupant's first shown report arrives.
  const normal = computeColumns(viewport, !layoutInfo.rightbarShown && narrow ? 0 : sidebarPreference, rightbarPreference, collapsedWidth)
  const cols = computeColumns(viewport, sidebarPreference, layoutInfo.rightbarTrack ? rightbarPreference : 0, collapsedWidth)
  const colsRef = useRef(cols)
  colsRef.current = cols
  const rightbarWidth = useRef(normal.rightbar)
  rightbarWidth.current = normal.rightbar

  // The drag base is the rendered width captured at drag start (grabbing a
  // concession-clamped panel must not jump back to the stored preference);
  // it stays frozen for the whole gesture so dx deltas do not compound.
  const sidebarBase = useRef(0)
  const rightbarBase = useRef(0)
  // Track-level transitions pause for the whole gesture: eased tracks would
  // detach the column edge from the pointer (AppFrame.module.css).
  const [dragging, setDragging] = useState(false)
  const onDragEnd = useCallback(() => { setDragging(false) }, [])
  const onSidebarStart = useCallback(() => { sidebarBase.current = colsRef.current.sidebar; setDragging(true) }, [])
  const onSidebarDrag = useCallback((dx: number) => {
    actions.setSidebar(sidebarBase.current + dx)
  }, [actions])
  const onRightbarStart = useCallback(() => { rightbarBase.current = rightbarWidth.current; setDragging(true) }, [])
  const onRightbarDrag = useCallback((dx: number) => {
    actions.setRightbar(rightbarBase.current - dx)
  }, [actions])
  const productTitle = process.env.DSH_CLIENT_TITLE ?? t('brand.localBuild')
  const sidebar = useMemo(() => renderSlot('sidebar', {
    collapsed: sidebarCollapsed,
    width: cols.sidebar,
  }), [renderSlot, sidebarCollapsed, cols.sidebar])
  const main = useMemo(() => (
    <MainPanel usePanelInfo={usePanelInfo} renderSlot={renderSlot} />
  ), [usePanelInfo, renderSlot])
  const overlays = useMemo(() => renderSlot('shell.overlay', {}), [renderSlot])

  const [activeWorker, setActiveWorker] = useState<import('./portal/digitalWorkers.ts').DigitalWorker | null>(null)
  const [bridgeNotice, setBridgeNotice] = useState<string | null>(null)

  const [appMode, setAppModeState] = useState<'portal' | 'dsh'>(() => {
    try {
      return (sessionStorage.getItem('dsh_app_mode') as 'portal' | 'dsh' | null) ?? 'portal'
    } catch {
      return 'portal'
    }
  })
  const setAppMode = useCallback((mode: 'portal' | 'dsh') => {
    try {
      sessionStorage.setItem('dsh_app_mode', mode)
    } catch {}
    setAppModeState(mode)
  }, [])

  const handleOpenDsh = useCallback((
    worker?: import('./portal/digitalWorkers.ts').DigitalWorker,
    taskSpec?: string,
  ) => {
    if (worker) {
      setActiveWorker(worker)
      setBridgeNotice(`已激活【${worker.name}】专属协同域`)
    } else if (taskSpec) {
      setActiveWorker(null)
      void navigator.clipboard.writeText(taskSpec).catch(() => {})
      setBridgeNotice('已将 PM 蓝图规约复制至剪贴板，可直接在下方输入框 Ctrl+V 发送！')
    } else {
      setActiveWorker(null)
      setBridgeNotice(null)
    }
    setAppMode('dsh')
  }, [setAppMode])

  if (appMode === 'portal') {
    return (
      <>
        <DocumentTitle
          productTitle={productTitle}
          useSessions={useSessions}
          usePanelInfo={usePanelInfo}
        />
        <OpcPortalShell onOpenDsh={handleOpenDsh} />
      </>
    )
  }

  return (
    <div
      ref={frameRef}
      className={css.frame}
      style={{
        ...(document.documentElement.hasAttribute('data-windows-titlebar')
          ? { '--dsh-windows-sidebar-width': `${cols.sidebar}px` } : {}),
        gridTemplateColumns:
          `${cols.sidebar}px minmax(0, 1fr) ${cols.rightbar}px`,
      }}
      data-sidebar-collapsed={sidebarCollapsed || undefined}
      data-rightbar-collapsed={cols.rightbar === 0 || undefined}
      data-rightbar-fullscreen={layoutInfo.rightbarFullscreen || undefined}
      data-rightbar-instant={layoutInfo.rightbarInstant || undefined}
      data-dragging={dragging || undefined}
    >
      <DocumentTitle
        productTitle={productTitle}
        useSessions={useSessions}
        usePanelInfo={usePanelInfo}
      />
      <div className={css.sidebarCol}>
        {sidebar}
      </div>
      <>
        <CenterColumn>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 16px',
            background: '#eff6ff',
            borderBottom: '1px solid #bfdbfe',
            fontSize: '12px',
            fontWeight: 600,
            color: '#1e40af',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>OPC 指挥中枢 · 底座会话</span>
              {activeWorker && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '2px 8px',
                  background: '#dbeafe',
                  color: '#1d4ed8',
                  borderRadius: '4px',
                  fontWeight: 700,
                }}>
                  <IconUserOutline16 size={13} />
                  <span>正在与【{activeWorker.name} · {activeWorker.roleTitle}】协同</span>
                </span>
              )}
              {bridgeNotice && !activeWorker && (
                <span style={{
                  padding: '2px 8px',
                  background: '#dcfce7',
                  color: '#15803d',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}>
                  {bridgeNotice}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setAppMode('portal') }}
              style={{
                padding: '4px 12px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              ← 返回数字员工指挥工作台
            </button>
          </div>
          {main}
        </CenterColumn>
        <RightbarColumn>
          {renderSlot('rightbar', { width: normal.rightbar, viewportWidth: viewport, canShow: normal.rightbar > 0 })}
        </RightbarColumn>
      </>
      <div className={css.overlayLayer} data-shell-overlay>
        {overlays}
      </div>
      {/* The collapsed rail is fixed-width: no resize handle while closed. */}
      {!sidebarCollapsed && <DragHandle side="sidebar" left={cols.sidebar} onStart={onSidebarStart} onDrag={onSidebarDrag} onEnd={onDragEnd} />}
      {layoutInfo.rightbarShown && !layoutInfo.rightbarFullscreen && normal.rightbar > 0 && (
        <DragHandle side="rightbar" left={viewport - normal.rightbar} onStart={onRightbarStart} onDrag={onRightbarDrag} onEnd={onDragEnd} />
      )}
    </div>
  )
}
