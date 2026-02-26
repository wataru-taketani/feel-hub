import { formatStudio } from '@/lib/lessonUtils';

interface CalendarLesson {
  date: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
  programName: string;
  instructor: string;
  studio: string;
}

function toICSDateTime(date: string, time: string): string {
  // "2026-02-26" + "19:00" → "20260226T190000"
  return date.replace(/-/g, '') + 'T' + time.replace(':', '') + '00';
}

function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}@feel-hub`;
}

export function generateICS(lesson: CalendarLesson): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Feel Hub//NONSGML v1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${generateUID()}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Asia/Tokyo:${toICSDateTime(lesson.date, lesson.startTime)}`,
    `DTEND;TZID=Asia/Tokyo:${toICSDateTime(lesson.date, lesson.endTime)}`,
    `SUMMARY:${lesson.programName}（${lesson.studio}）`,
    `LOCATION:FEELCYCLE ${formatStudio(lesson.studio)}`,
    `DESCRIPTION:インストラクター: ${lesson.instructor}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

export function downloadICS(lesson: CalendarLesson): void {
  const ics = generateICS(lesson);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `feelcycle-${lesson.date}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
