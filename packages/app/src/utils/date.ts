import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { isNumber } from 'es-toolkit'

import { i18n } from '@/i18n'

export const createDateString = (date: Dayjs | number = dayjs()) => {
  if (isNumber(date)) date = dayjs(date)

  const today = dayjs()
  const isThisYear = date.isSame(today, 'year')
  const isToday = date.isSame(today, 'day')
  const isLastDay = date.isSame(today.subtract(1, 'day'), 'day')
  const locale = i18n.global.locale.value
  const dateLabel = isToday
    ? i18n.global.t('date.today')
    : isLastDay
      ? i18n.global.t('date.yesterday')
      : new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: 'short',
          year: isThisYear ? undefined : 'numeric',
        }).format(date.toDate())
  const timeLabel = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
  }).format(date.toDate())
  return `${dateLabel} ${timeLabel}`
}