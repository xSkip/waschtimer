# WaschTimer

Kleine Web-App fürs iPhone: Sie rechnet aus Startzeit, Programmdauer und gewünschter Endzeit aus,
wie viele Stunden Startverzögerung man an der Waschmaschine einstellen muss.

## Rechnung

```
Verzögerung = abrunden((Endzeit − Startzeit − Dauer − Reserve) / 1 h)
Fertig      = Startzeit + Verzögerung + Dauer
```

- Es wird immer **abgerundet**, die Wäsche ist also nie zu spät fertig.
- Die **Reserve** (Standard 10 Min.) fängt Programme ab, die etwas länger laufen als angezeigt.
- Die **maximale Verzögerung** (Standard 24 h) ist einstellbar.
- Gerechnet wird mit echten Zeitpunkten, die Zeitumstellung stimmt also automatisch.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | Oberfläche, Programmverwaltung, Einstellungen |
| `calc.js` | Rechenlogik (ohne Abhängigkeiten, getestet) |
| `manifest.webmanifest`, `icons/` | Name und Symbol am Home-Bildschirm |
| `sw.js` | Service Worker, damit die App offline startet |

## Tests

```
npm test
```

## Veröffentlichen (GitHub Pages)

Repository → **Settings → Pages** → Source „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
Danach ist die App unter `https://xskip.github.io/waschtimer/` erreichbar.

Nach Änderungen an den Dateien in `sw.js` die `VERSION` erhöhen, damit das iPhone das Update lädt.

## Am iPhone installieren

1. Link in **Safari** öffnen.
2. **Teilen** tippen.
3. **„Zum Home-Bildschirm“** wählen und **„Hinzufügen“** tippen.
