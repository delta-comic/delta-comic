import type { uni } from '@delta-comic/model'
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
  icon: Component | uni.image.Image
  bgColor?: string
  call(page: uni.content.ContentPage): Promise<any>
  filter(page: uni.content.ContentPage): boolean
}