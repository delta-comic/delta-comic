<script setup lang='ts'>
import { db } from '@/db'
import { Comp } from 'delta-comic-core'
import { useMessage } from 'naive-ui'
import { ref, shallowRef } from 'vue'

const show = shallowRef(false)
const $message = useMessage()
const create = (defaultValue = formDataRaw) => {
  if (show.value) {
    $message.warning('正在创建中')
    return
  }
  formData.value = defaultValue
  show.value = true
}

const formDataRaw = {
  title: '',
  description: '',
  isPrivate: true
}
const formData = ref(formDataRaw)

const cancel = () => {
  formData.value = formDataRaw
  show.value = false
}

const onSubmit = async () => {
  await db.value.replaceInto("favouriteCard").values({
    ...formData.value,
    private: false,
    createAt: Date.now()
  }).execute()
  formData.value = formDataRaw
  show.value = false
}
defineExpose({
  create
})
</script>

<template>
  <Comp.Popup v-model:show="show" position="bottom" round @closed="cancel" class="bg-(--van-background)!">
    <div class="w-full flex items-center pl-5 my-2 h-8 font-semibold">创建收藏夹</div>
    <VanForm @submit="onSubmit">
      <VanCellGroup inset>
        <VanField v-model="formData.title" name="title" label="名称" placeholder="名称"
          :rules="[{ required: true, message: '请填写名称' }]" />
        <VanField v-model="formData.description" type="textarea" name="description" label="简介" placeholder="可选的" />
        <VanField name="switch" label="私密的">
          <template #input>
            <VanSwitch v-model="formData.isPrivate" />
          </template>
        </VanField>
      </VanCellGroup>
      <NButton class="m-5! w-30!" strong secondary attr-type="submit" type="primary" size="large">
        提交
      </NButton>
    </VanForm>
  </Comp.Popup>
</template>