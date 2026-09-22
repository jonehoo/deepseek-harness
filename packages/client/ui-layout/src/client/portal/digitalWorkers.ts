export interface CapabilityLayer {
  level: string
  items: string[]
}

export interface DigitalWorker {
  id: string
  name: string
  roleTitle: string
  avatar: string
  avatarTone: string
  userDescription: string
  callExample: string
  capabilityLayers: CapabilityLayer[]
  mode: 'pm-studio' | 'chat'
  systemPrompt?: string
}

export const DIGITAL_WORKERS: DigitalWorker[] = [
  {
    id: 'pm-studio',
    name: '数字化产品经理',
    roleTitle: '负责提炼方案，为决策提供支撑',
    avatar: '/employee-avatars/product-manager.png',
    avatarTone: 'linear-gradient(145deg, #2563eb, #1d4ed8)',
    userDescription: '负责持续收集竞品信息、自动抽取数据并生成对比矩阵与策略建议，支撑产品决策。',
    callExample: '查一下某竞品近期的品牌营销动作',
    capabilityLayers: [
      { level: 'L1', items: ['信息抓取', '数据清洗', '参数对比'] },
      { level: 'L2', items: ['竞品追踪', '差异化机会研判'] },
      { level: 'L3', items: ['对标策略', '业务优化建议'] },
    ],
    mode: 'pm-studio',
  },
  {
    id: 'cost-analyst',
    name: '成本分析师',
    roleTitle: '全周期成本测算、目标拆解与偏差管控',
    avatar: '/employee-avatars/pro-sales.png',
    avatarTone: 'linear-gradient(145deg, #0284c7, #0369a1)',
    userDescription: '负责项目全生命周期的成本建模测算、降本空间挖掘与动态偏差预警，支撑财务与运营决策。',
    callExample: '测算一下该架构改造的年度运营成本',
    capabilityLayers: [
      { level: 'L1', items: ['成本拆解', '基线对比', '费用归集'] },
      { level: 'L2', items: ['降本诊断', '投资回报ROI测算'] },
      { level: 'L3', items: ['战略预算', '动态偏差预警'] },
    ],
    mode: 'chat',
  },
  {
    id: 'opc-trainer',
    name: 'OPC 流程合规培训师',
    roleTitle: '课件架构、内容生产与排期交付',
    avatar: '/employee-avatars/pro-training.png',
    avatarTone: 'linear-gradient(145deg, #059669, #047857)',
    userDescription: '负责将业务需求转化为标准课件与培训计划，自动生成内容与排期，提升培训交付效率。',
    callExample: '让培训策划专员把Q3课件排期跑出来',
    capabilityLayers: [
      { level: 'L1', items: ['课件排版', '大纲生成', '签到统计'] },
      { level: 'L2', items: ['培训缺口诊断', '学习路径定制'] },
      { level: 'L3', items: ['出题阅卷', '效果复盘报告'] },
    ],
    mode: 'chat',
  },
  {
    id: 'sales-analyst',
    name: '销售分析师',
    roleTitle: '销售漏斗监控、业绩归因与策略建议',
    avatar: '/employee-avatars/automotive-sales.png',
    avatarTone: 'linear-gradient(145deg, #d97706, #b45309)',
    userDescription: '实时监控全渠道销售漏斗与关键转化率，自动归因异动因素，输出标准化战报与改进策略。',
    callExample: '分析一下本周重点区域的线索转化率下降原因',
    capabilityLayers: [
      { level: 'L1', items: ['数据清洗', '战报生成', '指标监控'] },
      { level: 'L2', items: ['转化漏斗归因', '客户画像聚类'] },
      { level: 'L3', items: ['销售话术优化', '业绩目标预测'] },
    ],
    mode: 'chat',
  },
  {
    id: 'knowledge-operator',
    name: '知识库运营专员',
    roleTitle: '聚焦知识采集、清洗打标、体系维护与版本更新',
    avatar: '/employee-avatars/knowledge-asset-operator.png',
    avatarTone: 'linear-gradient(145deg, #2563eb, #0f766e)',
    userDescription: '负责企业私有知识库的全流程治理，确保知识资产的准确性、时效性与高召回率。',
    callExample: '治理一下数字化工艺知识库的过期待审条目',
    capabilityLayers: [
      { level: 'L1', items: ['知识采集', '内容清洗', '标签打标'] },
      { level: 'L2', items: ['知识缺口诊断', '复用率分析'] },
      { level: 'L3', items: ['目录维护', '检索优化建议'] },
    ],
    mode: 'chat',
  },
  {
    id: 'equipment-maintenance',
    name: '设备运维专员',
    roleTitle: '设备状态巡检、故障树匹配与工单调度',
    avatar: '/employee-avatars/automotive-maintenance.png',
    avatarTone: 'linear-gradient(145deg, #4f46e5, #4338ca)',
    userDescription: '负责工业设备运行状态监测，根据故障特征快速匹配专家知识库并派发标准化处置方案。',
    callExample: '匹配一下喷涂车间 3 号机器人的异常代码',
    capabilityLayers: [
      { level: 'L1', items: ['故障记录', '备件核对', '工单派发'] },
      { level: 'L2', items: ['故障树匹配', '维修方案比选'] },
      { level: 'L3', items: ['进度通报', '维保周期提醒'] },
    ],
    mode: 'chat',
  },
  {
    id: 'quality-auditor',
    name: '质量专员',
    roleTitle: '质量缺陷追溯、8D 报告生成与合规稽查',
    avatar: '/employee-avatars/automotive-quality.png',
    avatarTone: 'linear-gradient(145deg, #0891b2, #0e7490)',
    userDescription: '负责生产与交付全环节的质量缺陷录入、根因分析追溯与 8D 整改措施督导。',
    callExample: '生成一份关于冲压件开裂的 8D 分析整改初稿',
    capabilityLayers: [
      { level: 'L1', items: ['客诉录入', '8D模板生成', '整改台账'] },
      { level: 'L2', items: ['根因追溯', '质量趋势预警'] },
      { level: 'L3', items: ['质量周报', '经验教训入库'] },
    ],
    mode: 'chat',
  },
  {
    id: 'supply-chain',
    name: '供应链采购专员',
    roleTitle: '供需匹配、寻源比价与交付风险预警',
    avatar: '/employee-avatars/1.png',
    avatarTone: 'linear-gradient(145deg, #0d9488, #115e59)',
    userDescription: '负责关键物料与服务的多供应商比价，实时监控交付前置期与供应链断供风险。',
    callExample: '评估一下下季度核心电控芯片的供应风险',
    capabilityLayers: [
      { level: 'L1', items: ['寻源比价', 'PO跟踪', '供应商台账'] },
      { level: 'L2', items: ['交期波动预警', '采购成本优化'] },
      { level: 'L3', items: ['战略供应商评估', '采购风险对冲'] },
    ],
    mode: 'chat',
  },
  {
    id: 'finance-auditor',
    name: '财务审核师',
    roleTitle: '凭证合规稽查、报销风控与税务稽核',
    avatar: '/employee-avatars/tax-filing.png',
    avatarTone: 'linear-gradient(145deg, #7c3aed, #6d28d9)',
    userDescription: '负责财务票据真伪校验、业务费用合理性合规审核，防范税务与审计风险。',
    callExample: '核查该笔海外技术支持费用的税务合规性',
    capabilityLayers: [
      { level: 'L1', items: ['发票核验', '凭证归类', '初审合规'] },
      { level: 'L2', items: ['预算占用校验', '异常开支拦截'] },
      { level: 'L3', items: ['合规审计报告', '税务筹划建议'] },
    ],
    mode: 'chat',
  },
]
