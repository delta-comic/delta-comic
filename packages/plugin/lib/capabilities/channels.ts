import type {
  ContentModel,
  ExposeModel,
  PluginExposeRegistry,
  RemoteModel,
  SocialModel,
  SpecialModel,
  UserModel,
} from '../api/model'
import { defineContributionChannel } from '../kernel'

export const pluginModelChannels = {
  content: defineContributionChannel<ContentModel>('model:content'),
  expose: defineContributionChannel<ExposeModel, PluginExposeRegistry>('model:expose'),
  remote: defineContributionChannel<RemoteModel>('model:remote'),
  social: defineContributionChannel<SocialModel>('model:social'),
  special: defineContributionChannel<SpecialModel>('model:special'),
  user: defineContributionChannel<UserModel>('model:user'),
} as const