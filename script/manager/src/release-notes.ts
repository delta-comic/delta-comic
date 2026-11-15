export const prereleaseWarning =
  '**请谨慎更新，当前版本为预发布版本，可能包含未完成的功能或兼容性问题**'

export function createReleaseNameTemplate() {
  return 'Release <%= nextRelease.version %><%= nextRelease.channel ? " preview" : " stable" %>'
}