import { Logger } from '@delta-comic/logger'
import { uni } from '@delta-comic/model'
import { flushPromises, mount, shallowMount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h, nextTick } from 'vue'

// cspell:ignore fetchpriority

vi.mock('@delta-comic/utils', () => ({
  useTemp: () => ({ $apply: (_key: string, create: () => unknown) => create() }),
}))

import DcAuthorIcon from './DcAuthorIcon.vue'
import DcImage from './DcImage.vue'
import DcImagedIcon from './DcImagedIcon.vue'

const ImageStub = defineComponent({
  name: 'Image',
  inheritAttrs: false,
  props: ['alt', 'fallbackSrc', 'imgProps', 'objectFit', 'previewDisabled', 'src'],
  emits: ['click', 'error', 'load'],
  setup(props, { attrs, emit, slots }) {
    return () =>
      h('div', { ...attrs, 'class': 'image-stub', 'data-src': props.src }, [
        h('button', { class: 'emit-load', onClick: () => emit('load', new Event('load')) }),
        h('button', { class: 'emit-error', onClick: () => emit('error') }),
        h('button', { class: 'emit-click', onClick: (event: Event) => emit('click', event) }),
        h('div', { class: 'error-content' }, slots.error?.()),
        h('div', { class: 'placeholder-content' }, slots.placeholder?.()),
      ])
  },
})

const IconStub = defineComponent({
  name: 'Icon',
  setup(_, { slots }) {
    return () => h('i', slots.default?.())
  },
})

afterEach(() => vi.restoreAllMocks())

describe('DcImage', () => {
  it('forwards image behavior, emits DOM events, and caches successful loads', async () => {
    const cacheList = { error: new Set<string>(), loaded: new Set<string>() }
    const wrapper = mount(DcImage, {
      global: { stubs: { Image: ImageStub } },
      props: {
        alt: 'cover',
        cacheList,
        fallback: 'https://cdn.example/fallback.jpg',
        fetchpriority: 'high',
        fit: 'cover',
        imgProp: { class: 'custom-image' },
        previewable: true,
        round: true,
        src: 'https://cdn.example/cover.jpg',
      },
    })
    await flushPromises()
    const image = wrapper.getComponent(ImageStub)

    expect(image.props()).toMatchObject({
      alt: 'cover',
      fallbackSrc: 'https://cdn.example/fallback.jpg',
      objectFit: 'cover',
      previewDisabled: false,
      src: 'https://cdn.example/cover.jpg',
    })
    expect(image.props('imgProps')).toMatchObject({ fetchpriority: 'high' })
    expect(image.props('imgProps').class).toContain('custom-image')

    await wrapper.get('.emit-load').trigger('click')
    await wrapper.get('.emit-click').trigger('click')
    expect(cacheList.loaded).toContain('https://cdn.example/cover.jpg')
    expect(wrapper.emitted('load')).toHaveLength(1)
    expect(wrapper.emitted('click')).toHaveLength(1)
    expect((wrapper.vm as any).isLoaded).toBe(true)
  })

  it('resolves image resource objects and exposes the underlying image instance', async () => {
    const resource = { getUrl: vi.fn().mockResolvedValue('https://cdn.example/resource.jpg') }
    const wrapper = mount(DcImage, {
      global: { stubs: { Image: ImageStub } },
      props: { src: resource as any },
    })
    await flushPromises()

    expect(resource.getUrl).toHaveBeenCalledOnce()
    expect(wrapper.getComponent(ImageStub).props('src')).toBe('https://cdn.example/resource.jpg')
    expect((wrapper.vm as any).imageIns).toBeDefined()
  })

  it('retries transient errors and records terminal string-source failures', async () => {
    const cacheList = { error: new Set<string>(), loaded: new Set<string>() }
    const wrapper = mount(DcImage, {
      global: { stubs: { Image: ImageStub } },
      props: { cacheList, retryMax: 2, src: 'https://cdn.example/broken.jpg' },
    })
    await flushPromises()

    await wrapper.get('.emit-error').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(ImageStub).exists()).toBe(true)
    expect(wrapper.emitted('error')).toBeUndefined()

    await wrapper.get('.emit-error').trigger('click')
    await flushPromises()
    expect(cacheList.error).toContain('https://cdn.example/broken.jpg')
    expect(wrapper.emitted('error')).toEqual([[]])
  })

  it('renders custom loading content and lets the error surface restart loading', async () => {
    const cacheList = {
      error: new Set(['https://cdn.example/retry.jpg']),
      loaded: new Set<string>(),
    }
    const wrapper = mount(DcImage, {
      global: { stubs: { Image: ImageStub } },
      props: { cacheList, src: 'https://cdn.example/retry.jpg' },
      slots: {
        fail: () => h('span', { class: 'custom-fail' }, 'Retry'),
        loading: () => h('span', { class: 'custom-loading' }, 'Waiting'),
      },
    })
    await flushPromises()

    expect(wrapper.findAll('.custom-loading')).toHaveLength(1)
    expect(wrapper.findAll('.custom-fail')).toHaveLength(1)
    await wrapper.get('.error-content > div').trigger('click')
    await nextTick()
    expect(cacheList.error).not.toContain('https://cdn.example/retry.jpg')
  })

  it('degrades URL resolution failures to an empty source', async () => {
    const warning = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const resource = { getUrl: vi.fn().mockRejectedValue(new Error('resolver failed')) }
    const wrapper = mount(DcImage, {
      global: { stubs: { Image: ImageStub } },
      props: { src: resource as any },
    })
    await flushPromises()
    expect(wrapper.getComponent(ImageStub).props('src')).toBe('')
    expect(warning).toHaveBeenCalledWith(
      'image source resolution failed',
      expect.objectContaining({ message: 'resolver failed' }),
    )
  })
})

