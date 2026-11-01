export const prereleaseWarning =
  '**谨慎更新：当前版本为预发布版本，可能包含未完成的功能或兼容性问题，请酌情更新。**'

export function createReleaseNameTemplate() {
  return 'Delta Comic <%= nextRelease.version %><%= nextRelease.channel ? " 预览版" : " 正式版" %>'
}