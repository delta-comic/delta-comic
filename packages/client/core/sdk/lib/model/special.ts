export type SpecialModel = Step[]

export interface Step {
  name: string
  call: (setDescription: (description: string) => void) => Promise<void>
}