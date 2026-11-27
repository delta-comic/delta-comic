import parse from '@fixture/parser/text'
export * from '@fixture/parser/text'
export const title = parse('Delta').title
export const lazy = () => import('@fixture/parser/lazy')