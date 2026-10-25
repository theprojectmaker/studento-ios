/** The on-device schedule parser: text from OCR or typing -> periods, classes, rooms. */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parsedSomething, parseScheduleText } from '../src/lib/scheduleParser';

test('typed rows with times, rooms and a lunch line', () => {
  const s = parseScheduleText(`Period 1  Algebra  8:00-8:41  Room 112
Period 2  English  8:44-9:25
Period 3  Biology  9:28-10:09  Lab B
Lunch  10:12-10:53`);
  assert.equal(s.hasTimes, true);
  assert.deepEqual(
    s.days.Mon.map((r) => [r.period, r.name, r.start, r.end, r.room]),
    [
      ['1', 'Algebra', '08:00', '08:41', '112'],
      ['2', 'English', '08:44', '09:25', ''],
      ['3', 'Biology', '09:28', '10:09', 'Lab B'],
      ['lunch', 'Lunch', '10:12', '10:53', ''],
    ]
  );
  assert.deepEqual(s.classes!, { '1': 'Algebra', '2': 'English', '3': 'Biology', lunch: 'Lunch' });
  assert.deepEqual(s.rooms!, { '1': '112', '3': 'Lab B' });
  // Same every day when no day header is given.
  assert.deepEqual(s.days.Fri, s.days.Mon);
});

test('a class list with no times still gives classes and rooms (North bells mode)', () => {
  const s = parseScheduleText(`1 Math 204
2 English 112
3rd period: Spanish rm 118
P4 Gym
Advisory Homeroom 115
9 Chemistry Lab 2`);
  assert.equal(s.hasTimes, false);
  assert.deepEqual(s.classes!, { '1': 'Math', '2': 'English', '3': 'Spanish', '4': 'Gym', advisory: 'Homeroom', '9': 'Chemistry' });
  assert.deepEqual(s.rooms!, { '1': '204', '2': '112', '3': '118', advisory: '115', '9': 'Lab 2' });
  assert.equal(s.days.Mon.length, 0);
  assert.ok(parsedSomething(s));
});

test('OCR columns: the period, class and room arrive on separate lines', () => {
  const s = parseScheduleText(`Student Schedule
Period 1
Algebra II
204
Period 2
English 10
Period 3
Biology
Lab B
8:00 - 8:41`);
  assert.equal(s.classes!['1'], 'Algebra II');
  assert.equal(s.rooms!['1'], '204');
  assert.equal(s.classes!['2'], 'English 10');
  assert.equal(s.classes!['3'], 'Biology');
  assert.equal(s.rooms!['3'], 'Lab B');
  // The trailing time joins the last row that had none.
  assert.equal(s.days.Mon.length, 1);
  assert.equal(s.days.Mon[0].name, 'Biology');
});

test('day headers: Wednesday rows apply only to Wednesday', () => {
  const s = parseScheduleText(`Period 1 Math 8:00-8:41
Period 2 Art 8:44-9:25
Wednesday
Advisory 8:00-8:20
Period 1 Math 8:23-9:00`);
  assert.equal(s.days.Mon.length, 2);
  assert.equal(s.days.Wed.length, 2);
  assert.equal(s.days.Wed[0].period, 'advisory');
  assert.equal(s.days.Wed[1].start, '08:23');
  assert.equal(s.days.Thu.length, 2);
});

test('a plain list with no numbers is numbered in order; junk and headers are ignored', () => {
  const s = parseScheduleText(`Name: Sam
Math
English
• Biology
----
Teacher`);
  assert.deepEqual(s.classes!, { '1': 'Math', '2': 'English', '3': 'Biology' });
});

test('afternoon times without am/pm and 12-hour times parse right', () => {
  const s = parseScheduleText(`Period 8 Spanish 1:05-1:46
Period 9 Band 1:49 pm - 2:30 pm`);
  assert.deepEqual(
    s.days.Mon.map((r) => [r.start, r.end]),
    [
      ['13:05', '13:46'],
      ['13:49', '14:30'],
    ]
  );
});

test('nothing usable -> parsedSomething is false', () => {
  assert.equal(parsedSomething(parseScheduleText('')), false);
  assert.equal(parsedSomething(parseScheduleText('Schedule\nTeacher\n---')), false);
});
