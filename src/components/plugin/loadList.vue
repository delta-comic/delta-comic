<script setup lang="ts">
import { motion } from 'motion-v'
import { usePluginStore } from '@/plugin/store'
import { computed } from 'vue'
import { Utils } from 'delta-comic-core'

defineProps<{ isBooting: boolean }>()

const pluginStore = usePluginStore()

const allErrors = computed(() =>
  Object.entries(pluginStore.pluginSteps)
    .filter(v => v[1].now.error)
    .map(v => [v[0], v[1].now.error!] as [plugin: string, error: Error])
)

const rebootApp = () => {
  Utils.message.createLoadingMessage('重启中')
  location.reload()
}
</script>

<template>
  <!-- loading list -->
  <motion.div
    v-if="isBooting"
    :initial="{ opacity: 0, scale: '50%', translateY: '85px' }"
    :exit="{ opacity: 0, scale: '50%', translateY: '85px' }"
    :animate="{ opacity: 1, scale: '100%', translateY: '0px' }"
  >
    <VanCellGroup class="h-80 w-[80vw] shadow-2xl" inset>
      <TransitionGroup name="list" tag="ul" class="size-full!">
        <!-- display toy item -->
        <VanCell title="core" label="载入应用内容..." center key="core">
          <template #right-icon>
            <VanLoading size="25px" />
          </template>
        </VanCell>
        <!-- acutely item -->
        <template v-for="[plugin, { steps, now }] in Object.entries(pluginStore.pluginSteps)">
          <VanCell
            :title="pluginStore.$getPluginDisplayName(plugin)"
            v-if="steps[now.stepsIndex]"
            :key="plugin"
            :label="`${steps[now.stepsIndex].name}: ${steps[now.stepsIndex].description}`"
            :class="[now.status == 'error' && 'bg-(--nui-error-color)/20!']"
          />
        </template>
      </TransitionGroup>
    </VanCellGroup>
  </motion.div>

  <!-- reload button -->
  <motion.div
    :initial="{ opacity: 0, scale: '50%', translateY: '85px' }"
    :exit="{ opacity: 0, scale: '50%', translateY: '85px' }"
    class="relative"
    :animate="{ opacity: 1, scale: '100%', translateY: '0px' }"
    v-if="allErrors.length"
  >
    <NButton type="primary" class="absolute! right-10!" @click="rebootApp">重新加载</NButton>
  </motion.div>
</template>