<script setup lang="ts">
import { translatePluginText, usePluginStore, type PluginLoadingInfo } from '@delta-comic/plugin'
import { createLoadingMessage, DcCell } from '@delta-comic/ui'
import { motion } from 'motion-v'
import { NButton, NSpin } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const $props = defineProps<{ bootingSteps: Record<string, PluginLoadingInfo> }>()

const pluginStore = usePluginStore()
const { t } = useI18n()

const rebootApp = () => {
  createLoadingMessage(t('plugin.loading.restarting'))
  location.reload()
}

const isHaveError = computed(() =>
  Object.values($props.bootingSteps).some(value => value.progress.status === 'error'),
)

const visibleSteps = computed(() =>
  Object.entries($props.bootingSteps).filter(([, value]) => value.progress.status !== 'done'),
)

const getProgressLabel = ({ steps, progress }: PluginLoadingInfo) => {
  const step = steps[progress.stepsIndex]
  const description = step
    ? `${translatePluginText(step.name)}: ${translatePluginText(step.description)}`
    : t('common.status.processing')
  if (progress.status !== 'error' || !progress.errorReason) return description
  return `${description}\n${progress.errorReason}`
}
</script>

<template>
  <div>
    <!-- loading list -->
    <motion.div
      :initial="{ opacity: 0, scale: '50%', translateY: '85px' }"
      :exit="{ opacity: 0, scale: '50%', translateY: '85px' }"
      :animate="{ opacity: 1, scale: '100%', translateY: '0px' }"
    >
      <DcCellGroup class="h-80 w-[80vw] shadow-2xl" inset>
        <TransitionGroup name="list" tag="div" class="size-full!">
          <!-- display toy item -->
          <DcCell title="core" :label="t('plugin.loading.appContent')" center key="core">
            <template #right-icon>
              <NSpin :size="25" />
            </template>
          </DcCell>
          <!-- acutely item -->
          <DcCell
            v-for="[plugin, info] in visibleSteps"
            :key="plugin"
            :title="pluginStore.$getI18nName(plugin)"
            :label="getProgressLabel(info)"
            :class="[info.progress.status === 'error' && 'bg-(--nui-error-color)/20!']"
          />
        </TransitionGroup>
      </DcCellGroup>
    </motion.div>

    <!-- reload button -->
    <motion.div
      :initial="{ opacity: 0, scale: '50%', translateY: '85px' }"
      :exit="{ opacity: 0, scale: '50%', translateY: '85px' }"
      class="relative"
      :animate="{ opacity: 1, scale: '100%', translateY: '0px' }"
      v-if="isHaveError"
    >
      <NButton type="primary" class="absolute! right-10!" @click="rebootApp">
        {{ t('common.actions.reload') }}
      </NButton>
    </motion.div>
  </div>
</template>