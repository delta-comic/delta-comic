import DesktopComponent from './LogFileList.desktop.vue'
import MobileComponent from './LogFileList.mobile.vue'

export default __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent