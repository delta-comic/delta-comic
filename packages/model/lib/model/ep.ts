import { field, MetaStruct, type Metadatable } from '../struct'

export interface UniEpRaw extends Metadatable {
  name: string
  id: string
}

export class UniEp extends MetaStruct<UniEpRaw> implements UniEpRaw {
  @field name!: string
  @field id!: string
}