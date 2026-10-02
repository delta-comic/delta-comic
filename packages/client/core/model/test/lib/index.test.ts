import { describe, expect, expectTypeOf, it } from 'vite-plus/test'

import * as publicModel from '../../lib/index'
import { UniComment } from '../../lib/model/comment'
import { UniContentPage } from '../../lib/model/content'
import { UniDownloader } from '../../lib/model/download'
import { UniEp } from '../../lib/model/ep'
import { UniImage } from '../../lib/model/image'
import { UniItem } from '../../lib/model/item'
import { UniResource } from '../../lib/model/resource'
import { UniUser } from '../../lib/model/user'

type PublicTypeAliases = [
  publicModel.UniCommentRaw,
  publicModel.UniCommentRow,
  publicModel.UniContentLayoutComponent,
  publicModel.UniContentPageLike,
  publicModel.UniContentType,
  publicModel.UniContentType_,
  publicModel.UniContentViewComponent,
  publicModel.UniContentDownloadProvider,
  publicModel.UniContentDownloadSelection,
  publicModel.UniDownloadAsset,
  publicModel.UniDownloadChecksum,
  publicModel.UniDownloadChecksumAlgorithm,
  publicModel.UniDownloadHttpHeaderValue,
  publicModel.UniDownloadHttpMirror,
  publicModel.UniDownloadHttpSource,
  publicModel.UniDownloadPlan,
  publicModel.UniDownloadRefreshSourceInput,
  publicModel.UniDownloadRefreshSourceReason,
  publicModel.UniDownloadResolveInput,
  publicModel.UniDownloadSource,
  publicModel.UniDownloadTorrentInput,
  publicModel.UniDownloadTorrentSeedPolicy,
  publicModel.UniDownloadTorrentSource,
  publicModel.UniLegacyDownloader,
  publicModel.UniEpRaw,
  publicModel.UniImage_,
  publicModel.UniImageAspect,
  publicModel.UniImageRaw,
  publicModel.UniItemAuthor,
  publicModel.UniItemCardComponent,
  publicModel.UniItemCategory,
  publicModel.UniItemDescription,
  publicModel.UniItemRaw,
  publicModel.UniItemTranslator,
  publicModel.UniResourceProcessStep,
  publicModel.UniResourceProcessStep_,
  publicModel.UniResourceProcessor,
  publicModel.UniResourceRaw,
  publicModel.UniUserCardComponent,
  publicModel.UniUserRaw,
]

type SourceTypes = [
  import('../../lib/model/comment').UniCommentRaw,
  import('../../lib/model/comment').UniCommentRow,
  import('../../lib/model/content').UniContentLayoutComponent,
  import('../../lib/model/content').UniContentPageLike,
  import('../../lib/model/content').UniContentType,
  import('../../lib/model/content').UniContentType_,
  import('../../lib/model/content').UniContentViewComponent,
  import('../../lib/model/download').UniContentDownloadProvider,
  import('../../lib/model/download').UniContentDownloadSelection,
  import('../../lib/model/download').UniDownloadAsset,
  import('../../lib/model/download').UniDownloadChecksum,
  import('../../lib/model/download').UniDownloadChecksumAlgorithm,
  import('../../lib/model/download').UniDownloadHttpHeaderValue,
  import('../../lib/model/download').UniDownloadHttpMirror,
  import('../../lib/model/download').UniDownloadHttpSource,
  import('../../lib/model/download').UniDownloadPlan,
  import('../../lib/model/download').UniDownloadRefreshSourceInput,
  import('../../lib/model/download').UniDownloadRefreshSourceReason,
  import('../../lib/model/download').UniDownloadResolveInput,
  import('../../lib/model/download').UniDownloadSource,
  import('../../lib/model/download').UniDownloadTorrentInput,
  import('../../lib/model/download').UniDownloadTorrentSeedPolicy,
  import('../../lib/model/download').UniDownloadTorrentSource,
  import('../../lib/model/download').UniLegacyDownloader,
  import('../../lib/model/ep').UniEpRaw,
  import('../../lib/model/image').UniImage_,
  import('../../lib/model/image').UniImageAspect,
  import('../../lib/model/image').UniImageRaw,
  import('../../lib/model/item').UniItemAuthor,
  import('../../lib/model/item').UniItemCardComponent,
  import('../../lib/model/item').UniItemCategory,
  import('../../lib/model/item').UniItemDescription,
  import('../../lib/model/item').UniItemRaw,
  import('../../lib/model/item').UniItemTranslator,
  import('../../lib/model/resource').UniResourceProcessStep,
  import('../../lib/model/resource').UniResourceProcessStep_,
  import('../../lib/model/resource').UniResourceProcessor,
  import('../../lib/model/resource').UniResourceRaw,
  import('../../lib/model/user').UniUserCardComponent,
  import('../../lib/model/user').UniUserRaw,
]

describe('public Uni model API', () => {
  it('exports runtime models with flat names', () => {
    expect(publicModel).not.toHaveProperty('uni')
    expect(publicModel.UniComment).toBe(UniComment)
    expect(publicModel.UniContentPage).toBe(UniContentPage)
    expect(publicModel.UniDownloader).toBe(UniDownloader)
    expect(publicModel.UniEp).toBe(UniEp)
    expect(publicModel.UniImage).toBe(UniImage)
    expect(publicModel.UniItem).toBe(UniItem)
    expect(publicModel.UniResource).toBe(UniResource)
    expect(publicModel.UniUser).toBe(UniUser)
  })

  it('exports every model type with a flat name', () => {
    expectTypeOf<PublicTypeAliases>().toEqualTypeOf<SourceTypes>()
  })
})