import DesktopComponent from './ContentDownloadDialog.desktop.vue'
import MobileComponent from './ContentDownloadDialog.mobile.vue'

export default __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent