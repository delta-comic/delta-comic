import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { isNumber } from 'es-toolkit'

import { formatDate, i18n } from '@/i18n'

export const createDateString = (date: Dayjs | number = dayjs()) => {
  if (isNumber(date)) date = dayjs(date)

  const today = dayjs()
  const isThisYear = date.isSame(today, 'year')
  const isToday = date.isSame(today, 'day')
  const isLastDay = date.isSame(today.subtract(1, 'day'), 'day')
  const dateLabel = isToday
    ? i18n.global.t('date.today')
    : isLastDay
      ? i18n.global.t('date.yesterday')
      : formatDate(date, isThisYear ? 'monthDay' : 'date')
  return `${dateLabel} ${formatDate(date, 'time')}`
}