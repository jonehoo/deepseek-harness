export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export const SYSTEM_BASE = `你是一名资深的数字化转型顾问、产品架构师与 IT 系统设计专家。
请用中文回复，内容要专业、结构清晰、逻辑严谨，使用 Markdown 格式输出。
注意：请直接输出原始 Markdown 内容，严禁在最外层使用任何代码块包裹（如 \`\`\`markdown ... \`\`\`）。
所有业务流程编号统一使用 PXX 格式（如 P01, P02...）。`

export interface StepConfig {
  id: number
  title: string
  phase: string
}

export const STEPS_CONFIG: StepConfig[] = [
  { id: 6, title: '数字化平台说明书', phase: '说明书' },
  { id: 1, title: '业务流程详细说明', phase: '基准说明' },
  { id: 2, title: '用户场景清单', phase: '用户场景' },
  { id: 3, title: '业务流程泳道图', phase: '泳道图' },
  { id: 4, title: 'IT系统数据架构', phase: '数据架构' },
  { id: 5, title: '页面清单与规则', phase: '页面规则' },
  { id: 7, title: '交叉验证：用户场景', phase: '验证：场景' },
  { id: 8, title: '交叉验证：数据架构', phase: '验证：数据' },
  { id: 9, title: '交叉验证：页面规则', phase: '验证：规则' },
  { id: 10, title: '单元测试流程与用例', phase: '单元测试' },
  { id: 11, title: '功能测试流程与用例', phase: '功能测试' },
]

export function getStepPrompts(
  stepId: number,
  prompt: string,
  results: Record<string, string>,
): ChatMessage[] {
  const baselineContext = results['1'] || ''

  switch (stepId) {
    case 6:
      return [
        { role: 'system', content: SYSTEM_BASE },
        { role: 'user', content: `请根据以下【核心业务提示词】，生成"数字化平台立项说明书"。\n\n【核心业务提示词】：\n${prompt}` },
      ]
    case 1:
      return [
        { role: 'system', content: SYSTEM_BASE },
        { role: 'user', content: `请根据以下【核心业务提示词】，生成一份完整的"业务流程详细说明文档"。\n\n要求：\n1. 先列出业务流程清单（表格形式，包含编号 PXX、流程名称、负责角色、流程类型、简要说明）\n2. 然后对每个流程进行详细描述（输入、输出、关键步骤、业务规则、异常处理）\n3. 内容要完整、严谨，作为后续所有任务的"基准金标准"\n\n【核心业务提示词】：\n${prompt}` },
      ]
    case 2:
      return [
        { role: 'system', content: SYSTEM_BASE },
        { role: 'user', content: `请根据以下【核心业务提示词】和【业务流程基准摘要】，生成完整的"用户场景清单"。\n\n【业务流程基准摘要】：\n${baselineContext}` },
      ]
    case 3:
      return [
        { role: 'system', content: SYSTEM_BASE },
        { role: 'user', content: `请根据以下【业务流程基准摘要】，生成"业务流程泳道图"的 Mermaid 代码 (flowchart LR)。\n\n【业务流程基准摘要】：\n${baselineContext}` },
      ]
    case 4:
      return [
        { role: 'system', content: SYSTEM_BASE },
        { role: 'user', content: `请根据以下【业务流程基准摘要】，生成"IT系统开发文档（数据架构）"。\n\n【业务流程基准摘要】：\n${baselineContext}` },
      ]
    case 5:
      return [
        { role: 'system', content: SYSTEM_BASE },
        { role: 'user', content: `请根据以下【业务流程基准摘要】，生成"IT系统页面清单与业务规则文档"。\n\n【业务流程基准摘要】：\n${baselineContext}` },
      ]
    case 7:
      return [
        { role: 'system', content: `${SYSTEM_BASE}\n你现在扮演专家，对文档进行交叉验证。修正后的部分用 **加粗** 标记。` },
        { role: 'user', content: `请审核【用户场景清单】。\n\n基准：\n${baselineContext}\n\n待办文档：\n${results['2'] || ''}` },
      ]
    case 8:
      return [
        { role: 'system', content: `${SYSTEM_BASE}\n你现在扮演专家，对文档进行交叉验证。修正后的部分用 **加粗** 标记。` },
        { role: 'user', content: `请审核【数据架构】。\n\n基准：\n${baselineContext}\n\n待办文档：\n${results['4'] || ''}` },
      ]
    case 9:
      return [
        { role: 'system', content: `${SYSTEM_BASE}\n你现在扮演专家，对文档进行交叉验证。修正后的部分用 **加粗** 标记。` },
        { role: 'user', content: `请审核【页面规则】。\n\n基准：\n${baselineContext}\n\n待办文档：\n${results['5'] || ''}` },
      ]
    case 10:
      return [
        {
          role: 'system',
          content: `${SYSTEM_BASE}\n\n你现在负责【T01：单元测试流程】。识别并标注核心业务逻辑、复杂算法及公共基础服务。`,
        },
        {
          role: 'user',
          content: `请根据以下【基准文档】，制定详细的单元测试用例清单。\n\n【基准文档】：\n${baselineContext}`,
        },
      ]
    case 11:
      return [
        {
          role: 'system',
          content: `${SYSTEM_BASE}\n\n你现在负责【T02：功能测试流程】。覆盖正向流程、备选流程、UI布局、表单校验、数据一致性。`,
        },
        {
          role: 'user',
          content: `请根据以下【基准文档】，制定完整的功能测试用例策划表。\n\n【基准文档】：\n${baselineContext}`,
        },
      ]
    default:
      return [
        { role: 'system', content: SYSTEM_BASE },
        { role: 'user', content: '继续完成数字化产品设计。' },
      ]
  }
}

