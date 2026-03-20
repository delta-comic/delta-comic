export abstract class Downloader {
  public abstract id: string
  public abstract name: string
  public abstract $$plugin: string

  public abstract begin: () => void
  public abstract resume: () => void
  public abstract pause: () => void
}