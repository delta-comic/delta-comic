import DesktopComponent from './LogToolbar.desktop.vue'
import MobileComponent from './LogToolbar.mobile.vue'

export default __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent