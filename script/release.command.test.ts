import { describe, expect, it, vi } from 'vitest'

import { executeRelease } from './release.mts'

describe('release command', () => {
  it('does not invoke semantic-release when explicit recovery is required', async () => {
    const environment = {
      cleanup: vi.fn().mockResolvedValue(undefined),
      prepare: vi.fn().mockResolvedValue({ shouldRun: false }),
    }
    const semanticRelease = vi.fn().mockResolvedValue(undefined)

    await expect(executeRelease(['--dry-run'], {}, environment, semanticRelease)).resolves.toBe(
      false,
    )
    expect(semanticRelease).not.toHaveBeenCalled()
    expect(environment.cleanup).not.toHaveBeenCalled()
  })

  it('passes the ephemeral baseline only to semantic-release and always removes it', async () => {
    const environment = {
      cleanup: vi.fn().mockResolvedValue(undefined),
      prepare: vi.fn().mockResolvedValue({ ephemeralTag: '2.0.0', shouldRun: true }),
    }
    const semanticRelease = vi.fn().mockResolvedValue(undefined)

    await expect(
      executeRelease(['--dry-run'], { EXISTING: 'value' }, environment, semanticRelease),
    ).resolves.toBe(true)
    expect(semanticRelease).toHaveBeenCalledExactlyOnceWith(
      ['--dry-run'],
      expect.objectContaining({ DELTA_RELEASE_EPHEMERAL_TAG: '2.0.0', EXISTING: 'value' }),
    )
    expect(environment.cleanup).toHaveBeenCalledExactlyOnceWith('2.0.0')
  })

  it('cleans the baseline when semantic-release fails', async () => {
    const environment = {
      cleanup: vi.fn().mockResolvedValue(undefined),
      prepare: vi.fn().mockResolvedValue({ ephemeralTag: '2.0.0', shouldRun: true }),
    }
    const semanticRelease = vi.fn().mockRejectedValue(new Error('publish failed'))

    await expect(executeRelease([], {}, environment, semanticRelease)).rejects.toThrow(
      'publish failed',
    )
    expect(environment.cleanup).toHaveBeenCalledExactlyOnceWith('2.0.0')
  })
})