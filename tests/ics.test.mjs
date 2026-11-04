import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kalenderEintrag, icsZeit } from '../ics.js';

test('icsZeit gibt UTC aus (Wien, Winterzeit: 17:19 -> 16:19Z)', () => {
  assert.equal(icsZeit(new Date('2026-11-05T17:19')), '20261105T161900Z');
});

test('Kalendereintrag enthält Start, Ende, Titel und Erinnerung', () => {
  const ics = kalenderEintrag({
    fertig: new Date('2026-11-05T17:19'),
    titel: 'Wäsche fertig',
    beschreibung: 'Startverzögerung: 20 h, Programm 2:29',
    jetzt: new Date('2026-11-04T18:50'),
  });
  const zeilen = ics.split('\r\n');
  assert.equal(zeilen[0], 'BEGIN:VCALENDAR');
  assert.ok(zeilen.includes('DTSTART:20261105T161900Z'));
  assert.ok(zeilen.includes('DTEND:20261105T163400Z'));
  assert.ok(zeilen.includes('SUMMARY:Wäsche fertig'));
  assert.ok(zeilen.includes('DESCRIPTION:Startverzögerung: 20 h\\, Programm 2:29'));
  assert.ok(zeilen.includes('TRIGGER:PT0M'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});
