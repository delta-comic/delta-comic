export type SpecialModel = Step[]

export interface Step {
  name: string
  async?: boolean
  call: (setDescription: (description: string) => void) => Promise<void>
}