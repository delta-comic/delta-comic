import { NButton } from 'naive-ui'
import { ref } from 'vue'

import type { FormType } from '..'
import DcForm from './components/DcForm.vue'

export const createForm = <T extends FormType.Configure>(configs: T) => {
  const data = ref<Record<string, FormType.SingleResult<any>>>({})
  const c = Promise.withResolvers<FormType.Result<T>>()
  for (const name in configs) {
    if (!Object.hasOwn(configs, name)) continue
    const config = configs[name]
    switch (config.type) {
      case 'string':
        data.value[name] = config.defaultValue ?? ''
        break
      case 'number':
        data.value[name] = config.defaultValue ?? undefined
        break
      case 'radio':
        data.value[name] = config.defaultValue ?? undefined
        break
      case 'checkbox':
        data.value[name] = config.defaultValue ?? undefined
        break
      case 'switch':
        data.value[name] = config.defaultValue ?? false
        break
      case 'date':
        data.value[name] = config.defaultValue ?? undefined
        break
    }
  }

  return {
    comp: (
      <DcForm
        configs={configs}
        modelValue={data.value as FormType.Result<T>}
        onUpdate:modelValue={v => (data.value = v)}
      >
        {{
          bottom: () => (
            <NButton
              type='primary'
              onClick={async () => {
                try {
                  // await formRef.value?.validate()
                  c.resolve(data.value as FormType.Result<T>)
                } catch (error) {
                  window.$message.error(String(error))
                }
              }}
            >
              提交
            </NButton>
          )
        }}
      </DcForm>
    ),
    data: c.promise
  }
}