// Rechenlogik des Waschmaschinen-Timers.
// Alle Zeitpunkte sind Date-Objekte; gerechnet wird mit echten Millisekunden,
// damit "morgen" und die Zeitumstellung automatisch stimmen.

const MINUTE = 60 * 1000;
const STUNDE = 60 * MINUTE;

/**
 * Baut den Zeitpunkt der Wunsch-Endzeit: Datum von `start` plus `tagOffset` Tage,
 * Uhrzeit aus "HH:MM".
 */
export function endzeitpunkt(start, uhrzeit, tagOffset) {
  const [h, m] = uhrzeit.split(':').map(Number);
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + tagOffset, h, m, 0, 0);
  return d;
}

/**
 * Wählt den frühesten Tag (0 = heute, 1 = morgen, 2 = übermorgen), an dem die
 * Wunsch-Endzeit mit Programmdauer und Reserve noch erreichbar ist.
 */
export function autoTag(start, uhrzeit, dauerMin, reserveMin = 0) {
  for (let tag = 0; tag <= 2; tag++) {
    const ende = endzeitpunkt(start, uhrzeit, tag);
    if (ende - start >= (dauerMin + reserveMin) * MINUTE) return tag;
  }
  return 2;
}

/**
 * Berechnet die Startverzögerung in ganzen Stunden (immer abgerundet).
 *
 * Status:
 *  - "ok":              Verzögerung >= 1 h
 *  - "sofort":          weniger als 1 h Puffer, also ohne Verzögerung starten
 *  - "nichtErreichbar": Wunschzeit ist selbst bei sofortigem Start nicht zu schaffen
 *  - "ueberMax":        nötige Verzögerung ist größer als das Maximum der Maschine
 */
export function berechne({ start, ende, dauerMin, reserveMin = 10, maxStunden = 24 }) {
  const dauer = dauerMin * MINUTE;
  const puffer = ende - start - dauer - reserveMin * MINUTE;

  let status;
  let stunden;
  if (puffer < 0) {
    status = 'nichtErreichbar';
    stunden = 0;
  } else {
    stunden = Math.floor(puffer / STUNDE);
    if (stunden > maxStunden) {
      status = 'ueberMax';
      stunden = maxStunden;
    } else {
      status = stunden === 0 ? 'sofort' : 'ok';
    }
  }

  const fertig = new Date(start.getTime() + stunden * STUNDE + dauer);
  const minutenVorWunsch = Math.round((ende - fertig) / MINUTE);

  let alternative = null;
  if (status !== 'nichtErreichbar' && stunden + 1 <= maxStunden) {
    const fertigAlt = new Date(fertig.getTime() + STUNDE);
    alternative = {
      stunden: stunden + 1,
      fertig: fertigAlt,
      minutenNachWunsch: Math.round((fertigAlt - ende) / MINUTE),
    };
  }

  return { status, stunden, fertig, minutenVorWunsch, alternative };
}
