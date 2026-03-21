import type { MaybeRefOrGetter } from 'vue'

import './index.css'
import DcAuthorIcon from './components/DcAuthorIcon.vue'
import DcAwait from './components/DcAwait.vue'
import DcContent from './components/DcContent.vue'
import DcFloatPopup from './components/DcFloatPopup.vue'
import DcImage from './components/DcImage.vue'
import DcImagedIcon from './components/DcImagedIcon.vue'
import DcList from './components/DcList.vue'
import DcLoading from './components/DcLoading.vue'
import DcMarkdown from './components/DcMarkdown/index.vue'
import DcPopup from './components/DcPopup.vue'
import DcRouterTab from './components/DcRouterTab.vue'
import DcText from './components/DcText.vue'
import DcToggleIcon from './components/DcToggleIcon.vue'
import DcVar from './components/DcVar.vue'
import DcWaterfall from './components/DcWaterfall.vue'
import DcState from './components/DcState.vue'

export {
  DcAuthorIcon,
  DcImagedIcon,
  DcAwait,
  DcContent,
  DcImage,
  DcFloatPopup,
  DcList,
  DcLoading,
  DcPopup,
  DcRouterTab,
  DcText,
  DcToggleIcon,
  DcVar,
  DcWaterfall,
  DcMarkdown,
  DcState
}

declare module 'vue-router' {
  interface Router {
    force: { push: Router['push']; replace: Router['replace'] }
  }
  interface RouteMeta {
    statusBar?: MaybeRefOrGetter<'dark' | 'light' | 'auto'>
    force?: boolean
  }
}

export * from './utils'

import DcForm from './form/components/DcForm.vue'
import DcFormCheckbox from './form/components/DcFormCheckbox.vue'
import DcFormDate from './form/components/DcFormDate.vue'
import DcFormDateRange from './form/components/DcFormDateRange.vue'
import DcFormItem from './form/components/DcFormItem.vue'
import DcFormNumber from './form/components/DcFormNumber.vue'
import DcFormPairs from './form/components/DcFormPairs.vue'
import DcFormRadio from './form/components/DcFormRadio.vue'
import DcFormString from './form/components/DcFormString.vue'
import DcFormSwitch from './form/components/DcFormSwitch.vue'

export {
  DcForm,
  DcFormItem,
  DcFormCheckbox,
  DcFormString,
  DcFormPairs,
  DcFormDate,
  DcFormDateRange,
  DcFormRadio,
  DcFormNumber,
  DcFormSwitch
}

export * as FormType from './form/type'
export * from './form/functional'

export * from './message'