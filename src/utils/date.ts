import type { Dayjs } from 'dayjs'

import dayjs from 'dayjs'

export const createDateString = (date: Dayjs = dayjs()) => {
  const today = dayjs()
  const isThisYear = date.isSame(today, 'year')
  const isInSameMonth = isThisYear && date.isSame(today, 'month')
  const isToday = isInSameMonth && date.date() === today.date()
  const isLastDay = isInSameMonth && date.date() === today.date() - 1
  // const isLastLastDay = isInSameMonth && date.date() === today.date() - 2
  let format = ''
  if (!isThisYear) format += 'YYYY年 '
  if (isToday) format += '今天 '
  else if (isLastDay) format += '昨天 '
  // else if (isLastLastDay) format += '前天 '
  else format += 'M月D日 '
  format += 'HH:mm'
  return date.format(format)
}