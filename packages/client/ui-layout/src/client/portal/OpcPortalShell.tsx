import { useState, useEffect, useCallback } from 'react'
import { DigitalWorkerStage } from './DigitalWorkerStage.tsx'
import { PmStudioWorkspace } from './PmStudioWorkspace.tsx'
import type { DigitalWorker } from './digitalWorkers.ts'
import {
  type BlueprintProject,
  getStoredProjects,
  createStoredProject,
  deleteStoredProject,
} from './projectStorage.ts'
import css from './OpcPortalShell.module.css'

export interface OpcPortalShellProps {
  onOpenDsh: (worker?: DigitalWorker, taskSpec?: string) => void
}

export function OpcPortalShell({ onOpenDsh }: OpcPortalShellProps) {
  const [subView, setSubView] = useState<'hub' | 'pm-studio'>('hub')
  const [projects, setProjects] = useState<BlueprintProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false)
  const [newProjectName, setNewProjectName] = useState<string>('')
  const [newDepartment, setNewDepartment] = useState<string>('')

  // Load projects from local storage
  useEffect(() => {
    const list = getStoredProjects()
    setProjects(list)
    if (list.length > 0 && !selectedProjectId) {
      setSelectedProjectId(list[0]?.id ?? '')
    }
  }, [])

  const currentProject = projects.find(p => p.id === selectedProjectId) || projects[0]

  const handleOpenProject = (project: BlueprintProject) => {
    setSelectedProjectId(project.id)
    if (project.type === 'pm') {
      setSubView('pm-studio')
    } else {
      onOpenDsh()
    }
  }

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const remaining = deleteStoredProject(id)
    setProjects(remaining)
    if (selectedProjectId === id && remaining.length > 0) {
      setSelectedProjectId(remaining[0]?.id ?? '')
    }
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) return
    const created = createStoredProject(newProjectName, newDepartment)
    const list = getStoredProjects()
    setProjects(list)
    setSelectedProjectId(created.id)
    setShowCreateModal(false)
    setNewProjectName('')
    setNewDepartment('')
    setSubView('pm-studio')
  }

  const handleUpdateProject = useCallback((updated: BlueprintProject) => {
    setProjects(prev => prev.map(p => (p.id === updated.id ? updated : p)))
  }, [])

  return (
    <div className={css.portalFrame}>
      {/* Left Sidebar */}
      <aside className={css.portalSidebar}>
        <div className={css.portalSidebarHeader}>
          <h1 className={css.portalTitle}>数字员工指挥工作台</h1>
          <span className={css.portalSubtitle}>Agent Hub for OPC · 企业数字化落地协同指挥中枢</span>
        </div>

        <div className={css.portalSectionLabel}>最近项目 · 规约工作区</div>

        {/* New Project Button */}
        <button
          type="button"
          className={css.createProjectBtn}
          onClick={() => { setShowCreateModal(true) }}
        >
          <span>＋</span>
          <span>新建蓝图设计项目</span>
        </button>

        {/* Recent Projects List */}
        <div className={css.recentProjectsList}>
          {projects.map((project) => {
            const isActive = project.id === selectedProjectId && subView === 'pm-studio'
            return (
              <div
                key={project.id}
                className={`${css.projectCard} ${isActive ? css.projectCardActive : ''}`}
                onClick={() => { handleOpenProject(project) }}
                role="button"
                tabIndex={0}
              >
                <div className={css.projectCardHeader}>
                  <span className={css.projectName}>{project.name}</span>
                  <button
                    type="button"
                    className={css.projectDeleteBtn}
                    onClick={(e) => { handleDeleteProject(e, project.id) }}
                    title="删除此项目"
                  >
                    ✕
                  </button>
                </div>
                <div className={css.projectMeta}>
                  <span>{project.department}</span>
                  <span>{project.updatedAt}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom Workspace Navigation */}
        <div className={css.workspaceNav}>
          <div className={css.portalSectionLabel} style={{ margin: '0 0 6px 4px' }}>工作区</div>

          <button
            type="button"
            className={`${css.navItem} ${subView === 'hub' ? css.navItemActive : ''}`}
            onClick={() => { setSubView('hub') }}
          >
            <span className={css.navItemIcon}>👨‍💼</span>
            <span>数字员工集结地</span>
          </button>

          <button
            type="button"
            className={`${css.navItem} ${subView === 'pm-studio' ? css.navItemActive : ''}`}
            onClick={() => {
              if (currentProject) setSubView('pm-studio')
            }}
          >
            <span className={css.navItemIcon}>📐</span>
            <span>PM Studio 蓝图设计器</span>
          </button>

          <button
            type="button"
            className={css.navItem}
            onClick={() => { onOpenDsh() }}
          >
            <span className={css.navItemIcon}>💬</span>
            <span>开放对话（协同底座）</span>
          </button>

          <div className={css.statusPill}>
            <span className={css.statusDot} />
            <span>协同引擎在线</span>
          </div>
        </div>
      </aside>

      {/* Main Canvas */}
      <main className={css.portalMain}>
        {subView === 'pm-studio' && currentProject ? (
          <PmStudioWorkspace
            project={currentProject}
            onClose={() => { setSubView('hub') }}
            onSaveProject={handleUpdateProject}
            onSendToDsh={(proj, spec) => {
              onOpenDsh(undefined, `【来自 PM Studio 的数字化规格书】\n项目：${proj.name} (${proj.department})\n\n${spec}\n\n请作为高级全栈工程师，针对以上软件蓝图与规约，给出工程实现落地代码方案与架构分解。`)
            }}
          />
        ) : (
          <DigitalWorkerStage
            onStartWork={(worker) => {
              if (worker.mode === 'pm-studio') {
                setSubView('pm-studio')
              } else {
                onOpenDsh(worker)
              }
            }}
          />
        )}
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className={css.modalBackdrop} onClick={() => { setShowCreateModal(false) }}>
          <div className={css.modalCard} onClick={(e) => { e.stopPropagation() }}>
            <h2 className={css.modalTitle}>新建数字化蓝图项目</h2>
            <p className={css.modalSubtitle}>创建新的 11 步架构规约空间，支持自动推演与知识库增强</p>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className={css.modalField}>
                <label className={css.modalLabel} htmlFor="projName">项目名称 *</label>
                <input
                  id="projName"
                  className={css.modalInput}
                  type="text"
                  placeholder="如：成都总装车间 AGV 调度与物料配送系统"
                  value={newProjectName}
                  onChange={(e) => { setNewProjectName(e.target.value) }}
                  autoFocus
                  required
                />
              </div>

              <div className={css.modalField}>
                <label className={css.modalLabel} htmlFor="projDept">业务部门 / 场景</label>
                <input
                  id="projDept"
                  className={css.modalInput}
                  type="text"
                  placeholder="如：物流保障部 / 车间物料协同"
                  value={newDepartment}
                  onChange={(e) => { setNewDepartment(e.target.value) }}
                />
              </div>

              <div className={css.modalActions}>
                <button
                  type="button"
                  className={css.modalCancelBtn}
                  onClick={() => { setShowCreateModal(false) }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className={css.modalConfirmBtn}
                >
                  创建并进入设计
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
