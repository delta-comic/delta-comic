<script setup lang="ts">
import { NButton, NTag } from 'naive-ui'
import { shallowRef } from 'vue'

import { DcVar } from '@/index'

import DemoSection from '../DemoSection.vue'

const count = shallowRef(3)
const products = [
  { id: 1, name: '标准版', price: 18, quantity: 2 },
  { id: 2, name: '典藏版', price: 36, quantity: 1 },
  { id: 3, name: '数字画集', price: 12, quantity: 3 },
]
</script>

<template>
  <div class="space-y-6">
    <DemoSection
      section-id="var-values"
      title="不同值类型"
      description="value 保持泛型类型，并通过默认作用域插槽以同名 value 交给模板。"
    >
      <div class="grid gap-4 sm:grid-cols-3">
        <DcVar :value="count * 2" v-slot="{ value }">
          <article class="rounded-xl border border-[var(--nui-divider-color)] p-4">
            <div class="text-xs text-[var(--nui-text-color-3)]">number</div>
            <div class="mt-3 text-3xl font-bold text-[var(--nui-primary-color)]">{{ value }}</div>
            <NButton class="mt-4" size="small" @click="count++">源值 +1</NButton>
          </article>
        </DcVar>

        <DcVar value="Delta Comic" v-slot="{ value }">
          <article class="rounded-xl border border-[var(--nui-divider-color)] p-4">
            <div class="text-xs text-[var(--nui-text-color-3)]">string</div>
            <div class="mt-3 text-lg font-semibold text-[var(--nui-text-color-1)]">{{ value }}</div>
            <NTag class="mt-4" size="small" type="success" :bordered="false">
              {{ value.length }} 个字符
            </NTag>
          </article>
        </DcVar>

        <DcVar
          :value="{ name: '瀑布流', stable: true, tags: ['虚拟化', '响应式'] }"
          v-slot="{ value }"
        >
          <article class="rounded-xl border border-[var(--nui-divider-color)] p-4">
            <div class="text-xs text-[var(--nui-text-color-3)]">object</div>
            <div class="mt-3 font-semibold text-[var(--nui-text-color-1)]">{{ value.name }}</div>
            <div class="mt-4 flex flex-wrap gap-2">
              <NTag v-for="tag in value.tags" :key="tag" size="small" :bordered="false">
                {{ tag }}
              </NTag>
            </div>
          </article>
        </DcVar>
      </div>
    </DemoSection>

    <DemoSection
      section-id="var-template"
      title="模板复用"
      description="在 v-for 中声明派生对象，让后续模板复用总价和强调状态而不重复表达式。"
    >
      <div class="overflow-hidden rounded-xl border border-[var(--nui-divider-color)]">
        <DcVar
          v-for="product in products"
          :key="product.id"
          :value="{ total: product.price * product.quantity, featured: product.quantity >= 3 }"
          v-slot="{ value }"
        >
          <article
            class="flex items-center gap-4 border-b border-[var(--nui-divider-color)] px-4 py-3 last:border-b-0"
          >
            <div class="min-w-0 flex-1">
              <div class="font-medium text-[var(--nui-text-color-1)]">{{ product.name }}</div>
              <div class="mt-1 text-xs text-[var(--nui-text-color-3)]">
                ¥{{ product.price }} × {{ product.quantity }}
              </div>
            </div>
            <NTag v-if="value.featured" size="small" type="success" :bordered="false">推荐</NTag>
            <div class="font-mono text-base font-semibold text-[var(--nui-primary-color)]">
              ¥{{ value.total }}
            </div>
          </article>
        </DcVar>
      </div>
    </DemoSection>
  </div>
</template>