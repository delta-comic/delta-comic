<script
  setup
  lang="ts"
  generic="
    TKey extends EnvironmentKey,
    TComponent extends GlobalEnvironments[TKey] = GlobalEnvironments[TKey]
  "
>
import { logger } from '@delta-comic/logger'
import { computed } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import DcAwait from '../components/DcAwait.vue'

import {
  environmentRegistry,
  type EnvironmentKey,
  type EnvironmentRegistration,
  type GlobalEnvironments,
} from './registry'

const environmentLogger = logger.scoped('ui:environment')

const props = defineProps<{ args: ComponentProps<TComponent>; name: TKey }>()

const registrations = computed(() => environmentRegistry.forKey(props.name))

const matches = async (registration: EnvironmentRegistration<TKey>) => {
  try {
    return await registration.condition(props.args)
  } catch (error) {
    environmentLogger.warn('environment condition failed', { name: String(props.name) }, error)
    return false
  }
}
</script>

<template>
  <template v-for="registration in registrations" :key="registration.id">
    <DcAwait :promise="() => matches(registration)" auto-load>
      <template #default="{ result }">
        <component :is="registration.component" v-if="result" v-bind="args" />
      </template>
    </DcAwait>
  </template>
</template>