import DesktopComponent from './history.desktop.vue'
import MobileComponent from './history.mobile.vue'

export default __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent