import DesktopComponent from './recent.desktop.vue'
import MobileComponent from './recent.mobile.vue'

export default __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent