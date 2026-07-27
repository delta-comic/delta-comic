import { Struct, type Metadata, type Metadatable } from '../struct'
export interface UniEpRaw extends Metadatable {
  name: string
  id: string
}
export class UniEp extends Struct<UniEpRaw> implements UniEpRaw {
  public name: string
  public id: string
  public $$plugin: string
  public $$meta?: Metadata
  constructor(v: UniEpRaw) {
    super(v)
    this.name = v.name
    this.id = v.id
    this.$$plugin = v.$$plugin
    this.$$meta = v.$$meta
  }
}