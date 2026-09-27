import { defineAsyncComponent, type Component } from 'vue'

const modules = import.meta.glob<{ default: Component }>('./demos/*Demo.vue')

export const demoModulePaths = Object.keys(modules)

export function getShowcaseDemo(componentName: string): Component | undefined {
  const load = modules[`./demos/${componentName}Demo.vue`]
  return load ? defineAsyncComponent(load) : undefined
}