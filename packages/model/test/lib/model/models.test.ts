import { Logger } from '@delta-comic/logger'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { UniComment, type UniCommentRaw } from '../../../lib/model/comment'
import { UniContentPage } from '../../../lib/model/content'
import { UniEp } from '../../../lib/model/ep'
import { UniImage } from '../../../lib/model/image'
import { UniItem, type UniItemRaw } from '../../../lib/model/item'
import { UniResource, type UniResourceRaw } from '../../../lib/model/resource'
import { UniUser, type UniUserRaw } from '../../../lib/model/user'
import { StreamQuery, Struct } from '../../../lib/struct'

class TestItem extends UniItem {
  like = vi.fn(async () => undefined)
  report = vi.fn(async () => undefined)
  sendComment = vi.fn(async () => undefined)
}

class TestUser extends UniUser {
  customUser = { role: 'reader' }
}

class TestComment extends UniComment {
  sender: UniUser
  fetchChildren = new StreamQuery(async () => ({ data: [] }), 1)
  like = vi.fn(async () => true)
  report = vi.fn(async () => undefined)
  sendComment = vi.fn(async () => undefined)

  constructor(raw: UniCommentRaw) {
    super(raw)
    this.sender = raw.sender
  }
}

class TestContentPage extends UniContentPage {
  plugin = 'fixture'
  contentType = ['fixture', 'manga'] as [string, string]
  ViewComponent = {} as never
  fetchComments = new StreamQuery(async () => ({ data: [] }), 0)
  fetchEps = new StreamQuery(async () => ({ data: [] }), 0)
  fetchRecommends = new StreamQuery(async () => ({ data: [] }), 0)
  fetchDetail = vi.fn(async () => this.preload!)
  fetchShortId = vi.fn(async () => this.id.slice(0, 4))
}

const rawResource = (
  pathname = 'covers/fixture.jpg',
  processSteps: UniResourceRaw['processSteps'] = [],
): UniResourceRaw => ({ $$plugin: 'fixture', pathname, processSteps, type: 'image' })

const rawItem = (overrides: Partial<UniItemRaw> = {}): UniItemRaw => ({
  $$plugin: 'fixture',
  author: [{ $$plugin: 'fixture', description: 'human artist', icon: rawResource(), label: 'A' }],
  categories: [],
  commentSendable: true,
  contentType: ['fixture', 'manga'],
  cover: rawResource(),
  epLength: '12',
  id: 'item-1',
  length: '120',
  thisEp: { $$plugin: 'fixture', id: 'ep-1', name: 'Episode 1' },
  title: 'Fixture title',
  ...overrides,
})

beforeEach(() => {
  UniResource.processInstances.clear()
  UniResource.fork.clear()
  UniResource.precedenceFork.clear()
  UniItem.itemTranslator.clear()
})

describe('resource resolution', () => {
  it('normalizes process steps, skips missing processors, and stops on exit', async () => {
    const warning = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const resize = vi.fn(async (path: string) => [`resized/${path}`, false] as [string, boolean])
    const cache = vi.fn(
      async (path: string) => [`https://cdn.test/${path}`, true] as [string, boolean],
    )
    const unreachable = vi.fn(async (path: string) => [path, false] as [string, boolean])
    UniResource.processInstances.set(['fixture', 'resize'], { name: 'resize', call: resize })
    UniResource.processInstances.set(['fixture', 'cache'], { name: 'cache', call: cache })
    UniResource.processInstances.set(['fixture', 'unreachable'], {
      name: 'unreachable',
      call: unreachable,
    })
    const resource = UniResource.create(
      rawResource('cover.jpg', ['missing', 'resize', { referenceName: 'cache' }, 'unreachable']),
    )

    await expect(resource.getUrl()).resolves.toBe('https://cdn.test/resized/cover.jpg')

    expect(warning).toHaveBeenCalledWith('resource process not found', {
      plugin: 'fixture',
      referenceName: 'missing',
    })
    expect(resize).toHaveBeenCalledWith('cover.jpg', resource)
    expect(cache).toHaveBeenCalledWith('resized/cover.jpg', resource)
    expect(unreachable).not.toHaveBeenCalled()
    expect(resource.processSteps[0]).toEqual({ referenceName: 'missing', ignoreExit: false })
  })

  it('honors ignoreExit and prefixes relative results with the selected fork', async () => {
    UniResource.processInstances.set(['fixture', 'first'], {
      name: 'first',
      call: vi.fn(async () => ['processed.jpg', true] as [string, boolean]),
    })
    UniResource.processInstances.set(['fixture', 'second'], {
      name: 'second',
      call: vi.fn(async path => [`final/${path}`, false] as [string, boolean]),
    })
    UniResource.fork.set(['fixture', 'image'], ['https://a.test', 'https://b.test'])
    UniResource.precedenceFork.set(['fixture', 'image'], 'https://b.test')
    const resource = UniResource.create(
      rawResource('cover.jpg', [{ ignoreExit: true, referenceName: 'first' }, 'second']),
    )

    await expect(resource.getUrl()).resolves.toBe('https://b.test/final/processed.jpg')
    expect(resource.getThisFork()).toBe('https://b.test')
  })

  it('rotates through alternate forks and resets after exhausting all choices', () => {
    UniResource.fork.set(['fixture', 'image'], ['https://a.test', 'https://b.test'])
    UniResource.precedenceFork.set(['fixture', 'image'], 'https://a.test')
    const resource = UniResource.create(rawResource())

    expect(resource.localChangeFork()).toBe(false)
    expect(resource.getThisFork()).toBe('https://b.test')
    expect(resource.localChangeFork()).toBe(true)
    expect(resource.omittedForks.size).toBe(0)
    expect(resource.getThisFork()).toBe('https://a.test')
  })

  it('reports a missing fork for relative paths', async () => {
    const resource = UniResource.create(rawResource('relative.jpg'))

    expect(() => resource.getThisFork()).toThrow('fork not found')
    await expect(resource.getUrl()).rejects.toThrow('fork not found')
  })
})

