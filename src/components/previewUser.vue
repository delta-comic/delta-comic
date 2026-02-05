<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { Comp, uni } from 'delta-comic-core'
import { usePluginStore } from '@/plugin/store'

const show = shallowRef(false)
const user = shallowRef<uni.user.User>()

defineExpose({
  show(u: uni.user.User) {
    show.value = true
    user.value = u
  }
})
const pluginStore = usePluginStore()
const Card = computed(() => pluginStore.plugins.get(user.value?.$$plugin ?? '')?.user?.card)
</script>

<template>
  <Comp.Popup v-model:show="show" overlay position="bottom" round>
    <component :is="Card" :user v-if="user" />
  </Comp.Popup>
</template>