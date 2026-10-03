export type LocaleShape<T> = {
  [Key in keyof T]: T[Key] extends string ? string : LocaleShape<T[Key]>
}