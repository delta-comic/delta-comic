<script setup lang="ts">
import { onMounted, computed, watch, useTemplateRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { ComponentExposed } from "vue-component-type-helpers";
import { useTabStatus } from "vant";
import { fromPairs } from "es-toolkit/compat";
import { decodeURIDeep, decodeURIComponentDeep } from "@/utils/url";
import { searchSourceKey } from "./source";
import { uni, type RStream } from "@delta-comic/model";
import { appConfig, useConfig, usePluginStore } from "@delta-comic/plugin";
import { useTemp } from "@delta-comic/core";
import { DcList } from "@delta-comic/ui";
const config = useConfig().$load(appConfig);
const temp = useTemp().$applyRaw("searchConfig", () => ({
  result: new Map<string, RStream<uni.item.Item>>(),
  scroll: new Map<string, number>(),
}));
const list = useTemplateRef<ComponentExposed<typeof DcList>>("list");
const $router = useRouter();
const $route = useRoute<"/search/[input]">();
const $props = defineProps<{ sort: string; source: string }>();

const input = decodeURIDeep($route.params.input);
const pluginStore = usePluginStore();
const method = computed(() => {
  const [plugin, name] = searchSourceKey.toJSON($props.source);
  return fromPairs(fromPairs(pluginStore.allSearchSource)[plugin])[name];
});
const comicStream = computed(() => {
  const storeKey = `${input}\u1145${$props.sort}\u1145${$props.source}`;
  if (temp.result.has(storeKey)) return temp.result.get(storeKey)!;
  const stream = method.value.getStream(decodeURIComponentDeep(decodeURIDeep(input)), $props.sort);
  temp.result.set(storeKey, stream);
  return stream;
});

const dataProcessor = (data: uni.item.Item[]) =>
  config.value.showAIProject ? data : data.filter((comic) => !comic.$isAi);

const showSearch = defineModel<boolean>("showHeader", { required: true });
watch(
  () => list.value?.scrollTop,
  async (scrollTop, old) => {
    if (!scrollTop || !old) return;
    if (scrollTop - old > 0) showSearch.value = false;
    else showSearch.value = true;
  },
  { immediate: true },
);

const setupScroll = () => {
  if (temp.scroll.has(input)) list.value?.listInstance?.scrollTo({ top: temp.scroll.get(input) });
};
const setScroll = () => {
  temp.scroll.set(input, list.value?.scrollTop!);
};
const isActive = useTabStatus();
if (isActive) {
  watch(isActive, (isActive) => {
    if (isActive) setupScroll();
    else setScroll();
  });
}
const stop = $router.beforeEach(() => {
  setScroll();
  stop();
});
onMounted(setupScroll);

const getItemCard = (contentType: uni.content.ContentType_) =>
  uni.item.Item.itemCard.get(contentType);
</script>

<template>
  <DcList
    :itemHeight="140"
    v-slot="{ data: { item } }"
    v-if="isActive ?? true"
    class="h-full transition-all duration-200 will-change-[transform,height]"
    ref="list"
    :source="comicStream!"
    :data-processor
  >
    <component :is="getItemCard(item.contentType)" :item />
  </DcList>
</template>
