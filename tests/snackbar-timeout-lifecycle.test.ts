import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { SnackbarProvider, useSnackbar } from '../app/components/Snackbar'

class TestNode {
  nodeType: number
  nodeName: string
  ownerDocument: TestDocument
  parentNode: TestNode | null = null
  childNodes: TestNode[] = []

  constructor(nodeType: number, nodeName: string, ownerDocument: TestDocument) {
    this.nodeType = nodeType
    this.nodeName = nodeName
    this.ownerDocument = ownerDocument
  }

  appendChild(child: TestNode) {
    child.parentNode = this
    this.childNodes.push(child)
    return child
  }

  insertBefore(child: TestNode, before: TestNode | null) {
    child.parentNode = this
    const index = before ? this.childNodes.indexOf(before) : -1
    if (index === -1) this.childNodes.push(child)
    else this.childNodes.splice(index, 0, child)
    return child
  }

  removeChild(child: TestNode) {
    const index = this.childNodes.indexOf(child)
    if (index === -1) throw new Error('Child not found')
    this.childNodes.splice(index, 1)
    child.parentNode = null
    return child
  }

  addEventListener() {}
  removeEventListener() {}

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join('')
  }

  set textContent(value: string) {
    this.childNodes = value ? [new TestText(value, this.ownerDocument)] : []
  }
}

class TestText extends TestNode {
  data: string

  constructor(data: string, ownerDocument: TestDocument) {
    super(3, '#text', ownerDocument)
    this.data = data
  }

  override get textContent() {
    return this.data
  }

  override set textContent(value: string) {
    this.data = value
  }
}

class TestElement extends TestNode {
  tagName: string
  namespaceURI = 'http://www.w3.org/1999/xhtml'
  style: Record<string, string> = {}

  constructor(tagName: string, ownerDocument: TestDocument) {
    super(1, tagName.toUpperCase(), ownerDocument)
    this.tagName = tagName.toUpperCase()
  }

  setAttribute() {}
  removeAttribute() {}
}

class TestDocument extends TestNode {
  defaultView: Record<string, unknown> | null = null
  documentElement: TestElement

  constructor() {
    super(9, '#document', null as unknown as TestDocument)
    this.ownerDocument = this
    this.documentElement = new TestElement('html', this)
  }

  createElement(tagName: string) {
    return new TestElement(tagName, this)
  }

  createTextNode(data: string) {
    return new TestText(data, this)
  }
}

describe('SnackbarProvider timeout lifecycle', () => {
  let root: Root
  let rootUnmounted: boolean
  let container: TestElement
  let enqueue: ReturnType<typeof useSnackbar>['show']

  beforeEach(() => {
    vi.useFakeTimers()
    rootUnmounted = false
    const document = new TestDocument()
    const window = {
      document,
      setTimeout: vi.fn(globalThis.setTimeout),
      clearTimeout: vi.fn(globalThis.clearTimeout),
      HTMLIFrameElement: class {},
    }
    document.defaultView = window
    vi.stubGlobal('document', document)
    vi.stubGlobal('window', window)
    vi.stubGlobal('HTMLElement', TestElement)
    vi.stubGlobal('Node', TestNode)
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    root = createRoot(container as unknown as Element)
  })

  afterEach(() => {
    if (!rootUnmounted) act(() => root.unmount())
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function Harness() {
    enqueue = useSnackbar().show
    return createElement('span', null, 'harness')
  }

  function visibleText() {
    return container.textContent
  }

  it('clears pending snackbar timers without updating state after unmount', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    act(() => {
      root.render(createElement(SnackbarProvider, null, createElement(Harness)))
    })

    act(() => enqueue('first'))
    act(() => enqueue('second'))
    expect(visibleText()).toContain('first')
    expect(visibleText()).toContain('second')
    expect(vi.getTimerCount()).toBe(2)

    act(() => root.unmount())
    rootUnmounted = true

    expect(window.clearTimeout).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)

    act(() => vi.advanceTimersByTime(4_000))

    expect(vi.getTimerCount()).toBe(0)
    expect(consoleError).not.toHaveBeenCalled()
  })
})
