import DesktopComponent from './home.desktop.vue'
import MobileComponent from './home.mobile.vue'

export default __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent