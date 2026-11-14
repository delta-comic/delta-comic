import DesktopComponent from './LogReaderPanel.desktop.vue'
import MobileComponent from './LogReaderPanel.mobile.vue'

export default __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent