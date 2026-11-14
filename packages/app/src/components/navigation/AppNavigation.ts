import DesktopComponent from './AppNavigation.desktop.vue'
import MobileComponent from './AppNavigation.mobile.vue'

export default __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent