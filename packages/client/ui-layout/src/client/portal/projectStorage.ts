/**
 * Local storage & persistence for PM Studio blueprint projects.
 * Allows creating, editing, auto-saving and switching between enterprise blueprint designs.
 */
import { STEPS_CONFIG } from './pmPrompts.ts'
import { TRAINER_STEPS_CONFIG } from './trainerPrompts.ts'

export interface TrainerMeta {
  title: string
  industry: string
  targetAudience: string
  durationMinutes: number
  stylePreset: string
}

export interface BlueprintProject {
  id: string
  name: string
  department: string
  role: string
  updatedAt: string
  type: 'pm' | 'chat'
  promptText: string
  isRagEnabled: boolean
  selectedKb: string
  stepResults: Record<string, string>
  // Training Studio courseware fields
  trainerMeta?: TrainerMeta
  trainerPromptText?: string
  trainerStepResults?: Record<string, string>
}

const STORAGE_KEY = 'dsh_opc_blueprint_projects'

const SAMPLE_CHENGDU_PROMPT = `成都工厂工控安全运营平台业务设计
日期：2026-08-18
版本：v1.1
状态：待审阅
路径：审核任务为中心，材料当证独审（路径1）
相对 v1.0：把工部全生命周期骨架写入正文；工矿协调员登录；材料扩大为七类；增加一般变更流程与归档策略。主要功能是审核。

1. 文档目的
本文整合三份关键输入材料，形成平台建设的业务底线，作为项目立项与后续系统设计的依据。
用户梳理：VW 集团工控安全现场评估标准（8维度/24模块/101项，L1-L4成熟度）。
工部梳理：基于公司工控安全管理规定抽出的角色、主线、场景、中心等核心要素。
附件：《2026 ICS工控安全评审分析20260724（会议用）1.xlsx》，包含详细的评估目录。

核心定位：平台名称沿用「工控安全运营平台」，以工部梳理的全生命周期骨架为业务核心（即规定要求的合规动作），本期聚焦于通过“审核任务”进行合规度评估，利用“材料”作为证据支撑，借助 Flowable 实现审批链路。不将“六个中心”建设为六套独立的产品，而是作为能力地图，服务于审核主流程。`

const SAMPLE_CHENGDU_STEPS: Record<string, string> = {
  '6': `# 工控安全运营平台（成都工厂）数字化平台立项说明书

### 文档信息
- **项目名称**：工控安全运营平台
- **适用工厂**：成都工厂
- **文档日期**：2026-08-18
- **版本**：v1.1
- **状态**：待审阅
- **设计路径**：审核任务为中心，材料当证独审（路径1）

---

### 版本变更说明（相对 v1.0）
1. 将工部梳理的全生命周期骨架写入正文，作为业务基线。
2. 明确工厂协调员作为独立受审角色。
3. 审核材料由五类扩大为七类。
4. 增加一般变更流程与归档策略设计。
5. 重申并强化核心功能为“合规审核”。

---

### 1. 文档目的
本文档旨在整合三份关键输入材料，形成平台建设的业务底线，作为项目立项与后续系统设计的依据。
1. **用户梳理**：VW集团工控安全现场评估标准（8维度/24模块/101项，L1-L4成熟度）。
2. **工部梳理**：基于公司工控安全管理规定，抽取角色、主线、场景、中心等核心要素。
3. **附件**：《2026 ICS工控安全评审分析20260724（会议用）1.xlsx》，包含详细的评估目录。

**核心定位**：平台名称沿用「工控安全运营平台」，以工部梳理的全生命周期骨架为业务核心（即规定要求的合规动作），本期聚焦于通过“审核任务”进行合规度评估，利用“材料”作为证据支撑，借助 **Flowable** 实现审批链路。不将“六个中心”建设为六套独立运营产品，而是作为能力地图，服务于审核主流程。

---

### 2. 角色与权限模型
| 角色名称 | 职责边界 | 核心操作权限 |
|:---|:---|:---|
| 工厂协调员 | 收集并上传本工厂安全评估佐证材料 | 提交自评材料、查看审核反馈、申请复核 |
| 安全审核专家 | 执行 101 项条目合规性独立核查与打分 | 查阅凭据材料、下发整改意见、签发评估报告 |
| 运营管理者 | 监控集团跨工厂评估进度与安全合规态势 | 运营大屏监控、审计日志归档、权限审批 |`,

  '1': `# 业务流程详细说明文档

### 1. 业务流程总览清单
| 流程编号 | 流程名称 | 负责角色 | 流程类型 | 简要说明 |
|:---|:---|:---|:---|:---|
| P01 | 安全自评材料提交流程 | 工厂协调员 | 核心业务 | 填报 101 项现场评估指标并上传佐证依据 |
| P02 | 专家任务分发与会签 | 审核组长 | 审批流 | 按资产维度分派多专业安全专家会签审查 |
| P03 | 缺陷整改与复核归档 | 协调员/专家 | 闭环流 | 针对未达标项限期整改并触发复验归档 |

### 2. P01 安全自评提交流程详细时序与状态机
1. **草稿阶段 (DRAFT)**：工厂协调员按资产与区域清单分拆自查项，逐条上传系统配置文件、网络拓扑及制度凭证。
2. **提交校验 (VALIDATING)**：系统自动比对 101 项完整度，针对缺失必填凭据条目阻断提交。
3. **已交审 (SUBMITTED)**：生成审核批次快照，锁定当前版本并进入专家分发任务池。`,

  '2': `# 角色权限矩阵与业务用例

### 1. 角色矩阵清单
- **R01 工厂安全协调员**：负责本厂区终端、PLC、工控交换机安全台账初录与自查。
- **R02 工控安全合规审核员**：执行现场稽核、材料核验、成熟度打分（L1~L4）。
- **R03 系统安全管理员**：负责资产模型配置、审核基线版本发布与系统审计日志审查。

### 2. 权限颗粒度定义
| 功能模块 | 操作动作 | R01 协调员 | R02 审核员 | R03 管理员 |
|:---|:---|:---:|:---:|:---:|
| 资产合规自评 | 填写与编辑 | 允许（本厂） | 仅查看 | 允许（全部） |
| 审核打分判定 | 评分与打标 | 禁止 | 允许 | 禁止 |
| 整改单签发 | 派发与流转 | 禁止 | 允许 | 允许 |
| 基线规则库 | 修改与发布 | 禁止 | 禁止 | 允许 |`,

  '3': `# 领域实体模型与数据字典

### 1. 核心实体清单
- **AuditTask (审核任务)**: 记录年度/季度/专项评估任务实例。
- **AuditItem (评估指标条目)**: 对应集团 101 项标准条目定义。
- **EvidenceMaterial (佐证材料)**: 协调员上传的安全凭据档案。
- **RectificationOrder (整改工单)**: 针对低成熟度项触发的闭环工单。

### 2. 数据库表结构规约 (MySQL / PostgreSQL)
\`\`\`sql
CREATE TABLE t_audit_task (
  id VARCHAR(64) PRIMARY KEY COMMENT '任务唯一标识',
  task_name VARCHAR(128) NOT NULL COMMENT '评估任务名称',
  factory_code VARCHAR(32) NOT NULL COMMENT '工厂编码如 CD01',
  status VARCHAR(24) NOT NULL DEFAULT 'DRAFT' COMMENT '状态: DRAFT, SUBMITTED, AUDITING, CLOSED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
\`\`\``,
}

const DEFAULT_PROJECTS: BlueprintProject[] = [
  {
    id: 'p1',
    name: '成都工厂工控安全运营平台业务设计',
    department: '智能制造与工控安全部',
    role: '数字化产品经理',
    updatedAt: '2026-09-22 13:08',
    type: 'pm',
    promptText: SAMPLE_CHENGDU_PROMPT,
    isRagEnabled: true,
    selectedKb: 'vw-safety-standard',
    stepResults: SAMPLE_CHENGDU_STEPS,
  },
  {
    id: 'p2',
    name: '总装车间整车面漆缺陷 AI 智能质检规约',
    department: '质保部 / 漆业车间',
    role: '数字化产品经理',
    updatedAt: '2026-09-21 16:45',
    type: 'pm',
    promptText: `总装与涂装车间漆面缺陷视觉质检系统业务规格设计
核心需求：
1. 针对总装车间下线车辆的漆面颗粒、流挂、橘皮、划伤进行 4 台工业线阵相机拍照。
2. 缺陷定位需映射到车身三维模型（CAD 坐标系），精准标注坐标与缺陷尺寸。
3. 联动质量看板，支持质检员在平板上复核确认或修正标注。
4. 闭环流转：严重缺陷直接联动 MES 阻断放行，推送返工工位。`,
    isRagEnabled: false,
    selectedKb: 'none',
    stepResults: {
      '6': '# 整车面漆缺陷 AI 智能质检规约立项书\n\n### 1. 业务背景与目标\n结合产线 4 台工业高速线阵相机，在车辆通过检测光拱时进行 360 度表面点云与高动态图像采集，通过端侧 AI 模型在 12 秒内完成整车漆面微米级缺陷识别与三维坐标映射。',
    },
  },
  {
    id: 'p3',
    name: '焊装车间机器人焊点质量监控平台',
    department: '焊装车间 / 工艺装备部',
    role: '数字化产品经理',
    updatedAt: '2026-09-18 10:20',
    type: 'pm',
    promptText: `焊装车间白车身电阻点焊质量实时监控与预测性维护平台
1. 采集 KUKA/FANUC 机器人焊接控制器毫秒级电流、电压、位移、动态阻抗曲线。
2. 识别虚焊、飞溅、过烧等隐性缺陷，提供焊点飞溅预警。`,
    isRagEnabled: false,
    selectedKb: 'none',
    stepResults: {},
  },
]

export function getStoredProjects(): BlueprintProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PROJECTS))
      return DEFAULT_PROJECTS
    }
    const parsed = JSON.parse(raw) as BlueprintProject[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PROJECTS
  } catch {
    return DEFAULT_PROJECTS
  }
}

export function saveStoredProject(project: BlueprintProject): void {
  try {
    const list = getStoredProjects()
    const index = list.findIndex(p => p.id === project.id)
    if (index >= 0) {
      list[index] = { ...project, updatedAt: formatNow() }
    } else {
      list.unshift({ ...project, updatedAt: formatNow() })
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (err) {
    console.error('Failed to save project to localStorage', err)
  }
}

export function createStoredProject(name: string, department: string): BlueprintProject {
  const newProject: BlueprintProject = {
    id: `p_${Date.now()}`,
    name: name.trim() || '未命名蓝图设计项目',
    department: department.trim() || '数字化业务部门',
    role: '数字化产品经理',
    updatedAt: formatNow(),
    type: 'pm',
    promptText: `项目名称：${name}\n所属部门：${department}\n创建日期：${formatNow()}\n\n请在此处输入您的核心业务需求、业务场景、涉众角色及系统期望...`,
    isRagEnabled: false,
    selectedKb: 'none',
    stepResults: {},
  }
  const list = getStoredProjects()
  list.unshift(newProject)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (err) {
    console.error('Failed to create new project in localStorage', err)
  }
  return newProject
}

export function deleteStoredProject(id: string): BlueprintProject[] {
  try {
    const list = getStoredProjects().filter(p => p.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    return list
  } catch {
    return getStoredProjects()
  }
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

export function exportFullBlueprintMarkdown(project: BlueprintProject): string {
  const header = `# 【企业数字化架构蓝图规格全书】\n\n- **项目名称**：${project.name}\n- **所属部门**：${project.department}\n- **架构角色**：${project.role}\n- **最新修订**：${project.updatedAt}\n\n---\n\n`
  const body = STEPS_CONFIG.map((step) => {
    const content = project.stepResults[step.id.toString()] || '*(该步骤尚未生成规约产物)*'
    return `## 【第 ${step.id} 步 · 规约】${step.title}\n\n${content}\n\n---\n`
  }).join('\n')
  return header + body
}

export function exportFullTrainerCoursewareMarkdown(project: BlueprintProject): string {
  const meta = project.trainerMeta || {
    title: `${project.name}实操认证培训`,
    industry: '汽车工业 / 智能制造',
    targetAudience: '车间班组长、工艺工程师、工控协调员',
    durationMinutes: 120,
    stylePreset: '科技蓝',
  }
  const header = `# 【企业合规与数字化赋能培训全案】\n\n- **课程主题**：${meta.title}\n- **所属行业**：${meta.industry}\n- **目标受众**：${meta.targetAudience}\n- **建议课时**：${meta.durationMinutes} 分钟\n- **设计角色**：OPC 流程合规培训师\n- **最新修订**：${project.updatedAt}\n\n---\n\n`
  const results = project.trainerStepResults || {}
  const body = TRAINER_STEPS_CONFIG.map((step) => {
    const content = results[step.id] || '*(该工序尚未生成交付产物)*'
    return `## 【${step.num}】${step.title}（${step.phase}）\n\n> 阶段目标：${step.description}\n\n${content}\n\n---\n`
  }).join('\n')
  return header + body
}
