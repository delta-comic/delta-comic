import {
  ClientRuntime,
  type ClientRouteRegistration,
  type ClientUiRegistrars,
} from '@delta-comic/client'
import { db, type DB } from '@delta-comic/db'
import { shallowReactive } from 'vue'
import type { Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'

import { router } from './router'

export interface AppNavigationRegistration {
  readonly item: ClientRouteRegistration
  readonly owner: string
}

export const appNavigation = shallowReactive<AppNavigationRegistration[]>([])

const appCommands = new Map<string, { handler: () => void | Promise<void>; owner: string }>()

export const invokeAppCommand = async (id: string) => {
  const command = appCommands.get(id)
  if (!command) throw new Error(`Unknown app command: ${id}`)
  await command.handler()
}

const removeNavigation = (item: AppNavigationRegistration) => {
  const index = appNavigation.indexOf(item)
  if (index >= 0) appNavigation.splice(index, 1)
}

const pluginPath = (owner: string, path: string) => {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const prefix = `/plugins/${owner}`
  return normalized === prefix || normalized.startsWith(`${prefix}/`)
    ? normalized
    : `${prefix}${normalized}`
}

const registerRoute = (route: ClientRouteRegistration, owner: string) => {
  if (!route.component) throw new Error(`Client route ${route.path} requires a component`)
  const path = pluginPath(owner, route.path)
  const name = `plugin:${owner}:${path}`
  if (router.hasRoute(name)) throw new Error(`App route is already registered: ${path}`)
  const record: RouteRecordRaw = {
    component: route.component,
    meta: { title: route.title },
    name,
    path,
  }
  router.addRoute(record)
  return () => router.hasRoute(name) && router.removeRoute(name)
}

const registerNavItem = (item: ClientRouteRegistration, owner: string) => {
  const registration = { item: { ...item, path: pluginPath(owner, item.path) }, owner }
  appNavigation.push(registration)
  return () => removeNavigation(registration)
}

const registerCommand = (id: string, handler: () => void | Promise<void>, owner: string) => {
  const previous = appCommands.get(id)
  if (previous && previous.owner !== owner) {
    throw new Error(`App command is already registered: ${id}`)
  }
  appCommands.set(id, { handler, owner })
  return () => {
    if (appCommands.get(id)?.owner !== owner) return
    if (previous) appCommands.set(id, previous)
    else appCommands.delete(id)
  }
}

export const clientUiRegistrars: ClientUiRegistrars = {
  command: registerCommand,
  navItem: registerNavItem,
  route: registerRoute,
}

export const appClientRuntime = new ClientRuntime<DB>({
  database: { db, query: (_name, operation) => operation(db) },
  pluginId: 'app',
  uiRegistrars: clientUiRegistrars,
})

export const disposeAppClientRuntime = () => appClientRuntime.dispose()

export type AppClientComponent = Component