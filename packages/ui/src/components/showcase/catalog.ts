import type { ShowcaseEntry, ShowcaseGroup } from './types'

const component = (
  name: string,
  label: string,
  group: ShowcaseGroup,
  description: string,
  tags: string[],
  sections: ShowcaseEntry['sections'],
): ShowcaseEntry => {
  const slug = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLocaleLowerCase()
  return {
    name,
    label,
    group,
    description,
    slug,
    path: `/component/${slug}`,
    kind: 'component',
    tags,
    sections,
  }
}

export const componentEntries: readonly ShowcaseEntry[] = [
  component(
    'DcCell',
    'Cell 单元格',
    '基础组件',
    '承载标题、说明、值与跳转操作的基础信息行。',
    ['布局', '导航', '插槽'],
    [
      { id: 'cell-content', label: '内容与尺寸' },
      { id: 'cell-navigation', label: '导航与状态' },
      { id: 'cell-slots', label: '插槽定制' },
    ],
  ),
  component(
    'DcCellGroup',
    'CellGroup 单元格组',
    '基础组件',
    '将一组单元格组织为带标题、边框或嵌入样式的内容区。',
    ['分组', '嵌入', '标题'],
    [
      { id: 'cell-group-basic', label: '基础分组' },
      { id: 'cell-group-inset', label: '嵌入与插槽' },
    ],
  ),
  component(
    'DcAuthorIcon',
    'AuthorIcon 作者图标',
    '基础组件',
    '根据作者资源或插件注册信息展示来源图标。',
    ['作者', '插件资源', '尺寸'],
    [
      { id: 'author-icon-resource', label: '资源图标' },
      { id: 'author-icon-sizes', label: '尺寸与留白' },
    ],
  ),
  component(
    'DcImagedIcon',
    'ImagedIcon 图片图标',
    '基础组件',
    '统一渲染 Vue 图标组件和图片资源，并控制背景与留白。',
    ['图标', '图片资源', '样式'],
    [
      { id: 'imaged-icon-types', label: '图标类型' },
      { id: 'imaged-icon-spacing', label: '背景与留白' },
    ],
  ),
  component(
    'DcImage',
    'Image 图片',
    '基础组件',
    '支持加载、失败、重试、预览和适配模式的图片容器。',
    ['图片', '回退', '预览'],
    [
      { id: 'image-fits', label: '适配与形状' },
      { id: 'image-states', label: '加载与失败' },
      { id: 'image-options', label: '选项与事件' },
    ],
  ),
  component(
    'DcText',
    'Text 文本',
    '基础组件',
    '安全呈现纯文本、换行内容与可点击链接。',
    ['文本', '链接', '安全'],
    [
      { id: 'text-content', label: '文本内容' },
      { id: 'text-security', label: '链接与转义' },
    ],
  ),
  component(
    'DcToggleIcon',
    'ToggleIcon 切换图标',
    '基础组件',
    '带点击、长按与双向绑定能力的状态图标。',
    ['交互', '双向绑定', '布局'],
    [
      { id: 'toggle-icon-state', label: '状态切换' },
      { id: 'toggle-icon-layout', label: '尺寸与布局' },
    ],
  ),
  component(
    'DcVar',
    'Var 变量',
    '基础组件',
    '在模板中声明局部值并通过作用域插槽复用计算结果。',
    ['作用域插槽', '泛型', '模板'],
    [
      { id: 'var-values', label: '不同值类型' },
      { id: 'var-template', label: '模板复用' },
    ],
  ),
  component(
    'DcLoading',
    'Loading 加载',
    '反馈组件',
    '以不同尺寸、颜色和排布呈现加载状态。',
    ['加载', '尺寸', '颜色'],
    [
      { id: 'loading-appearances', label: '外观' },
      { id: 'loading-layouts', label: '排布与状态' },
    ],
  ),
  component(
    'DcAwait',
    'Await 异步等待',
    '反馈组件',
    '在模板中消费 Promise，并支持自动或手动执行。',
    ['Promise', '自动加载', '插槽'],
    [
      { id: 'await-auto', label: '自动执行' },
      { id: 'await-manual', label: '手动执行' },
    ],
  ),
  component(
    'DcContent',
    'Content 内容状态',
    '反馈组件',
    '统一组织加载、空内容、错误和成功数据状态。',
    ['加载', '空状态', '错误'],
    [
      { id: 'content-states', label: '内容状态' },
      { id: 'content-retained', label: '保留旧数据' },
      { id: 'content-overrides', label: '隐藏与样式' },
    ],
  ),
  component(
    'DcState',
    'State 查询状态',
    '反馈组件',
    '直接展示 Pinia Colada 查询的成功、加载与错误状态。',
    ['查询', '状态', '错误'],
    [
      { id: 'state-statuses', label: '查询状态' },
      { id: 'state-content', label: '内容定制' },
    ],
  ),
  component(
    'DcPullRefresh',
    'PullRefresh 下拉刷新',
    '反馈组件',
    '处理触摸下拉、刷新距离和禁用状态。',
    ['触摸', '刷新', '双向绑定'],
    [
      { id: 'pull-refresh-control', label: '刷新控制' },
      { id: 'pull-refresh-options', label: '距离与禁用' },
    ],
  ),
  component(
    'DcTab',
    'Tab 标签导航',
    '导航组件',
    '支持路由和本地状态的标签切换，可控制收缩与滑动。',
    ['标签', '导航', '滑动'],
    [
      { id: 'tab-local', label: '本地切换' },
      { id: 'tab-layout', label: '布局与插槽' },
    ],
  ),
  component(
    'DcList',
    'List 列表',
    '数据展示',
    '以单列虚拟滚动呈现大量或可变高度的数据。',
    ['虚拟滚动', '异步数据', '高度'],
    [
      { id: 'list-heights', label: '高度策略' },
      { id: 'list-refresh', label: '刷新控制' },
    ],
  ),
  component(
    'DcWaterfall',
    'Waterfall 瀑布流',
    '数据展示',
    '以固定或响应式列数虚拟化呈现不同高度的卡片。',
    ['瀑布流', '响应式', '间距'],
    [
      { id: 'waterfall-columns', label: '列数策略' },
      { id: 'waterfall-spacing', label: '间距与刷新' },
    ],
  ),
  component(
    'DcMarkdown',
    'Markdown 文档',
    '数据展示',
    '在隔离的 iframe 中渲染 Markdown，并支持主题和 MarkdownIt 配置。',
    ['Markdown', '主题', 'iframe'],
    [
      { id: 'markdown-syntax', label: '基础语法' },
      { id: 'markdown-config', label: '配置与主题' },
    ],
  ),
  component(
    'DcEnvironment',
    'Environment 环境插槽',
    '运行环境',
    '按扩展点名称和运行条件组合渲染已注册组件。',
    ['扩展点', '注册表', '条件渲染'],
    [
      { id: 'environment-register', label: '注册组件' },
      { id: 'environment-condition', label: '条件与参数' },
    ],
  ),
  component(
    'DcForm',
    'Form 动态表单',
    '表单组件',
    '根据配置生成完整表单并汇总双向绑定结果。',
    ['动态表单', '配置', '插槽'],
    [
      { id: 'form-generated', label: '配置生成' },
      { id: 'form-overrides', label: '行覆盖与插槽' },
    ],
  ),
  component(
    'DcFormItem',
    'FormItem 表单项',
    '表单组件',
    '为单项配置选择对应控件，并提供标签和校验布局。',
    ['表单项', '配置', '校验'],
    [
      { id: 'form-item-types', label: '配置类型' },
      { id: 'form-item-required', label: '必填与说明' },
    ],
  ),
  component(
    'DcFormString',
    'FormString 文本输入',
    '表单组件',
    '通过字符串配置控制输入类型、占位和模式。',
    ['输入框', '占位', '模式'],
    [
      { id: 'form-string-types', label: '输入类型' },
      { id: 'form-string-pattern', label: '占位与模式' },
    ],
  ),
  component(
    'DcFormNumber',
    'FormNumber 数字输入',
    '表单组件',
    '通过范围和精度配置采集整数或小数。',
    ['数字', '范围', '精度'],
    [
      { id: 'form-number-range', label: '范围' },
      { id: 'form-number-precision', label: '整数与小数' },
    ],
  ),
  component(
    'DcFormRadio',
    'FormRadio 单选',
    '表单组件',
    '在单选按钮组与下拉选择器之间切换呈现。',
    ['单选', '下拉框', '选项'],
    [
      { id: 'form-radio-buttons', label: '按钮组' },
      { id: 'form-radio-select', label: '下拉选择' },
    ],
  ),
  component(
    'DcFormCheckbox',
    'FormCheckbox 多选',
    '表单组件',
    '在复选框组与多选下拉框之间切换呈现。',
    ['多选', '复选框', '选项'],
    [
      { id: 'form-checkbox-group', label: '复选框组' },
      { id: 'form-checkbox-select', label: '多选下拉' },
    ],
  ),
  component(
    'DcFormSwitch',
    'FormSwitch 开关',
    '表单组件',
    '以可配置的开关文案呈现布尔字段。',
    ['开关', '文案', '默认值'],
    [
      { id: 'form-switch-labels', label: '状态文案' },
      { id: 'form-switch-defaults', label: '默认状态' },
    ],
  ),
  component(
    'DcFormDate',
    'FormDate 日期',
    '表单组件',
    '采集日期或日期时间，并按指定格式读写。',
    ['日期', '时间', '格式'],
    [
      { id: 'form-date-modes', label: '日期模式' },
      { id: 'form-date-formats', label: '格式' },
    ],
  ),
  component(
    'DcFormDateRange',
    'FormDateRange 日期范围',
    '表单组件',
    '采集日期或日期时间范围，并控制输出格式。',
    ['日期范围', '时间', '格式'],
    [
      { id: 'form-date-range-modes', label: '范围模式' },
      { id: 'form-date-range-formats', label: '格式' },
    ],
  ),
  component(
    'DcFormPairs',
    'FormPairs 键值对',
    '表单组件',
    '编辑单组或多组键值对，并支持增删行。',
    ['键值对', '动态行', '单项'],
    [
      { id: 'form-pairs-multiple', label: '多组键值' },
      { id: 'form-pairs-single', label: '单组限制' },
    ],
  ),
] as const

export const apiEntries: readonly ShowcaseEntry[] = [
  {
    name: 'Message',
    label: 'Message 消息',
    group: '函数 API',
    description: '面向异步流程的统一反馈实例，可在加载、成功、失败与主动销毁之间切换。',
    slug: 'message',
    path: '/component/message',
    kind: 'api',
    tags: ['反馈', 'Promise', '响应式文本'],
    sections: [
      { id: 'controlled-message', label: '可控状态消息' },
      { id: 'bound-task', label: '绑定异步任务' },
    ],
  },
] as const

export const showcaseEntries = [...componentEntries, ...apiEntries] as const

export const showcaseEntryBySlug = new Map(showcaseEntries.map(entry => [entry.slug, entry]))
export const showcaseEntryByPath = new Map(showcaseEntries.map(entry => [entry.path, entry]))