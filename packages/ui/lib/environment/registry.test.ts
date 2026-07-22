import { Logger } from '@delta-comic/logger'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent } from 'vue'

import DcEnvironment from './DcEnvironment.vue'
import { environmentRegistry, EnvironmentRegistry } from './registry'

describe('environment registry', () => {
  it('keeps registrations typed by key and removes an owner as one unit', async () => {
    const registry = new EnvironmentRegistry()
    const first = defineComponent(() => () => null)
    const second = defineComponent(() => () => null)

    registry.register('reader-toolbar', first)
    await registry.withOwner('reader-plugin', async () => {
      registry.register('reader-toolbar', second)
    })

    expect(registry.forKey('reader-toolbar')).toHaveLength(2)
    registry.removeOwner('reader-plugin')
    expect(registry.forKey('reader-toolbar').map(entry => entry.component)).toEqual([first])
  })

  it('returns an idempotent disposer and supports explicit owners', () => {
    const registry = new EnvironmentRegistry()
    const component = defineComponent(() => () => null)
    const dispose = registry.register('reader-toolbar', component, () => true, 'plugin-a')

    expect(registry.forKey('reader-toolbar')).toHaveLength(1)
    dispose()
    dispose()
    expect(registry.forKey('reader-toolbar')).toEqual([])

    registry.register('reader-toolbar', component, () => true, 'plugin-a')
    registry.register('reader-footer', component, () => true, 'plugin-b')
    registry.removeOwner('plugin-a')
    expect(registry.forKey('reader-toolbar')).toEqual([])
    expect(registry.forKey('reader-footer')).toHaveLength(1)
  })

  it('restores owner context when an owned registration action rejects', async () => {
    const registry = new EnvironmentRegistry()
    const component = defineComponent(() => () => null)

    await expect(
      registry.withOwner('broken-plugin', async () => {
        registry.register('reader-toolbar', component)
        throw new Error('registration failed')
      }),
    ).rejects.toThrow('registration failed')

    registry.register('reader-toolbar', component)
    registry.removeOwner('broken-plugin')
    expect(registry.forKey('reader-toolbar')).toHaveLength(1)
  })
})

describe('DcEnvironment', () => {
  it('renders matching registrations and isolates rejected conditions', async () => {
    const Visible = defineComponent({
      props: { comicId: String },
      template: '<output class="visible">{{ comicId }}</output>',
    })
    const Hidden = defineComponent({ template: '<output class="hidden">hidden</output>' })
    const condition = vi.fn(({ comicId }: any) => comicId === 'comic-1')
    const warning = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const disposeVisible = environmentRegistry.register('test-environment', Visible, condition)
    const disposeHidden = environmentRegistry.register('test-environment', Hidden, () => false)
    const disposeBroken = environmentRegistry.register('test-environment', Hidden, async () => {
      throw new Error('condition failed')
    })

    const wrapper = mount(DcEnvironment, {
      props: { args: { comicId: 'comic-1' }, name: 'test-environment' },
    })
    await flushPromises()

    expect(condition).toHaveBeenCalledWith({ comicId: 'comic-1' })
    expect(wrapper.get('.visible').text()).toBe('comic-1')
    expect(wrapper.find('.hidden').exists()).toBe(false)
    expect(warning).toHaveBeenCalledWith(
      'environment condition failed',
      { name: 'test-environment' },
      expect.any(Error),
    )

    disposeVisible()
    disposeHidden()
    disposeBroken()
    warning.mockRestore()
  })
})