describe('image-backed icons', () => {
  it('renders image model icons through DcImage', () => {
    const image = uni.image.Image.create({
      $$plugin: 'test',
      forkNamespace: 'cover',
      path: 'https://cdn.example/icon.jpg',
    })
    const wrapper = shallowMount(DcImagedIcon, {
      global: { renderStubDefaultSlot: true },
      props: { bgColor: '#fff', icon: image, sizeSpacing: 8 },
    })
    const rendered = wrapper.getComponent(DcImage)
    expect(rendered.props()).toMatchObject({ fit: 'cover', round: true })
    const renderedSource = rendered.props('src')
    expect(uni.image.Image.is(renderedSource)).toBe(true)
    expect((renderedSource as uni.image.Image).pathname).toBe('https://cdn.example/icon.jpg')
  })

  it('renders component icons with a size derived from spacing', () => {
    const ComponentIcon = defineComponent(() => () => h('svg', { class: 'component-icon' }))
    const wrapper = mount(DcImagedIcon, {
      global: { stubs: { Icon: IconStub } },
      props: { icon: ComponentIcon, sizeSpacing: 10 },
    })
    expect(wrapper.find('.component-icon').exists()).toBe(true)
    expect(wrapper.getComponent(IconStub).attributes('size')).toBe('calc(var(--spacing) * 6.5)')
  })

  it('resolves registered author icons and creates raw author images', async () => {
    const RegisteredIcon = defineComponent(() => () => h('svg'))
    uni.item.Item.authorIcon.set(['plugin-a', 'registered'], RegisteredIcon)
    const registered = shallowMount(DcAuthorIcon, {
      props: { author: { $$plugin: 'plugin-a', icon: 'registered' }, sizeSpacing: 6 },
    })
    expect(registered.getComponent(DcImagedIcon).props('icon')).toBe(RegisteredIcon)

    const raw = { $$plugin: 'plugin-a', forkNamespace: 'cover', path: '/author.jpg' }
    await registered.setProps({ author: { $$plugin: 'plugin-a', icon: raw } })
    expect(uni.image.Image.is(registered.getComponent(DcImagedIcon).props('icon'))).toBe(true)
    uni.item.Item.authorIcon.delete(['plugin-a', 'registered'])
  })
})