import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const { showSnackbar } = vi.hoisted(() => ({ showSnackbar: vi.fn() }))

vi.mock('@/lib/constants', () => ({ EXAMPLE_DIAGRAMS: [] }))

vi.mock('@/app/components/Snackbar', () => ({
  useSnackbar: () => ({ show: showSnackbar }),
}))

import DiagramEditor from '../app/components/DiagramEditor'

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
  body: TestElement
  createElement = vi.fn((tagName: string) => new TestElement(tagName, this))

  constructor() {
    super(9, '#document', null as unknown as TestDocument)
    this.ownerDocument = this
    this.documentElement = new TestElement('html', this)
    this.body = new TestElement('body', this)
  }

  createTextNode(data: string) {
    return new TestText(data, this)
  }
}

function findElement(node: TestNode, predicate: (element: TestElement) => boolean): TestElement | undefined {
  if (node instanceof TestElement && predicate(node)) return node
  for (const child of node.childNodes) {
    const match = findElement(child, predicate)
    if (match) return match
  }
}

describe('DiagramEditor copy lifecycle', () => {
  let root: Root
  let rootUnmounted: boolean
  let container: TestElement
  let document: TestDocument

  beforeEach(() => {
    vi.useFakeTimers()
    showSnackbar.mockClear()
    rootUnmounted = false
    document = new TestDocument()
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

  it('does not schedule copy feedback after an in-flight clipboard write resolves post-unmount', async () => {
    let resolveClipboard!: () => void
    const writeText = vi.fn(() => new Promise<void>((resolve) => {
      resolveClipboard = resolve
    }))
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    act(() => {
      root.render(createElement(DiagramEditor, { value: 'graph TD\nA --> B', onChange: vi.fn() }))
    })

    const copyButton = findElement(container, (element) => element.tagName === 'BUTTON' && element.textContent === '⎘')
    expect(copyButton).toBeDefined()
    const propsKey = Object.keys(copyButton!).find((key) => key.startsWith('__reactProps$'))
    expect(propsKey).toBeDefined()

    let copyPromise!: Promise<void>
    act(() => {
      copyPromise = (copyButton as unknown as Record<string, { onClick: () => Promise<void> }>)[propsKey!].onClick()
    })
    expect(writeText).toHaveBeenCalledWith('graph TD\nA --> B')

    const createElementCalls = document.createElement.mock.calls.length
    act(() => root.unmount())
    rootUnmounted = true

    await act(async () => {
      resolveClipboard()
      await copyPromise
    })

    expect(document.createElement).toHaveBeenCalledTimes(createElementCalls)
    expect(showSnackbar).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
