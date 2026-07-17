import { describe, expect, it } from 'vite-plus/test'

const componentSources = {
  ...import.meta.glob<string>('./**/*.vue', { eager: true, import: 'default', query: '?raw' }),
  ...import.meta.glob<string>('../src/**/*.vue', { eager: true, import: 'default', query: '?raw' }),
}
const authoredComponentStyles = import.meta.glob<string>('./components/**/*.css', {
  eager: true,
  import: 'default',
  query: '?raw',
})

describe('UI component styling', () => {
  it('keeps authored component visuals in Tailwind classes instead of SFC style blocks', () => {
    for (const [path, source] of Object.entries(componentSources)) {
      expect(source, path).not.toMatch(/<style(?:\s[^>]*)?>/)
      expect(source, path).not.toMatch(/\sstyle=["']/)
    }
  })

  it('only keeps standalone CSS for the Markdown iframe theme', () => {
    expect(Object.keys(authoredComponentStyles).sort()).toEqual([
      './components/DcMarkdown/dark.css',
      './components/DcMarkdown/light.css',
    ])
  })
})