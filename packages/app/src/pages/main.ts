import DesktopComponent from './main.desktop.vue'
import MobileComponent from './main.mobile.vue'

export default __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent