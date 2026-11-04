import { berechne, autoTag, endzeitpunkt } from './calc.js';
import { kalenderEintrag } from './ics.js';

const SPEICHER_KEY = 'waschtimer.v1';
const TAGE = ['Heute', 'Morgen', 'Übermorgen'];

const neueId = () => Math.random().toString(36).slice(2, 10);

const STANDARD = {
  programme: [
    { id: 'p3h', name: '3 h', dauerMin: 180 },
    { id: 'p4h', name: '4 h', dauerMin: 240 },
  ],
  dauerMin: 180,
  endzeit: '17:30',
  reserveMin: 10,
  maxStunden: 23,
  installHinweisAus: false,
  datenVersion: 2,
};

function laden() {
  try {
    const roh = localStorage.getItem(SPEICHER_KEY);
    if (!roh) return structuredClone(STANDARD);
    const daten = JSON.parse(roh);
    // Version 1 hatte 24 h als Standard-Maximum; Marios Maschine kann 23 h.
    if (!daten.datenVersion && daten.maxStunden === 24) daten.maxStunden = 23;
    daten.datenVersion = STANDARD.datenVersion;
    return { ...structuredClone(STANDARD), ...daten };
  } catch {
    return structuredClone(STANDARD);
  }
}

function speichern() {
  try {
    localStorage.setItem(SPEICHER_KEY, JSON.stringify(zustand));
  } catch {
    // privater Modus o. ä.: App funktioniert trotzdem, merkt sich nur nichts
  }
}

const zustand = laden();
let startLive = true;
let tagManuell = null; // null = automatisch, sonst das gewählte Kalenderdatum (Mitternacht)

const $ = (id) => document.getElementById(id);
const el = {
  stunden: $('stunden'),
  fertig: $('fertig'),
  hinweis: $('hinweis'),
  alternative: $('alternative'),
  endzeit: $('endzeit'),
  tagInfo: $('tag-info'),
  segmente: document.querySelectorAll('.segmente button'),
  chips: $('chips'),
  dauerH: $('dauer-h'),
  dauerM: $('dauer-m'),
  startzeit: $('startzeit'),
  startInfo: $('start-info'),
  jetzt: $('jetzt'),
  reserve: $('reserve'),
  max: $('max'),
  dialog: $('programme-dialog'),
  liste: $('programm-liste'),
};

// ---------- Hilfsfunktionen ----------

const zwei = (n) => String(n).padStart(2, '0');
const uhrzeit = (d) => `${zwei(d.getHours())}:${zwei(d.getMinutes())}`;

function dauerText(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${zwei(m)}`;
}

function minutenText(min) {
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} Min.` : `${h} h`;
}

function tagWort(datum, bezug) {
  const a = new Date(bezug.getFullYear(), bezug.getMonth(), bezug.getDate());
  const b = new Date(datum.getFullYear(), datum.getMonth(), datum.getDate());
  const diff = Math.round((b - a) / 86400000);
  if (diff === 0) return 'heute';
  if (diff === 1) return 'morgen';
  if (diff === 2) return 'übermorgen';
  return datum.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'numeric' });
}

const MAX_DAUER_MIN = 12 * 60 + 59;

// Dauer aus Stunden- und Minutenfeld. Minuten über 59 zählen als Stunden (90 Min. = 1 h 30 Min.).
// Mit `zurueckschreiben` wird der normalisierte Wert in die Felder übernommen, damit Anzeige und Rechnung übereinstimmen.
function dauerAusFeldern(hInput, mInput, zurueckschreiben = false) {
  const h = Math.max(0, parseInt(hInput.value, 10) || 0);
  const m = Math.max(0, parseInt(mInput.value, 10) || 0);
  const gesamt = Math.min(MAX_DAUER_MIN, h * 60 + m);
  if (zurueckschreiben) {
    hInput.value = Math.floor(gesamt / 60);
    mInput.value = gesamt % 60;
  }
  return gesamt;
}

function tagesbeginn(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function zahl(input, min, max, standard) {
  const n = parseInt(input.value, 10);
  if (Number.isNaN(n)) return standard;
  return Math.min(max, Math.max(min, n));
}

function jetztOhneSekunden() {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}

function startzeitpunkt() {
  if (startLive) return jetztOhneSekunden();
  const heute = new Date();
  const [h, m] = (el.startzeit.value || uhrzeit(heute)).split(':').map(Number);
  return new Date(heute.getFullYear(), heute.getMonth(), heute.getDate(), h, m, 0, 0);
}

// ---------- Berechnen und anzeigen ----------

function aktualisieren() {
  const start = startzeitpunkt();
  if (startLive) el.startzeit.value = uhrzeit(start);
  el.startInfo.textContent = startLive
    ? 'Aktuelle Uhrzeit, läuft automatisch mit.'
    : 'Feste Startzeit. „Jetzt“ setzt sie zurück.';

  const wunsch = el.endzeit.value || zustand.endzeit;
  if (tagManuell !== null) {
    // Gewählter Tag ist ein festes Datum; springt die Startzeit über Mitternacht, bleibt es dasselbe Datum.
    const offset = Math.round((tagManuell - tagesbeginn(start)) / 86400000);
    if (offset < 0 || offset > 2) tagManuell = null;
  }
  const tag = tagManuell === null
    ? autoTag(start, wunsch, zustand.dauerMin, zustand.reserveMin)
    : Math.round((tagManuell - tagesbeginn(start)) / 86400000);
  el.segmente.forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.tag) === tag)));
  el.tagInfo.textContent = tagManuell === null ? `${TAGE[tag]} automatisch gewählt.` : '';

  const ende = endzeitpunkt(start, wunsch, tag);
  const r = berechne({
    start,
    ende,
    dauerMin: zustand.dauerMin,
    reserveMin: zustand.reserveMin,
    maxStunden: zustand.maxStunden,
  });

  el.stunden.textContent = `${r.stunden} h`;
  const fertigTag = tagWort(r.fertig, start);

  let hinweis = '';
  if (r.status === 'nichtErreichbar') {
    el.fertig.textContent = `Frühestens fertig ${fertigTag} um ${uhrzeit(r.fertig)}`;
    hinweis = `${wunsch} ist ${tagWort(ende, start)} nicht zu schaffen. Sofort starten oder einen späteren Tag wählen.`;
  } else {
    const vor = r.minutenVorWunsch;
    el.fertig.textContent = `Fertig ${fertigTag} um ${uhrzeit(r.fertig)}` + (vor > 0 && r.status !== 'ueberMax' ? `, ${minutenText(vor)} vor deiner Wunschzeit` : '');
    if (r.status === 'sofort') hinweis = 'Ohne Verzögerung sofort starten.';
    if (r.status === 'ueberMax') hinweis = `Mehr als ${zustand.maxStunden} h geht nicht. Die Wäsche ist dann ${minutenText(vor)} zu früh fertig.`;
  }
  el.hinweis.hidden = !hinweis;
  el.hinweis.textContent = hinweis;

  if (r.alternative) {
    const a = r.alternative;
    const nach = a.minutenNachWunsch;
    el.alternative.textContent = nach > 0
      ? `Mit ${a.stunden} h: fertig um ${uhrzeit(a.fertig)}, ${minutenText(nach)} zu spät.`
      : `Mit ${a.stunden} h: fertig um ${uhrzeit(a.fertig)}, aber mit weniger Reserve.`;
    el.alternative.hidden = false;
  } else {
    el.alternative.hidden = true;
  }

  letztesErgebnis = { r, start, dauerMin: zustand.dauerMin };
  renderChips();
}

// ---------- Kalendereintrag ----------

let letztesErgebnis = null;

const APP_VERSION = '5';

function googleZeit(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

let dateiUrl = null;

// Öffnet ein Auswahlfenster mit mehreren Wegen. iOS blockiert in Home-Bildschirm-Apps Kalenderdateien,
// die im Browser erzeugt werden; welcher Weg auf einem Gerät klappt, ist unterschiedlich.
function kalenderEintragOeffnen() {
  if (!letztesErgebnis) return;
  const { r, start, dauerMin } = letztesErgebnis;
  const titel = 'Wäsche fertig';
  const startText = r.stunden > 0
    ? `Startverzögerung ${r.stunden} h, eingestellt ${tagWort(start, new Date())} um ${uhrzeit(start)}.`
    : `Ohne Startverzögerung gestartet ${tagWort(start, new Date())} um ${uhrzeit(start)}.`;
  const beschreibung = `${startText} Programmdauer ${dauerText(dauerMin)}.`;
  const ics = kalenderEintrag({ fertig: r.fertig, titel, beschreibung });

  $('kalender-termin').textContent = `${titel}: ${tagWort(r.fertig, new Date())} um ${uhrzeit(r.fertig)}, mit Erinnerung`;
  $('kalender-info').textContent = '';

  // 1. Apple Kalender: echte Adresse derselben Seite, beantwortet vom Service Worker (text/calendar).
  $('weg-apple').href = `./termin.ics?d=${encodeURIComponent(ics)}`;

  // 2. Teilen-Menü mit der Datei (wenn das Gerät Dateien teilen kann).
  const datei = new File([ics], 'waesche-fertig.ics', { type: 'text/calendar' });
  const teilen = $('weg-teilen');
  teilen.hidden = !(navigator.canShare && navigator.canShare({ files: [datei] }));
  teilen.onclick = () => {
    navigator.share({ files: [datei], title: titel }).catch((e) => {
      if (e.name !== 'AbortError') $('kalender-info').textContent = 'Teilen hat nicht geklappt.';
    });
  };

  // 3. Google Kalender im Browser.
  const ende = new Date(r.fertig.getTime() + 15 * 60000);
  $('weg-google').href = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + `&text=${encodeURIComponent(titel)}&dates=${googleZeit(r.fertig)}/${googleZeit(ende)}`
    + `&details=${encodeURIComponent(beschreibung)}`;

  // 4. Datei herunterladen (Computer, Android).
  if (dateiUrl) URL.revokeObjectURL(dateiUrl);
  dateiUrl = URL.createObjectURL(datei);
  $('weg-datei').href = dateiUrl;
  $('weg-datei').hidden = istIOS;

  if (!navigator.serviceWorker?.controller) {
    $('kalender-info').textContent = 'Hinweis: Die App ist noch nicht vollständig geladen. Falls „Apple Kalender“ nicht reagiert, schließe die App ganz und öffne sie neu.';
  }
  $('kalender-dialog').showModal();
}

$('kalender').addEventListener('click', kalenderEintragOeffnen);
$('version').textContent = `Version ${APP_VERSION}`;

// ---------- Programme (Schnellwahl) ----------

function renderChips() {
  el.chips.replaceChildren();
  if (!zustand.programme.length) {
    const p = document.createElement('span');
    p.className = 'leer';
    p.textContent = 'Keine Programme gespeichert.';
    el.chips.append(p);
    return;
  }
  for (const prog of zustand.programme) {
    const b = document.createElement('button');
    b.type = 'button';
    const name = prog.name.trim() || 'Ohne Namen';
    b.textContent = name === dauerText(prog.dauerMin) || /^\d+\s*h$/.test(name) ? name : `${name} · ${dauerText(prog.dauerMin)}`;
    b.setAttribute('aria-pressed', String(prog.dauerMin === zustand.dauerMin));
    b.addEventListener('click', () => {
      setzeDauer(prog.dauerMin);
      speichern();
      aktualisieren();
    });
    el.chips.append(b);
  }
}

function setzeDauer(min) {
  zustand.dauerMin = min;
  el.dauerH.value = Math.floor(min / 60);
  el.dauerM.value = min % 60;
}

function renderListe(fokusId) {
  el.liste.replaceChildren();
  zustand.programme.forEach((prog, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <input type="text" class="name" aria-label="Name" enterkeyhint="done">
      <span class="zeit">
        <input type="number" class="h" inputmode="numeric" min="0" max="12" aria-label="Stunden"> h
        <input type="number" class="m" inputmode="numeric" min="0" max="59" aria-label="Minuten"> min
      </span>
      <span class="aktionen">
        <button type="button" class="hoch" aria-label="Nach oben">↑</button>
        <button type="button" class="runter" aria-label="Nach unten">↓</button>
      </span>
      <button type="button" class="loeschen" aria-label="Löschen">✕</button>`;
    const name = li.querySelector('.name');
    const h = li.querySelector('.h');
    const m = li.querySelector('.m');
    name.value = prog.name;
    h.value = Math.floor(prog.dauerMin / 60);
    m.value = prog.dauerMin % 60;

    name.addEventListener('input', () => { prog.name = name.value; speichern(); renderChips(); });
    const zeitGeaendert = (e) => {
      prog.dauerMin = dauerAusFeldern(h, m, e.type === 'change');
      speichern();
      renderChips();
    };
    for (const f of [h, m]) {
      f.addEventListener('input', zeitGeaendert);
      f.addEventListener('change', zeitGeaendert);
    }

    const hoch = li.querySelector('.hoch');
    const runter = li.querySelector('.runter');
    hoch.disabled = i === 0;
    runter.disabled = i === zustand.programme.length - 1;
    hoch.addEventListener('click', () => verschieben(i, -1));
    runter.addEventListener('click', () => verschieben(i, 1));

    const loeschen = li.querySelector('.loeschen');
    let timer;
    loeschen.addEventListener('click', () => {
      if (loeschen.classList.contains('bestaetigen')) {
        clearTimeout(timer);
        zustand.programme.splice(i, 1);
        speichern();
        renderListe();
        aktualisieren();
        return;
      }
      loeschen.classList.add('bestaetigen');
      loeschen.textContent = 'Löschen?';
      timer = setTimeout(() => {
        loeschen.classList.remove('bestaetigen');
        loeschen.textContent = '✕';
      }, 3000);
    });

    el.liste.append(li);
    if (prog.id === fokusId) {
      name.focus();
      name.select();
    }
  });
}

function verschieben(i, richtung) {
  const j = i + richtung;
  if (j < 0 || j >= zustand.programme.length) return;
  const liste = zustand.programme;
  [liste[i], liste[j]] = [liste[j], liste[i]];
  speichern();
  renderListe();
  renderChips();
}

$('programme-bearbeiten').addEventListener('click', () => {
  renderListe();
  el.dialog.showModal();
});

$('programm-neu').addEventListener('click', () => {
  const prog = { id: neueId(), name: 'Neues Programm', dauerMin: zustand.dauerMin };
  zustand.programme.push(prog);
  speichern();
  renderListe(prog.id);
  renderChips();
});

el.dialog.addEventListener('close', aktualisieren);

// ---------- Eingaben ----------

el.endzeit.addEventListener('input', () => {
  if (!el.endzeit.value) return;
  zustand.endzeit = el.endzeit.value;
  tagManuell = null;
  speichern();
  aktualisieren();
});

el.segmente.forEach((b) => b.addEventListener('click', () => {
  const start = tagesbeginn(startzeitpunkt());
  tagManuell = new Date(start.getFullYear(), start.getMonth(), start.getDate() + Number(b.dataset.tag));
  aktualisieren();
}));

const dauerGeaendert = (e) => {
  zustand.dauerMin = dauerAusFeldern(el.dauerH, el.dauerM, e.type === 'change');
  speichern();
  aktualisieren();
};
for (const f of [el.dauerH, el.dauerM]) {
  f.addEventListener('input', dauerGeaendert);
  f.addEventListener('change', dauerGeaendert);
}

el.startzeit.addEventListener('input', () => {
  if (!el.startzeit.value) return;
  startLive = false;
  aktualisieren();
});
el.jetzt.addEventListener('click', () => {
  startLive = true;
  aktualisieren();
});

el.reserve.addEventListener('input', () => {
  zustand.reserveMin = zahl(el.reserve, 0, 120, 10);
  speichern();
  aktualisieren();
});
el.max.addEventListener('input', () => {
  zustand.maxStunden = zahl(el.max, 1, 99, 23);
  speichern();
  aktualisieren();
});

// ---------- Hinweis zum Installieren (nur iPhone/iPad in Safari) ----------

const istIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const istInstalliert = window.navigator.standalone === true
  || window.matchMedia('(display-mode: standalone)').matches;
if (istIOS && !istInstalliert && !zustand.installHinweisAus) $('installieren').hidden = false;
$('installieren-zu').addEventListener('click', () => {
  zustand.installHinweisAus = true;
  speichern();
  $('installieren').hidden = true;
});

// ---------- Start ----------

el.endzeit.value = zustand.endzeit;
el.reserve.value = zustand.reserveMin;
el.max.value = zustand.maxStunden;
setzeDauer(zustand.dauerMin);
aktualisieren();

setInterval(() => { if (startLive) aktualisieren(); }, 15000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') aktualisieren();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Begrenzte Werte beim Verlassen des Feldes zurückschreiben, damit Anzeige und Rechnung übereinstimmen.
el.reserve.addEventListener('change', () => { el.reserve.value = zustand.reserveMin; });
el.max.addEventListener('change', () => { el.max.value = zustand.maxStunden; });
