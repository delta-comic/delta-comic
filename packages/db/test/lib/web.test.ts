import { describe, expect, it } from 'vite-plus/test'

import { WEB_SCHEMA_STATEMENTS } from '../../lib/web'

describe('web database schema', () => {
  it('creates every application table and enables the default favourite card', () => {
    const schema = WEB_SCHEMA_STATEMENTS.join('\n')

    for (const table of [
      'item_store',
      'history',
      'recent_view',
      'favourite_card',
      'favourite_item',
      'subscribe',
      'plugin',
      'native_store',
      'config',
    ]) {
      expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${table}`)
    }
    expect(schema).toContain("VALUES (0, '默认收藏夹', 0, '')")
  })
})