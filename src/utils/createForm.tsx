import type { UniFormResult, UniFormDescription } from 'delta-comic-core'
import { isEmpty } from 'es-toolkit/compat'
import {
  NButton,
  NCheckbox,
  NCheckboxGroup,
  NDatePicker,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NRadio,
  NRadioGroup,
  NSelect,
  NSpace,
  NSwitch
} from 'naive-ui'
import { reactive } from 'vue'

export const createForm = <T extends Record<string, UniFormDescription>>(form: T) => {
  const data = reactive({}) as Record<keyof T, any>
  const c = Promise.withResolvers<{
    [x in keyof T]: UniFormResult<T[x]>
  }>()
  for (const _name in form) {
    if (!Object.hasOwn(form, _name)) continue
    const name = _name as keyof T
    const config = form[_name]
    switch (config.type) {
      case 'string':
        data[name] = config.defaultValue ?? ''
        break
      case 'number':
        data[name] = config.defaultValue ?? undefined
        break
      case 'radio':
        data[name] = config.defaultValue ?? undefined
        break
      case 'checkbox':
        data[name] = config.defaultValue ?? undefined
        break
      case 'switch':
        data[name] = config.defaultValue ?? false
        break
      case 'date':
        data[name] = config.defaultValue ?? undefined
        break
    }
  }
  // const formRef = ref<FormInst>()
  return {
    comp: (
      <NForm model={data}>
        {Object.keys(data).map((k: keyof T) => {
          const config = form[k]
          return (
            <NFormItem label={config.info} path={k.toString()} required={config.required ?? true}>
              {(() => {
                switch (config.type) {
                  case 'string':
                    return (
                      <NInput
                        clearable
                        allowInput={v =>
                          config.patten ? config.patten.test(v) || isEmpty(v) : true
                        }
                        defaultValue={config.defaultValue}
                        placeholder={config.placeholder}
                        value={data[k]}
                        onUpdateValue={v => (data[k] = v.toString())}
                      />
                    )
                  case 'number':
                    return (
                      <NInputNumber
                        precision={config.float ? undefined : 0}
                        clearable
                        min={config.range?.[0]}
                        max={config.range?.[1]}
                        defaultValue={config.defaultValue}
                        placeholder={config.placeholder}
                        value={data[k]}
                        onUpdateValue={v => (data[k] = v)}
                      />
                    )
                  case 'radio':
                    return config.comp === 'radio' ? (
                      <NRadioGroup
                        value={data[k]}
                        onUpdateValue={v => (data[k] = v)}
                        name={config.info}
                        defaultValue={config.defaultValue}
                      >
                        <NSpace>
                          {config.selects.map(c => (
                            <NRadio key={c.value} value={c.value}>
                              {c.label}
                            </NRadio>
                          ))}
                        </NSpace>
                      </NRadioGroup>
                    ) : (
                      <NSelect
                        virtualScroll
                        options={config.selects}
                        defaultValue={config.defaultValue}
                        value={data[k]}
                        onUpdateValue={v => (data[k] = v)}
                        placeholder={config.placeholder}
                        filterable
                      />
                    )
                  case 'checkbox':
                    return config.comp === 'checkbox' ? (
                      <NCheckboxGroup
                        value={data[k]}
                        onUpdateValue={v => (data[k] = v)}
                        defaultValue={config.defaultValue}
                      >
                        <NSpace itemClass='flex'>
                          {config.selects.map(c => (
                            <NCheckbox key={c.value} value={c.value}>
                              {c.label}
                            </NCheckbox>
                          ))}
                        </NSpace>
                      </NCheckboxGroup>
                    ) : (
                      <NSelect
                        virtualScroll
                        multiple
                        options={config.selects}
                        defaultValue={config.defaultValue}
                        value={data[k]}
                        onUpdateValue={v => (data[k] = v)}
                        placeholder={config.placeholder}
                        filterable
                      />
                    )
                  case 'switch':
                    return (
                      <NSwitch
                        defaultValue={config.defaultValue}
                        value={data[k]}
                        onUpdateValue={v => (data[k] = v)}
                      >
                        {{ checked: () => config.open, unchecked: () => config.close }}
                      </NSwitch>
                    )
                  case 'date':
                    return (
                      <NDatePicker
                        input-readonly
                        placement='top-start'
                        defaultValue={config.defaultValue}
                        value={data[k]}
                        onUpdateValue={v => (data[k] = v)}
                        placeholder={config.placeholder}
                      ></NDatePicker>
                    )
                }
              })()}
            </NFormItem>
          )
        })}
        <NButton
          type='primary'
          onClick={async () => {
            try {
              // await formRef.value?.validate()
              c.resolve(data)
            } catch (error) {
              window.$message.error(String(error))
            }
          }}
        >
          提交
        </NButton>
      </NForm>
    ),
    data: c.promise
  }
}