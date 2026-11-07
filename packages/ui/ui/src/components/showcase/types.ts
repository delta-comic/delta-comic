export interface ShowcaseNavItem {
  name: string
  label: string
  description: string
  path: string
  group: ShowcaseGroup
}

export type ShowcaseGroup =
  | '基础组件'
  | '反馈组件'
  | '导航组件'
  | '数据展示'
  | '运行环境'
  | '表单组件'
  | '函数 API'

export interface ShowcaseSectionDefinition {
  id: string
  label: string
}

export interface ShowcaseEntry extends ShowcaseNavItem {
  slug: string
  kind: 'component' | 'api'
  tags: string[]
  sections: ShowcaseSectionDefinition[]
}