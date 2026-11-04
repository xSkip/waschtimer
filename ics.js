// Erzeugt einen Kalendereintrag (iCalendar, RFC 5545) für den Zeitpunkt, an dem die Wäsche fertig ist.

const zwei = (n) => String(n).padStart(2, '0');

// Zeitpunkt in UTC, z. B. 20261105T161900Z – so stimmt die Uhrzeit in jeder Zeitzone.
export function icsZeit(d) {
  return `${d.getUTCFullYear()}${zwei(d.getUTCMonth() + 1)}${zwei(d.getUTCDate())}T`
    + `${zwei(d.getUTCHours())}${zwei(d.getUTCMinutes())}${zwei(d.getUTCSeconds())}Z`;
}

const maskieren = (text) => text.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/**
 * @param {object} p
 * @param {Date} p.fertig       Zeitpunkt, an dem die Wäsche fertig ist
 * @param {string} p.titel      Titel des Termins
 * @param {string} [p.beschreibung]
 * @param {number} [p.dauerMin] Länge des Termins im Kalender
 * @param {Date} [p.jetzt]      für DTSTAMP und UID (Tests)
 */
export function kalenderEintrag({ fertig, titel, beschreibung = '', dauerMin = 15, jetzt = new Date() }) {
  const ende = new Date(fertig.getTime() + dauerMin * 60000);
  const uid = `${icsZeit(jetzt)}-${Math.random().toString(36).slice(2, 10)}@waschtimer`;
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WaschTimer//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsZeit(jetzt)}`,
    `DTSTART:${icsZeit(fertig)}`,
    `DTEND:${icsZeit(ende)}`,
    `SUMMARY:${maskieren(titel)}`,
  ];
  if (beschreibung) zeilen.push(`DESCRIPTION:${maskieren(beschreibung)}`);
  zeilen.push(
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${maskieren(titel)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  );
  return zeilen.join('\r\n') + '\r\n';
}
