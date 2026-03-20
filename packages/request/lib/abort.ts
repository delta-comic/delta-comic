import mitt from 'mitt'

export class SmartAbortController implements AbortController {
  private _controller = new AbortController()
  private mitt = mitt<{ abort: void }>()
  public get signal() {
    return this._controller.signal
  }
  public abort(reason?: any): void {
    this._controller.abort(reason)
    this._controller = new AbortController()
    this.mitt.emit('abort')
  }
  public onAbort(fn: () => any) {
    this.mitt.on('abort', fn)
    return () => this.mitt.off('abort', fn)
  }
  public onAbortOnce(fn: () => any) {
    const handler = async () => {
      await fn()
      this.mitt.off('abort', handler)
    }
    this.mitt.on('abort', handler)
  }
}