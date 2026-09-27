import type { FormConfigure, FormResult, FormSingleResult } from '@delta-comic/model'
import { NButton } from 'naive-ui'
import { ref } from 'vue'

import { translateUi } from '../../i18n'

import DcForm from './components/DcForm.vue'

export const createForm = <T extends FormConfigure>(configs: T) => {
  const data = ref<Record<string, FormSingleResult<any>>>({})
  const c = Promise.withResolvers<FormResult<T>>()
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
        modelValue={data.value as FormResult<T>}
        onUpdate:modelValue={(v: any) => (data.value = v)}
      >
        {{
          bottom: () => (
            <NButton
              type='primary'
              onClick={async () => {
                try {
                  c.resolve(data.value as FormResult<T>)
                } catch (error) {
                  window.$message.error(String(error))
                }
              }}
            >
              {translateUi('actions.submit')}
            </NButton>
          ),
        }}
      </DcForm>
    ),
    data: c.promise,
  }
}