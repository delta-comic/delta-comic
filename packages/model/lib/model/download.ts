import type { Metadata, Metadatable } from '@/struct'

export abstract class Downloader implements Metadatable {
  public abstract id: string
  public abstract name: string
  public abstract $$plugin: string
  public abstract $$meta?: Metadata

  public abstract begin: () => void
  public abstract resume: () => void
  public abstract pause: () => void
}