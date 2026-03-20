<script setup lang="ts">
import { noop } from 'es-toolkit/compat'
import type { PopupProps } from 'vant'
import { computed, type StyleValue } from 'vue'
import { shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useZIndex } from '@/utils/layout'
const $router = useRouter()
const $props = withDefaults(
  defineProps<
    Partial<PopupProps & { noBorder?: boolean; useTrulyShow: boolean; style?: StyleValue }>
  >(),
  { position: 'center', noBorder: false, overlay: true, closeOnClickOverlay: true }
)
const show = defineModel<boolean>('show', { required: true })
defineSlots<{ default(): void }>()
const trulyShow = shallowRef(show.value)
const [zIndex, isLast] = useZIndex(
  computed(() => ($props.useTrulyShow ? trulyShow.value : show.value))
)
let stopRouter = noop
watch(
  show,
  _show => {
    if (_show)
      stopRouter = $router.beforeEach(() => {
        console.log('popup:\n', 'isLast:', isLast.value, 'show:', show.value)
        if (isLast.value) {
          if (show.value) {
            return (show.value = false)
          } else {
            return
          }
        } else {
          return
        }
      })
    else stopRouter()
  },
  { immediate: true }
)
defineEmits<{ closed: [] }>()
defineExpose({ zIndex, trulyShow })
</script>

<template>
  <VanPopup
    :="$props"
    v-model:show="show"
    :z-index
    teleport="#popups"
    @open="trulyShow = true"
    @closed="
      () => {
        trulyShow = false
        $emit('closed')
      }
    "
    class="max-h-screen overflow-hidden overflow-y-auto!"
    :class="!noBorder && 'border-0 border-t border-solid border-(--van-border-color)'"
  >
    <slot v-if="trulyShow"></slot>
  </VanPopup>
</template>