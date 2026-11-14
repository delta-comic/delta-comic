import DesktopComponent from './AppNavigationItem.desktop.vue'
import MobileComponent from './AppNavigationItem.mobile.vue'

export default __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent