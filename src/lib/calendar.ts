import type { Card } from '../types';
import { getCycles } from './finance';

/**
 * Generates an iCalendar (.ics) string for credit card payment due dates.
 * Includes upcoming due dates for all cards with an alarm trigger reminderDaysBeforeDue days before.
 */
export function generateICSCalendar(cards: Card[], reminderDaysBeforeDue: number = 3): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Card Desk//Credit Card Expense Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  const nowStr = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .slice(0, 15) + 'Z';

  cards.forEach((card) => {
    // Generate next 3 billing cycles for this card
    const cycles = getCycles(card, 3);

    cycles.forEach((cycle) => {
      const dueDateClean = cycle.dueDate.replace(/-/g, '');
      const uid = `due-${card.id}-${cycle.dueDate}@cardtracker.local`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${nowStr}`);
      // All-day event on the due date
      lines.push(`DTSTART;VALUE=DATE:${dueDateClean}`);
      lines.push(`DTEND;VALUE=DATE:${dueDateClean}`);
      lines.push(`SUMMARY:Pay ${card.nickname} (•••• ${card.last4}) Bill`);
      lines.push(
        `DESCRIPTION:Credit card payment due for ${card.nickname} (•••• ${card.last4}). Statement cycle closed on ${cycle.statementDate}.`
      );
      lines.push('STATUS:CONFIRMED');

      // Alarm reminderDaysBeforeDue days before
      lines.push('BEGIN:VALARM');
      lines.push(`TRIGGER:-P${Math.max(1, reminderDaysBeforeDue)}D`);
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:Reminder: Pay ${card.nickname} bill in ${reminderDaysBeforeDue} days`);
      lines.push('END:VALARM');

      lines.push('END:VEVENT');
    });
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Initiates download of .ics calendar file in the browser.
 */
export function downloadCalendarICS(
  cards: Card[],
  reminderDaysBeforeDue: number = 3,
  filename: string = 'credit_card_bill_reminders.ics'
): void {
  const icsContent = generateICSCalendar(cards, reminderDaysBeforeDue);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
