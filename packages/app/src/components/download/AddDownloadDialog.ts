import DesktopComponent from './AddDownloadDialog.desktop.vue'
import MobileComponent from './AddDownloadDialog.mobile.vue'

export default __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent