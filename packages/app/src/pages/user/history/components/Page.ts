import DesktopComponent from './Page.desktop.vue'
import MobileComponent from './Page.mobile.vue'

export default __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent