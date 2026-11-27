import parse from '@fixture/parser/text'
const parsed = parse('Delta')
// @ts-expect-error the parser exposes only title
export const author = parsed.author