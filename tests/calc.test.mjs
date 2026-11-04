// Ausführen mit: TZ=Europe/Vienna node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { berechne, autoTag, endzeitpunkt } from '../calc.js';

const d = (s) => new Date(s); // lokale Zeit, z. B. "2026-11-04T18:50"
const hm = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

test('Beispiel aus dem Plan: 18:50, 2:29, morgen 17:30 -> 20 h, fertig 17:19', () => {
  const r = berechne({ start: d('2026-11-04T18:50'), ende: d('2026-11-05T17:30'), dauerMin: 149 });
  assert.equal(r.status, 'ok');
  assert.equal(r.stunden, 20);
  assert.equal(hm(r.fertig), '17:19');
  assert.equal(r.fertig.getDate(), 5);
  assert.equal(r.minutenVorWunsch, 11);
  assert.equal(r.alternative.stunden, 21);
  assert.equal(hm(r.alternative.fertig), '18:19');
  assert.equal(r.alternative.minutenNachWunsch, 49);
});

test('Reserve wird abgezogen: ohne Reserve 21 h, mit 10 Min. nur 20 h', () => {
  const basis = { start: d('2026-11-04T18:00'), ende: d('2026-11-05T18:05'), dauerMin: 180 };
  assert.equal(berechne({ ...basis, reserveMin: 0 }).stunden, 21);
  assert.equal(berechne({ ...basis, reserveMin: 10 }).stunden, 20);
});

test('Puffer unter 1 h -> sofort starten', () => {
  const r = berechne({ start: d('2026-11-04T10:00'), ende: d('2026-11-04T13:40'), dauerMin: 180 });
  assert.equal(r.status, 'sofort');
  assert.equal(r.stunden, 0);
  assert.equal(hm(r.fertig), '13:00');
});

test('Wunschzeit nicht erreichbar', () => {
  const r = berechne({ start: d('2026-11-04T10:00'), ende: d('2026-11-04T12:00'), dauerMin: 180 });
  assert.equal(r.status, 'nichtErreichbar');
  assert.equal(r.stunden, 0);
  assert.equal(hm(r.fertig), '13:00');
  assert.equal(r.alternative, null);
});

test('Über dem Maximum -> auf Maximum begrenzt', () => {
  const r = berechne({ start: d('2026-11-04T08:00'), ende: d('2026-11-06T17:00'), dauerMin: 180, maxStunden: 24 });
  assert.equal(r.status, 'ueberMax');
  assert.equal(r.stunden, 24);
  assert.equal(r.alternative, null);
});

test('Genau 24 h ist noch erlaubt', () => {
  const r = berechne({ start: d('2026-11-04T08:00'), ende: d('2026-11-05T11:10'), dauerMin: 180, maxStunden: 24 });
  assert.equal(r.status, 'ok');
  assert.equal(r.stunden, 24);
});

test('Zeitumstellung (25.10.2026, Nacht hat 25 h) wird berücksichtigt', () => {
  // Wanduhr: 20:00 -> 17:30 = 21:30, real sind es 22:30
  const r = berechne({ start: d('2026-10-24T20:00'), ende: d('2026-10-25T17:30'), dauerMin: 120 });
  assert.equal(r.stunden, 20);
  assert.equal(hm(r.fertig), '17:00');
});

test('autoTag: Uhrzeit schon vorbei -> morgen', () => {
  assert.equal(autoTag(d('2026-11-04T18:50'), '17:30', 149, 10), 1);
});

test('autoTag: heute noch erreichbar -> heute', () => {
  assert.equal(autoTag(d('2026-11-04T10:00'), '17:30', 180, 10), 0);
});

test('autoTag: heute zu knapp -> morgen', () => {
  assert.equal(autoTag(d('2026-11-04T15:00'), '17:30', 180, 10), 1);
});

test('endzeitpunkt über Monatsgrenze', () => {
  const e = endzeitpunkt(d('2026-11-30T20:00'), '07:15', 1);
  assert.equal(e.getMonth(), 11);
  assert.equal(e.getDate(), 1);
  assert.equal(hm(e), '07:15');
});
