import { Struct, type MetaData } from '../struct'
export interface RawEp {
  name: string
  index: string
  $$plugin: string
  $$meta?: MetaData
}
export class Ep extends Struct<RawEp> implements RawEp {
  public name: string
  public index: string
  public $$plugin: string
  public $$meta?: MetaData
  constructor(v: RawEp) {
    super(v)
    this.name = v.name
    this.index = v.index
    this.$$plugin = v.$$plugin
    this.$$meta = v.$$meta
  }
}