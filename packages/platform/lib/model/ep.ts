import { MetaStruct, type Metadatable } from './struct'

export interface UniEpRaw extends Metadatable {
  name: string
  id: string
}

export class UniEp extends MetaStruct<UniEpRaw> implements UniEpRaw {
  name = this.$$raw.name
  id = this.$$raw.id
}