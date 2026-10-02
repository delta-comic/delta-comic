import { afterEach, beforeEach, vi } from 'vite-plus/test'

type Listener = () => void

class MemoryNode {
  public parentNode: MemoryNode | null = null
  public nextSibling: MemoryNode | null = null
  public nodeValue = ''
  public textContent = ''
  public readonly childNodes: MemoryNode[] = []

  public insertBefore(child: MemoryNode, anchor: MemoryNode | null) {
    child.parentNode = this
    const anchorIndex = anchor ? this.childNodes.indexOf(anchor) : -1
    if (anchorIndex === -1) this.childNodes.push(child)
    else this.childNodes.splice(anchorIndex, 0, child)
    return child
  }

  public removeChild(child: MemoryNode) {
    const index = this.childNodes.indexOf(child)
    if (index !== -1) this.childNodes.splice(index, 1)
    child.parentNode = null
    return child
  }

  public setAttribute() {}
}

class MemoryDocument {
  public fullscreenElement: unknown = null
  private readonly listeners = new Map<string, Set<Listener>>()

  public createElement() {
    return new MemoryNode()
  }

  public createElementNS() {
    return new MemoryNode()
  }

  public createTextNode(text: string) {
    const node = new MemoryNode()
    node.nodeValue = text
    return node
  }

  public createComment(text: string) {
    return this.createTextNode(text)
  }

  public querySelector() {
    return null
  }

  public addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  public removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener)
  }

  public dispatchEvent(event: Event) {
    for (const listener of this.listeners.get(event.type) ?? []) listener()
    return true
  }
}

beforeEach(() => {
  const window = { $api: {} }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: new MemoryDocument() })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})