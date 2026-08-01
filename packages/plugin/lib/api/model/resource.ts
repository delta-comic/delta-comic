import type { UniResourceProcessInstance, UniResourceType } from '@delta-comic/model'

/** Declarative resource schemes and their pathname processors. */
export interface ResourceModel {
  process?: Record<string, UniResourceProcessInstance>
  types?: UniResourceType[]
}