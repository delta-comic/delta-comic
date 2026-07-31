import type { UniContentPage, UniImage } from '@delta-comic/model'
import type { Component } from 'vue'

export interface Config {
  initiative: InitiativeItem[]
  tokenListen: ShareToken[]
}

export interface ShareToken {
  key: string
  name: string
  patten(chipboard: string): boolean
  show(chipboard: string): Promise<PopupConfig> | PopupConfig
}

export interface PopupConfig {
  title: string
  detail: string
  onPositive(): void
  onNegative(): void
}

export interface InitiativeItem {
  key: string
  name: string
  icon: Component | UniImage
  bgColor?: string
  call(page: UniContentPage): Promise<{ token?: string } | void>
  filter(page: UniContentPage): boolean
}