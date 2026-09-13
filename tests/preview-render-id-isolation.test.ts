import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mermaidMocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async (id: string) => ({
    svg: `<svg id="${id}"></svg>`,
  })),
}))

vi.mock('mermaid', () => ({ default: mermaidMocks }))
vi.mock('@/lib/diagramTypes', () => ({ parseDiagramType: () => 'flowchart' }))
vi.mock('@/lib/errorUtils', () => ({ extractLineNumber: () => null }))

import DiagramPreview from '../app/components/DiagramPreview'

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

  get firstChild() { return this.childNodes[0] ?? null }
  get lastChild() { return this.childNodes.at(-1) ?? null }
  get nextSibling() {
    if (!this.parentNode) return null
    const index = this.parentNode.childNodes.indexOf(this)
    return this.parentNode.childNodes[index + 1] ?? null
  }
}

class TestText extends TestNode {
  data: string

  constructor(data: string, ownerDocument: TestDocument) {
    super(3, '#text', ownerDocument)
    this.data = data
  }
}

class TestElement extends TestNode {
  tagName: string
  namespaceURI = 'http://www.w3.org/1999/xhtml'
  style = { setProperty: vi.fn() }
  innerHTML = ''
  clientWidth = 0
  clientHeight = 0

  constructor(tagName: string, ownerDocument: TestDocument) {
    super(1, tagName.toUpperCase(), ownerDocument)
    this.tagName = tagName.toUpperCase()
  }

  setAttribute() {}
  removeAttribute() {}
  querySelector() { return null }
  querySelectorAll() { return [] }
}

class TestDocument extends TestNode {
  defaultView: Record<string, unknown> | null = null
  documentElement: TestElement

  constructor() {
    super(9, '#document', null as unknown as TestDocument)
    this.ownerDocument = this
    this.documentElement = new TestElement('html', this)
  }

  createElement(tagName: string) { return new TestElement(tagName, this) }
  createElementNS(_namespace: string, tagName: string) { return this.createElement(tagName) }
  createTextNode(data: string) { return new TestText(data, this) }
}

let roots: Root[]

beforeEach(() => {
  mermaidMocks.initialize.mockClear()
  mermaidMocks.render.mockClear()

  const document = new TestDocument()
  const window = {
    document,
    HTMLIFrameElement: class {},
  }
  document.defaultView = window
  vi.stubGlobal('document', document)
  vi.stubGlobal('window', window)
  vi.stubGlobal('HTMLElement', TestElement)
  vi.stubGlobal('Node', TestNode)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  roots = [
    createRoot(document.createElement('div') as unknown as Element, { identifierPrefix: 'first:' }),
    createRoot(document.createElement('div') as unknown as Element, { identifierPrefix: 'second:' }),
  ]
})

afterEach(() => {
  act(() => roots.forEach((root) => root.unmount()))
  vi.unstubAllGlobals()
})

it('uses distinct selector-safe Mermaid render IDs for separate preview instances', async () => {
  await act(async () => {
    roots[0].render(createElement(DiagramPreview, { code: 'flowchart TD\nA --> B' }))
    for (let attempt = 0; attempt < 5 && mermaidMocks.render.mock.calls.length < 1; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  })
  await act(async () => {
    roots[1].render(createElement(DiagramPreview, { code: 'flowchart TD\nC --> D' }))
    for (let attempt = 0; attempt < 5 && mermaidMocks.render.mock.calls.length < 2; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  })

  expect(mermaidMocks.initialize).toHaveBeenCalledTimes(2)
  expect(mermaidMocks.render).toHaveBeenCalledTimes(2)
  const renderIds = mermaidMocks.render.mock.calls.map(([id]) => id)

  expect(new Set(renderIds).size).toBe(2)
  renderIds.forEach((id) => expect(id).toMatch(/^mermaid-[a-zA-Z0-9_-]+-1$/))
})
