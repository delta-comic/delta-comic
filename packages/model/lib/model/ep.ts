import { Struct, type Metadata, type Metadatable } from '../struct'
export interface RawEp extends Metadatable {
  name: string
  id: string
}
export class Ep extends Struct<RawEp> implements RawEp {
  public name: string
  public id: string
  public $$plugin: string
  public $$meta?: Metadata
  constructor(v: RawEp) {
    super(v)
    this.name = v.name
    this.id = v.id
    this.$$plugin = v.$$plugin
    this.$$meta = v.$$meta
  }
}