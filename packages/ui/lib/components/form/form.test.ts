import { mount, shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vite-plus/test'
import { defineComponent, h, nextTick, type VNode } from 'vue'

import DcForm from './components/DcForm.vue'
import DcFormCheckbox from './components/DcFormCheckbox.vue'
import DcFormDate from './components/DcFormDate.vue'
import DcFormDateRange from './components/DcFormDateRange.vue'
import DcFormItem from './components/DcFormItem.vue'
import DcFormNumber from './components/DcFormNumber.vue'
import DcFormPairs from './components/DcFormPairs.vue'
import DcFormRadio from './components/DcFormRadio.vue'
import DcFormString from './components/DcFormString.vue'
import DcFormSwitch from './components/DcFormSwitch.vue'
import { createForm } from './functional'

const passthrough = (name: string) =>
  defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('div', attrs, slots.default?.())
    },
  })

describe('individual form controls', () => {
  it('enforces the string pattern while allowing the field to be cleared', async () => {
    const wrapper = shallowMount(DcFormString, {
      props: {
        config: { patten: /^\d+$/, placeholder: 'digits', type: 'string' } as any,
        modelValue: '',
      },
    })
    const input = wrapper.getComponent({ name: 'Input' })
    const allowInput = input.props('allowInput') as (value: string) => boolean

    expect(allowInput('123')).toBe(true)
    expect(allowInput('abc')).toBe(false)
    expect(allowInput('')).toBe(true)

    input.vm.$emit('update:value', '456')
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toEqual([['456']])
  })

  it('configures integer and floating-point number bounds', async () => {
    const wrapper = shallowMount(DcFormNumber, {
      props: {
        config: {
          defaultValue: 2,
          float: false,
          placeholder: 'count',
          range: [1, 9],
          type: 'number',
        } as any,
        modelValue: 2,
      },
    })
    const input = wrapper.getComponent({ name: 'InputNumber' })
    expect(input.props()).toMatchObject({ max: 9, min: 1, precision: 0 })

    await wrapper.setProps({ config: { float: true, type: 'number' } as any })
    expect(wrapper.getComponent({ name: 'InputNumber' }).props('precision')).toBeUndefined()
  })

  it.each([
    [DcFormDate, true, 'date'],
    [DcFormDate, false, 'datetime'],
    [DcFormDateRange, true, 'daterange'],
    [DcFormDateRange, false, 'datetimerange'],
  ] as const)('maps date configuration to the picker type', (Component, time, expectedType) => {
    const wrapper = shallowMount(Component, {
      props: {
        config: { format: 'yyyy-MM-dd', time, type: 'date' } as any,
        modelValue: null as any,
      },
    })
    expect(wrapper.getComponent({ name: 'DatePicker' }).props()).toMatchObject({
      format: 'yyyy-MM-dd',
      type: expectedType,
    })
  })

  it('renders a radio group or select according to the component preference', async () => {
    const config = {
      comp: 'radio',
      info: 'mode',
      selects: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
      type: 'radio',
    } as any
    const wrapper = shallowMount(DcFormRadio, {
      global: { renderStubDefaultSlot: true },
      props: { config, modelValue: 'a' },
    })
    expect(wrapper.findComponent({ name: 'RadioGroup' }).exists()).toBe(true)
    expect(wrapper.findAllComponents({ name: 'Radio' })).toHaveLength(2)

    await wrapper.setProps({ config: { ...config, comp: 'select', placeholder: 'choose' } })
    const select = wrapper.getComponent({ name: 'Select' })
    expect(select.props('options')).toEqual(config.selects)
    expect(select.props('filterable')).toBe(true)
  })

  it('renders a checkbox group or a multi-select and propagates changes', async () => {
    const config = {
      comp: 'checkbox',
      info: 'features',
      selects: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
      type: 'checkbox',
    } as any
    const wrapper = shallowMount(DcFormCheckbox, {
      global: { renderStubDefaultSlot: true },
      props: { config, modelValue: ['a'] },
    })
    expect(wrapper.findAllComponents({ name: 'Checkbox' })).toHaveLength(2)

    await wrapper.setProps({ config: { ...config, comp: 'select' } })
    const select = wrapper.getComponent({ name: 'Select' })
    expect(select.props('multiple')).toBe(true)
    select.vm.$emit('update:value', ['b'])
    expect(wrapper.emitted('update:modelValue')).toEqual([[['b']]])
  })

  it('only creates switch label slots when labels are configured', async () => {
    const wrapper = shallowMount(DcFormSwitch, {
      props: {
        config: { close: 'Off', defaultValue: true, open: 'On', type: 'switch' } as any,
        modelValue: true,
      },
    })
    const toggle = wrapper.getComponent({ name: 'Switch' })
    expect(toggle.vm.$slots.checked?.()[0].children).toBe('On')
    expect(toggle.vm.$slots.unchecked?.()[0].children).toBe('Off')

    toggle.vm.$emit('update:value', false)
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('creates pair rows from configuration and uses translated placeholders', () => {
    const initial = [{ key: 'plugin', value: 'install' }]
    const wrapper = shallowMount(DcFormPairs, {
      props: { config: { defaultValue: initial, type: 'pairs' } as any, modelValue: initial },
    })
    const dynamic = wrapper.getComponent({ name: 'DynamicInput' })
    expect((dynamic.props('onCreate') as () => unknown)()).toEqual(initial[0])

    const slot = dynamic.vm.$slots.default?.({ value: initial[0] })
    expect(slot).toBeDefined()
    const rendered = mount(defineComponent(() => () => slot as any))
    const inputs = rendered.findAllComponents({ name: 'Input' })
    expect(inputs.map(input => input.props('placeholder'))).toEqual([
      'Plugin ID',
      'Download command',
    ])
  })

  it('keeps exactly one independent row when multiple pairs are disabled', async () => {
    const wrapper = shallowMount(DcFormPairs, {
      props: {
        config: {
          defaultValue: [{ key: 'token', value: 'secret' }],
          noMultiple: true,
          type: 'pairs',
        } as any,
        modelValue: [
          { key: 'first', value: '1' },
          { key: 'second', value: '2' },
        ],
      },
    })
    await nextTick()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[{ key: 'first', value: '1' }]])
    const dynamic = wrapper.getComponent({ name: 'DynamicInput' })
    expect(dynamic.props()).toMatchObject({ max: 1, min: 1, showSortButton: false })
    expect((dynamic.props('onCreate') as () => unknown)()).toEqual({
      key: 'token',
      value: 'secret',
    })
    expect((dynamic.props('onCreate') as () => unknown)()).not.toBe(
      (dynamic.props('onCreate') as () => unknown)(),
    )
  })
})

describe('form composition', () => {
  it.each(['switch', 'string', 'number', 'radio', 'checkbox', 'date', 'dateRange', 'pairs'])(
    'selects the %s editor from the config discriminator',
    async type => {
      const wrapper = shallowMount(DcFormItem, {
        global: { renderStubDefaultSlot: true },
        props: {
          config: { info: 'Field', type } as any,
          modelValue: undefined as any,
          path: 'field',
        },
      })
      expect(wrapper.getComponent({ name: 'FormItem' }).props()).toMatchObject({
        label: 'Field',
        path: 'field',
        required: true,
      })
      expect(
        wrapper.findAllComponents({
          name: new Map([
            ['switch', 'DcFormSwitch'],
            ['string', 'DcFormString'],
            ['number', 'DcFormNumber'],
            ['radio', 'DcFormRadio'],
            ['checkbox', 'DcFormCheckbox'],
            ['date', 'DcFormDate'],
            ['dateRange', 'DcFormDateRange'],
            ['pairs', 'DcFormPairs'],
          ]).get(type)!,
        }),
      ).toHaveLength(1)
    },
  )

  it('lets a row slot replace selected fields while retaining default rows', () => {
    const configs = {
      name: { info: 'Name', type: 'string' },
      retries: { info: 'Retries', type: 'number' },
    } as any
    const wrapper = shallowMount(DcForm, {
      global: { stubs: { Form: passthrough('Form') } },
      props: { configs, modelValue: { name: 'Delta', retries: 2 }, overrideRow: ['name'] },
      slots: {
        bottom: ({ config }: any) => h('footer', Object.keys(config).join(',')),
        row: ({ modelValue, path, setModelValue }: any) =>
          h('button', { onClick: () => setModelValue('Changed') }, `${path}:${modelValue}`),
        top: ({ config }: any) => h('header', String(Object.keys(config).length)),
      },
    })

    expect(wrapper.get('header').text()).toBe('2')
    expect(wrapper.get('button').text()).toBe('name:Delta')
    expect(wrapper.findComponent({ name: 'DcFormItem' }).props('path')).toBe('retries')
    expect(wrapper.get('footer').text()).toBe('name,retries')
  })

  it('initializes createForm defaults and resolves them on submit', async () => {
    const configs = {
      count: { defaultValue: 3, type: 'number' },
      enabled: { type: 'switch' },
      mode: { defaultValue: 'safe', type: 'radio' },
      name: { type: 'string' },
      optional: { type: 'date' },
      tags: { defaultValue: ['featured'], type: 'checkbox' },
    } as any
    const created = createForm(configs)
    const slots = created.comp.children as { bottom: () => VNode }
    const submit = slots.bottom()

    expect((submit.children as { default: () => unknown[] }).default()[0]).toBe('Submit')
    await submit.props?.onClick()
    await expect(created.data).resolves.toEqual({
      count: 3,
      enabled: false,
      mode: 'safe',
      name: '',
      optional: undefined,
      tags: ['featured'],
    })
  })
})