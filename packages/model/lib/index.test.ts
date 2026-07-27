import { describe, expect, expectTypeOf, it } from 'vite-plus/test'

import { UniComment } from './model/comment'
import { UniContentPage } from './model/content'
import { UniDownloader } from './model/download'
import { UniEp } from './model/ep'
import { UniImage } from './model/image'
import { UniItem } from './model/item'
import { UniResource } from './model/resource'
import { UniUser } from './model/user'

import * as publicModel from './index'

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
  publicModel.UniResourceProcessInstance,
  publicModel.UniResourceProcessStep,
  publicModel.UniResourceProcessStep_,
  publicModel.UniResourceRaw,
  publicModel.UniResourceType,
  publicModel.UniUserCardComponent,
  publicModel.UniUserRaw,
]

type SourceTypes = [
  import('./model/comment').UniCommentRaw,
  import('./model/comment').UniCommentRow,
  import('./model/content').UniContentLayoutComponent,
  import('./model/content').UniContentPageLike,
  import('./model/content').UniContentType,
  import('./model/content').UniContentType_,
  import('./model/content').UniContentViewComponent,
  import('./model/download').UniContentDownloadProvider,
  import('./model/download').UniContentDownloadSelection,
  import('./model/download').UniDownloadAsset,
  import('./model/download').UniDownloadChecksum,
  import('./model/download').UniDownloadChecksumAlgorithm,
  import('./model/download').UniDownloadHttpHeaderValue,
  import('./model/download').UniDownloadHttpMirror,
  import('./model/download').UniDownloadHttpSource,
  import('./model/download').UniDownloadPlan,
  import('./model/download').UniDownloadRefreshSourceInput,
  import('./model/download').UniDownloadRefreshSourceReason,
  import('./model/download').UniDownloadResolveInput,
  import('./model/download').UniDownloadSource,
  import('./model/download').UniDownloadTorrentInput,
  import('./model/download').UniDownloadTorrentSeedPolicy,
  import('./model/download').UniDownloadTorrentSource,
  import('./model/download').UniLegacyDownloader,
  import('./model/ep').UniEpRaw,
  import('./model/image').UniImage_,
  import('./model/image').UniImageAspect,
  import('./model/image').UniImageRaw,
  import('./model/item').UniItemAuthor,
  import('./model/item').UniItemCardComponent,
  import('./model/item').UniItemCategory,
  import('./model/item').UniItemDescription,
  import('./model/item').UniItemRaw,
  import('./model/item').UniItemTranslator,
  import('./model/resource').UniResourceProcessInstance,
  import('./model/resource').UniResourceProcessStep,
  import('./model/resource').UniResourceProcessStep_,
  import('./model/resource').UniResourceRaw,
  import('./model/resource').UniResourceType,
  import('./model/user').UniUserCardComponent,
  import('./model/user').UniUserRaw,
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