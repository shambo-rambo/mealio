export interface RecurrenceRule {
  freq: 'daily' | 'weekly' | 'fortnightly' | 'days'
  days?: number[] // 0=Sun…6=Sat, used when freq='days'
}

/** Returns ISO date strings (YYYY-MM-DD) from startDate, up to `limit` entries */
export function expandRecurrenceRule(
  rule: RecurrenceRule,
  startDate: string,
  limit = 365,
): string[] {
  const dates: string[] = []
  // Parse as UTC midnight so toISOString() always returns the expected date
  // regardless of the server's local timezone. Using local-time parsing causes
  // off-by-one duplicates in timezones east of UTC (e.g. Australia/Sydney).
  const start = new Date(`${startDate}T00:00:00Z`)
  const cursor = new Date(start)
  cursor.setUTCDate(cursor.getUTCDate() + 1) // skip the original entry

  while (dates.length < limit) {
    const iso = cursor.toISOString().slice(0, 10)

    if (rule.freq === 'daily') {
      dates.push(iso)
    } else if (rule.freq === 'weekly') {
      if (cursor.getUTCDay() === start.getUTCDay()) dates.push(iso)
    } else if (rule.freq === 'fortnightly') {
      const diffDays = Math.round((cursor.getTime() - start.getTime()) / 86_400_000)
      if (diffDays % 14 === 0) dates.push(iso)
    } else if (rule.freq === 'days' && rule.days) {
      if (rule.days.includes(cursor.getUTCDay())) dates.push(iso)
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1)

    // Stop after 1 year
    const diffDays = Math.round((cursor.getTime() - start.getTime()) / 86_400_000)
    if (diffDays > 366) break
  }

  return dates.slice(0, limit)
}
