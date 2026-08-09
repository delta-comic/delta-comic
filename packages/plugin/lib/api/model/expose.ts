export type ExposeModel = Record<string, unknown>

/** Plugin id to public expose contract. Plugin consumers extend this through module augmentation. */
export interface PluginExposeRegistry {}