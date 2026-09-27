import * as Pc from '@pinia/colada'
import * as Naive from 'naive-ui'
import * as Pinia from 'pinia'
import * as Vue from 'vue'
import * as VR from 'vue-router'
import * as VRExperimental from 'vue-router/experimental'

export const hostLibraries = { Vue, Naive, VR, VRExperimental, Pinia, Pc } as const

const hostWindow = window as Window & { $$lib$$?: Record<string, unknown> }
Object.assign((hostWindow.$$lib$$ ??= {}), hostLibraries)

export default hostLibraries