import DesktopComponent from './DownloadDetailDrawer.desktop.vue'
import MobileComponent from './DownloadDetailDrawer.mobile.vue'

export default __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent