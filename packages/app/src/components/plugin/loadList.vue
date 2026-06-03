<script setup lang="ts">
import { usePluginStore, type Loader } from '@delta-comic/plugin'
import { createLoadingMessage, DcCell } from '@delta-comic/ui'
import { motion } from 'motion-v'
import { computed } from 'vue'

const $props = defineProps<{ bootingSteps: Record<string, Loader.PluginLoadingInfo> }>()

const pluginStore = usePluginStore()

const rebootApp = () => {
  createLoadingMessage('重启中')
  location.reload()
}

const isHaveError = computed(() =>
  Object.values($props.bootingSteps).some(v => v.progress.status == 'error'),
)
</script>

<template>
  <!-- loading list -->
  <motion.div
    :initial="{ opacity: 0, scale: '50%', translateY: '85px' }"
    :exit="{ opacity: 0, scale: '50%', translateY: '85px' }"
    :animate="{ opacity: 1, scale: '100%', translateY: '0px' }"
  >
    <DcCellGroup class="h-80 w-[80vw] shadow-2xl" inset>
      <TransitionGroup name="list" tag="ul" class="size-full!">
        <!-- display toy item -->
        <DcCell title="core" label="载入应用内容..." center key="core">
          <template #right-icon>
            <VanLoading size="25px" />
          </template>
        </DcCell>
        <!-- acutely item -->
        <template v-for="[plugin, { steps, progress }] in Object.entries(bootingSteps)">
          <DcCell
            :title="pluginStore.$getI18nName(plugin)"
            v-if="progress.status != 'done'"
            :key="plugin"
            :label="
              `${steps[progress.stepsIndex].name}: ${steps[progress.stepsIndex].description}` +
                progress.status ==
              'error'
                ? `\n${progress.errorReason}`
                : ''
            "
            :class="[progress.status == 'error' && 'bg-(--nui-error-color)/20!']"
          />
        </template>
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
    <NButton type="primary" class="absolute! right-10!" @click="rebootApp">重新加载</NButton>
  </motion.div>
</template>