describe('image, item, and episode projections', () => {
  it('converts legacy raw images and updates aspect metadata without replacing other metadata', () => {
    const image = UniImage.create(
      {
        $$meta: { source: 'legacy' },
        $$plugin: 'fixture',
        forkNamespace: 'image',
        path: 'cover.jpg',
      },
      { height: 300, width: 200 },
    )

    expect(UniImage.is(image)).toBe(true)
    expect(UniResource.is(image)).toBe(true)
    expect(image.pathname).toBe('cover.jpg')
    expect(image.type).toBe('image')
    expect(image.aspect).toEqual({ height: 300, width: 200 })

    image.aspect = { height: 600, width: 400 }
    image.aspect = undefined
    expect(image.aspect).toEqual({ height: 600, width: 400 })
    expect(image.toJSON()).toMatchObject({ $$meta: { source: 'legacy' } })
  })

  it('creates items through the content translator and exposes typed projections', () => {
    const translator = vi.fn((raw: UniItemRaw) => new TestItem(raw))
    UniItem.itemTranslator.set(['fixture', 'manga'], translator)
    const raw = rawItem()

    const item = UniItem.create(raw)

    expect(UniItem.is(item)).toBe(true)
    expect(translator).toHaveBeenCalledExactlyOnceWith(raw)
    expect(item.contentType).toEqual(['fixture', 'manga'])
    expect(item.$cover).toBeInstanceOf(UniImage)
    expect(item.$thisEp).toEqual(expect.objectContaining({ id: 'ep-1', name: 'Episode 1' }))
    expect(item.$isAi).toBe(false)
  })

  it.each([
    [{ customIsAI: true }, true],
    [{ title: 'AI generated comic' }, true],
    [
      {
        author: [
          {
            $$plugin: 'fixture',
            description: 'illustrator',
            icon: rawResource(),
            label: 'AI Artist',
          },
        ],
      },
      true,
    ],
    [{ title: 'railway story' }, false],
  ])('detects AI disclosure signals without substring false positives', (overrides, expected) => {
    expect(new TestItem(rawItem(overrides)).$isAi).toBe(expected)
  })

  it('reports the missing content type when no item translator is registered', () => {
    expect(() => UniItem.create(rawItem({ contentType: 'fixture:unknown' }))).toThrow(
      'fixture:unknown',
    )
  })

  it('keeps episode metadata and serializes structs to detached raw objects', () => {
    const raw = { $$meta: { page: 1 }, $$plugin: 'fixture', id: 'ep-1', name: 'Episode 1' }
    const ep = new UniEp(raw)
    const json = ep.toJSON()

    expect(json).toEqual(raw)
    expect(Struct.toRaw(ep)).toEqual(raw)
    expect(Struct.toRaw(raw)).toBe(raw)
    expect(json).not.toBe(raw)
  })
})

describe('user, comment, content, and streaming contracts', () => {
  it('projects optional avatars to Image and preserves plugin metadata', () => {
    const raw: UniUserRaw = {
      $$meta: { source: 'remote' },
      $$plugin: 'fixture',
      avatar: rawResource('avatar.jpg'),
      id: 'user-1',
      name: 'Reader',
    }
    const user = new TestUser(raw)

    expect(user.avatar).toBeInstanceOf(UniImage)
    expect(user).toMatchObject({
      $$meta: { source: 'remote' },
      $$plugin: 'fixture',
      customUser: { role: 'reader' },
      id: 'user-1',
      name: 'Reader',
    })
  })

  it('copies comment counters and moderation state while retaining the sender contract', () => {
    const sender = new TestUser({ $$plugin: 'fixture', id: 'user-1', name: 'Reader' })
    const raw: UniCommentRaw = {
      $$plugin: 'fixture',
      childrenCount: 2,
      content: { text: 'hello', type: 'string' },
      id: 'comment-1',
      isLiked: true,
      isTop: true,
      likeCount: 3,
      reported: false,
      sender,
      time: 123,
    }

    expect(new TestComment(raw)).toMatchObject(raw)
  })

  it('preserves content constructor inputs and delegates stream pagination', async () => {
    const preload = new TestItem(rawItem())
    const page = new TestContentPage(preload, 'content-123', 'ep-1')
    const signal = new AbortController().signal
    const query = vi.fn(
      async (_data: { filter: string }, current: number, received?: AbortSignal) => ({
        data: [current],
        nextPage: current + 1,
        signal: received,
      }),
    )
    const stream = new StreamQuery(query as never, 1)

    expect(page).toMatchObject({ ep: 'ep-1', id: 'content-123', plugin: 'fixture', preload })
    await expect(page.fetchShortId()).resolves.toBe('cont')
    await expect(stream.query({ filter: 'all' }, stream.initPage, signal)).resolves.toMatchObject({
      data: [1],
      nextPage: 2,
      signal,
    })
  })
})