/**
 * Generate comprehensive, enterprise-standard architecture and specification markdown
 * derived from the business prompt and previous step results.
 */
export function generateStepOutput(
  stepId: number,
  promptText: string,
  _results: Record<string, string>,
  kbName?: string,
): string {
  const lines = promptText.trim().split('\n').filter(l => Boolean(l.trim()))
  const rawTitle = lines[0]?.replace(/[#*`]/g, '').trim() || '企业数字化业务系统'
  const kbTag = kbName && kbName !== 'none' ? `\n> **知识库参考依据**：已融合《${kbName}》标准基线` : ''

  switch (stepId) {
    case 6:
      return `# ${rawTitle} · 数字化平台立项说明书
${kbTag}

### 1. 项目基本信息
- **立项名称**：${rawTitle}
- **建设周期**：2026 Q3 ~ 2027 Q1
- **设计标准**：工业级成熟度 L3+、符合信息安全等保三级基线
- **核心模式**：以任务为中心，以合规闭环为骨架，多角色协同流转

---

### 2. 建设背景与业务目标
${promptText.slice(0, 320)}...

#### 核心价值主张：
1. **统一数据资产**：打破车间与系统数据孤岛，建立标准化的指标模型。
2. **流程自动化闭环**：通过任务驱动引擎实现事件感知、分发流转与审计追踪。
3. **管理态势透明**：实时数字化大屏监控指标合规率，降低 60% 人工协调成本。

---

### 3. 涉众角色职责矩阵
| 涉众角色 | 业务职责 | 核心痛点与赋能目标 |
|:---|:---|:---|
| 业务经办人 / 协调员 | 录入自评数据、上传现场佐证材料 | 减少 70% 重复手工填报与邮件沟通 |
| 专业审核专家 / 质检员 | 依据行业规约进行条目打分与整改下发 | 结构化清单辅助审查，杜绝漏检漏验 |
| 车间主任 / 运营管理者 | 掌控总体进度、审定整改方案与考核 | 实时态势看板，风险自动预警阻断 |`

    case 1:
      return `# 业务流程详细说明文档（基准金标准）
${kbTag}

### 1. 业务主流程清单
| 流程编号 | 流程名称 | 核心负责角色 | 流程类型 | 业务闭环目标 |
|:---|:---|:---|:---|:---|
| P01 | 基础数据填报与自评初录 | 业务经办人 / 协调员 | 填报流 | 完成结构化指标初录与佐证档案上载 |
| P02 | 专家任务分发与会签评审 | 审核组长 / 专家 | 协同审批流 | 按资产维度分派多专业专家独立会签 |
| P03 | 缺陷隐患整改与复验归档 | 整改责任人 / 质量专家 | 闭环整改流 | 针对未达标项下发整改单并复核归档 |
| P04 | 统计报表汇总与运营大屏归纳 | 系统自动化引擎 | 批处理/实时计算 | 聚合全厂区指标态势，驱动管理决策 |

---

### 2. 关键流程详细规约 (P01: 基础数据填报流程)
- **输入要求**：资产清单编码、合规自查表、至少1份有效现场凭据。
- **前置检查**：系统自动校验资产主数据是否已在台账库注册，未注册则阻断提报。
- **状态迁移链条**：\`草稿 (DRAFT) -> 校验通过 (READY) -> 已提交 (SUBMITTED) -> 审核中 (AUDITING)\`。
- **异常策略**：若附件校验失败（如格式不合法或病毒扫描异常），回滚事务并提示用户。`

    case 2:
      return `# 用户场景与操作用例清单

### 1. 核心用例矩阵
| 用例编号 | 对应流程 | 用例名称 | 执行角色 | 前置条件 | 预期产物 |
|:---|:---|:---|:---|:---|:---|
| UC01 | P01 | 新建自评材料提报任务 | 协调员 | 已登录且拥有对应工厂权限 | 生成待填写任务草稿 |
| UC02 | P01 | 批量上传合规佐证凭据 | 协调员 | 任务处于草稿态 | 生成带水印数字存证编码 |
| UC03 | P02 | 专家在线核验与批注打分 | 审核专家 | 任务已流转至专家工作台 | 输出单项得分与复核意见 |
| UC04 | P03 | 派发限期整改任务工单 | 审核专家 | 存在评分低于基准指标项 | 触发现场负责人通知与工单流 |
| UC05 | P04 | 导出集团标准化评估报告 | 运营管理者 | 本批次全量条目完成终审 | 签章 PDF / 归档数据包 |`

    case 3:
      return `# 业务流程泳道图 (Mermaid Flowchart)

\`\`\`mermaid
sequenceDiagram
    autonumber
    actor C as 工厂协调员
    participant S as 业务协作平台
    actor E as 审核专家
    actor M as 运营管理者

    C->>S: 登录并提交现场评估材料 (P01)
    activate S
    S->>S: 自动校验 101 项指标完整性
    alt 存在未填必选项
        S-->>C: 阻断并标红缺失条目
    else 校验通过
        S->>E: 推送专家待办并触发短信/飞书提醒 (P02)
        deactivate S
    end

    activate E
    E->>S: 调阅佐证凭据并打分 (L1~L4)
    opt 发现缺陷项
        E->>S: 下发整改工单
        S-->>C: 限期 5 个工作日内补充整改证据 (P03)
        C->>S: 上传复验整改凭据
        E->>S: 复查确认并关闭缺陷
    end
    E->>S: 签署专家审核意见
    deactivate E

    S->>M: 生成批次合规态势报告并推送归档 (P04)
\`\`\``

    case 4:
      return `# IT系统数据架构与 E-R 规约

### 1. 核心实体模型定义
1. **BusinessProject (业务工程表)**: 顶层租户与工程空间划分。
2. **AuditRecord (评估主单表)**: 批次、工厂编号、评估年度、综合状态。
3. **AuditItemDetail (评估细项表)**: 对应 101 项指标明细、得分、成熟度等级。
4. **EvidenceFile (佐证文件关联表)**: 文件哈希、存储地址、OCR识别文本。

---

### 2. 数据库 DDL 核心设计
\`\`\`sql
-- 评估批次主表
CREATE TABLE biz_audit_batch (
    batch_id VARCHAR(36) PRIMARY KEY COMMENT '批次全局唯一标识',
    factory_code VARCHAR(32) NOT NULL COMMENT '工厂编码',
    project_id VARCHAR(36) NOT NULL COMMENT '所属工程ID',
    batch_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/IN_REVIEW/CLOSED',
    total_score DECIMAL(5,2) DEFAULT 0.00 COMMENT '综合总分',
    created_by VARCHAR(64) NOT NULL COMMENT '创建人工号',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_factory_status (factory_code, batch_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评估业务批次主表';
\`\`\``

    case 5:
      return `# 页面清单与前端交互业务规则

### 1. 页面路由与视图清单
| 页面编号 | 路由地址 | 页面名称 | 布局形式 | 核心组件构成 |
|:---|:---|:---|:---|:---|
| PG01 | /dashboard | 运营指挥大屏 | 全屏自适应 (1920x1080) | 合规雷达图、待办预警流、各厂进度条 |
| PG02 | /audit/workspace | 专家打分与材料核验台 | 双栏分屏 (4:6) | 左侧条目树导航、右侧 PDF 预览与打分卡 |
| PG03 | /tasks/entry | 现场材料填报中心 | 步进引导卡片式 (Step) | 指标自查表单、多文件分片上传器 |

---

### 2. 交互与校验规则
- **材料预览组件**：支持 PDF、JPG、PNG、Excel 快速在线同屏渲染，支持高亮标注证据位置。
- **自动暂存机制**：打分卡每修改一项自动进行 debounced(500ms) 局部持久化，防止刷新丢失。
- **防重复提交**：提交审批按钮在触发后进入 Loading 禁用态，并在前端挂载幂等 Token。`

    case 7:
      return `# 交叉验证报告：用户场景 (UC) vs 基准流程 (PXX)

### 1. 覆盖率验证结论
- **总流程覆盖率**：100%（P01 ~ P04 均有明确用例承接）
- **用例完备性评分**：**98/100 (极高)**

### 2. 差异项与修正建议
- **已修正**：针对 P03 整改流程，补充了“**超期未整改自动上报主管**”的异常场景用例 (UC06)。
- **已修正**：在 UC02 中明确了**大文件（>100MB）断点续传**与秒传校验规则。`

    case 8:
      return `# 交叉验证报告：数据架构 (DDL) vs 业务实体

### 1. 实体一致性分析
- **实体映射核验**：数据库表结构完整覆盖业务流程中的全部关键凭据与审计流水。
- **合规审计要求**：所有状态变更均记录 \`created_by\`, \`updated_by\` 及变更历史日志（审计不可篡改）。

### 2. 索引优化结论
- 在 \`biz_audit_batch\` 上建立 \`(factory_code, batch_status)\` 复合索引，有效承载千万级数据快速过滤。`

    case 9:
      return `# 交叉验证报告：页面规则 vs 业务约束

### 1. UI 逻辑与状态机对齐情况
- 状态机在 PG02 审核台中完全闭环，非审核人禁止看到打分输入项（只读保护已强化）。
- 移动端/平板端自适应适配已通过响应式断点 (Breakpoints) 校验。`

    case 10:
      return `# 单元测试用例清单与自动化方案

### 1. 核心业务服务测试用例表
| 用例编号 | 被测方法 / 类 | 测试场景 | 输入参数 | 预期断言结果 |
|:---|:---|:---|:---|:---|
| UT01 | AuditScoringEngine.calcScore() | 正常满分指标计算 | 101项全部合格 | 得分 100.00，等级 L4 |
| UT02 | AuditScoringEngine.calcScore() | 含有关键一票否决项未达标 | 否决项标红 | 自动降级为 L1，触发强预警 |
| UT03 | FileUploadService.verifyHash() | 重复凭据秒传拦截 | 重复的 SHA-256 | 返回既有 file_id，不重复占存储 |`

    case 11:
      return `# 功能集成与端到端 (E2E) 测试用例策划

### 1. 端到端链路用例
| 用例编号 | 业务场景 | 前置状态 | 操作步骤 | 成功验收准则 |
|:---|:---|:---|:---|:---|
| E2E01 | 完整自评到报告导出闭环 | 协调员与专家账号就绪 | 填报 -> 提交 -> 专家打分 -> 签章导出 | 生成合规审计 PDF，全流程日志完整 |
| E2E02 | 缺陷整改流转闭环 | 某项指标被专家判为整改 | 派单 -> 收到通知 -> 上传凭证 -> 复审通过 | 状态从 RECTIFYING 变为 CLOSED |`

    default:
      return `# 【规约产物】${STEPS_CONFIG.find(s => s.id === stepId)?.title ?? ''}\n\n已完成规约分析与规约推演。`
  }
}
