import type { Content } from '../model'

export interface ContentHooks {
  onSearchBarcodeSubmit(searchAim: Content.SearchAim): void
  onHotCategoryClick(category: Content.HotCategory): void
  onHotTopButtonClick(button: Content.HotTopButton): void
}