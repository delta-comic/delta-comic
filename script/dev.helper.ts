import os from 'os'

export const getNetworkServerUrl = () => {
  const networkInterface = os.networkInterfaces()
  const allIPV4 = new Array<os.NetworkInterfaceInfo>()
  for (const key in networkInterface) {
    if (Object.prototype.hasOwnProperty.call(networkInterface, key)) {
      const element = networkInterface[key]
      if (!element) continue
      allIPV4.push(...element.filter(v => v.family === 'IPv4'))
    }
  }
  const withoutInner = allIPV4.filter(v => !v.internal)
  return withoutInner[0].address
}
