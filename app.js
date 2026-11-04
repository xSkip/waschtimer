import { berechne, autoTag, endzeitpunkt } from './calc.js';

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
  maxStunden: 24,
  installHinweisAus: false,
};

function laden() {
  try {
    const roh = localStorage.getItem(SPEICHER_KEY);
    if (!roh) return structuredClone(STANDARD);
    const daten = JSON.parse(roh);
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
let tagManuell = null; // null = automatisch

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
  const tag = tagManuell ?? autoTag(start, wunsch, zustand.dauerMin, zustand.reserveMin);
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
    el.fertig.textContent = `Fertig ${fertigTag} um ${uhrzeit(r.fertig)}` + (vor > 0 && r.status !== 'ueberMax' ? `,${minutenText(vor)} vor deiner Wunschzeit` : '');
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

  renderChips();
}

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
    const zeitGeaendert = () => {
      prog.dauerMin = zahl(h, 0, 12, 0) * 60 + zahl(m, 0, 59, 0);
      speichern();
      renderChips();
    };
    h.addEventListener('input', zeitGeaendert);
    m.addEventListener('input', zeitGeaendert);

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
  tagManuell = Number(b.dataset.tag);
  aktualisieren();
}));

const dauerGeaendert = () => {
  zustand.dauerMin = zahl(el.dauerH, 0, 12, 0) * 60 + zahl(el.dauerM, 0, 59, 0);
  speichern();
  aktualisieren();
};
el.dauerH.addEventListener('input', dauerGeaendert);
el.dauerM.addEventListener('input', dauerGeaendert);

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
  zustand.maxStunden = zahl(el.max, 1, 99, 24);
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
