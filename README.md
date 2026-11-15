<p align="center">
  <a href="https://github.com/Maxichen/Тишина bot">
    <img src="./docs/assets/readme-hero.jpg" alt="Тишина bot Hero" width="520" />
  </a>
</p>

# **🥀 Т И Ш И Н А**

### *A quiet voice in a noisy world.*

> «Иногда тишина говорит больше, чем тысяча слов.»  
> Manchmal sagt die Stille mehr als tausend Worte.

**Тишина** ist eine ruhige, geheimnisvolle und elegante WhatsApp-Persönlichkeit. Regen, Winternächte, Erinnerungen und leise Hoffnung prägen den Ton — ohne grelle Farben, überladene Emojis oder künstliche Dauertraurigkeit.

**Farbwelt:** `#080B12` Midnight Black · `#0D1420` Deep Night Blue · `#151C29` Dark Slate · `#526579` Steel Blue · `#A8B8C8` Ice Blue · `#E5E9EF` Soft White. Weinrot und verblasstes Rosenrot bleiben dezente Akzente.

**Stimme:** ruhig, verständnisvoll und klar. Poetische Formulierungen sind Akzente, keine Pflicht; technische Antworten bleiben präzise und übersichtlich.

## Optionale KI und KI-Nachrichtenlabel

Der produktive Bot verwendet weiterhin `@neelegirly/baileys` `2.2.31` über `@neelegirly/wa-api` `1.8.15`. Zusätzlich ist `@itsliaaa/baileys` `0.5.6` installiert; es ersetzt den produktiven Transport nicht. Der separate Test unten nutzt ausschließlich diesen zweiten Fork. In seiner Laufzeit wird `ai: true` im Nachrichteninhalt verarbeitet und für private PN-/LID-Chats als Bot-Markierung übertragen; Gruppen werden nicht unterstützt. Eine sichtbare Anzeige wie `KI ◆` hängt vom WhatsApp-Client ab und muss auf einem zweiten Empfängerkonto geprüft werden.

Тишина setzt für **normale statische Nachrichten** ausdrücklich `ai: false`. Eine optionale OpenAI-kompatible KI-Antwortfunktion ist standardmäßig deaktiviert und antwortet nur nach `,ai <Frage>`. Die zentrale Sendefunktion nimmt Text oder ein Nachrichtenobjekt (z. B. Bild mit Caption) und übergibt `aiGenerated: true` als `ai: true`; die aktuelle KI-Antwortfunktion erzeugt derzeit Text.

Lege die Anbieterwerte nur lokal in `.env` ab. `AI_PROVIDER`, `AI_API_KEY` und `AI_MODEL` müssen gesetzt sein; `AI_BASE_URL` kann auf einen kompatiblen Endpoint zeigen. Ein Owner aktiviert die Funktion mit `,ai on`; `,ai off` schaltet sie wieder aus. Das Tageslimit gilt pro Nutzer, Anfragen werden nicht als Gesprächsverlauf gespeichert und der API-Aufruf hat ein 20-Sekunden-Timeout.

```js
await sendТишина(session, chatId, generatedAnswer, { aiGenerated: true })
```

Nur die tatsächlich vom Anbieter erzeugte Antwort wird mit dem vorhandenen `aiGenerated`-Opt-in markiert. Statische Bot-Texte bleiben unmarkiert. Ob und wie WhatsApp das Label anzeigt, hängt außerdem vom Client und der verwendeten Baileys-Version ab.

### Isolierter Live-Test mit dem zweiten Fork

Der Test verwendet ein eigenes Senderkonto und speichert dessen Zugangsdaten ausschließlich unter `runtime/ai-label-test-auth/`. **Scanne den QR-Code nicht mit dem produktiven Bot-Konto**: dieselbe WhatsApp-Identität sollte nicht über zwei Socket-Verbindungen laufen. Die gespeicherten Test-Zugangsdaten werden von Git ignoriert.

Für diesen Protokolltest ist kein KI-Anbieter und kein API-Schlüssel erforderlich. Starte den Test ausdrücklich:

```bash
npm run ai-label:test
```

Bestätige zunächst das separate Senderkonto, scanne den angezeigten QR-Code und gib eine private Empfänger-Nummer im internationalen Format oder eine private PN-/LID-Adresse ein. Nach Eingabe von `SEND` versucht das Skript drei klar markierte, manuell erstellte Testnachrichten: (1) `ai: true`, (2) `ai: true` plus `secureMetaServiceLabel: true` und (3) `ai: true` plus manuell ergänztem `bot`-Node über `relayMessage`. Die Nachrichten sind keine KI-generierten Antworten. Im installierten Fork löst `secureMetaServiceLabel` zusätzlich dessen `addBizAttributes`-Pfad aus; daraus folgt keine Garantie, dass WhatsApp das Label anzeigt. Prüfe auf dem Empfängerkonto, welche Variante ein Label zeigt. Die lokale Installation und Tests können die WhatsApp-Anzeige nicht bestätigen.

## Website und öffentlicher Status

`server.js` stellt die Website aus `public/` und eine öffentliche, nur lesbare Status-API bereit. Standardmäßig ist sie lokal unter [http://localhost:7777](http://localhost:7777) erreichbar. Host und Port lassen sich über `HOST` und `PORT` konfigurieren. Auf dem Windows-Server mit Maxi-Web muss `HOST=0.0.0.0` gesetzt sein, damit sowohl `localhost:7777` als auch die weitergeleitete Serveradresse `10.0.5.112:7777` erreichbar sind. Port 7777 nur über die benötigte Netzwerk-/Firewall-Regel freigeben. Die Website zeigt WhatsApp nur bei einem frischen Bot-Heartbeat als online. Die Statusdatei `runtime/status.json` wird lokal geschrieben und ignoriert.

```bash
npm run website
npm run pm2:start
```

Die Vorlage `.env.example` enthält `HOST=localhost` und `PORT=7777`. Kopiere sie bei Bedarf nach `.env`, bevor du eigene lokale Einstellungen ergänzt. Unter `http://localhost:7777/health` lässt sich der Webserver prüfen; der Live-Status steht unter `http://localhost:7777/api/status`.

`npm run pm2:start` startet Bot und Website gemeinsam. Die Website bietet Startseite, Über Тишина, Commands, Status, Datenschutz und Impressum sowie eine responsive Menü-Demo mit Tastatur- und Swipe-Navigation. In der Demo lassen sich verfügbare Befehle als gestaltete Aktionskarten auswählen und mit dem aktiven Prefix kopieren. Das WhatsApp-Hauptmenü verwendet native Einzelauswahl-Kategorien plus Schnellzugriffe auf Hilfe, Status und Website; die Darstellung nativer WhatsApp-Buttons bleibt vom Client vorgegeben. Das Impressum und die Datenschutzhinweise enthalten bewusst Hinweise auf Angaben, die der Betreiber vor öffentlicher Bereitstellung selbst ergänzen und prüfen muss. Profil- und Business-Angaben sowie SVG-Markenbilder sind Vorlagen; WhatsApp-Profilfelder müssen manuell und nur über unterstützte offizielle Funktionen eingerichtet werden.

### Öffentliche Domain maxichen.de

Der Bot läuft auf Windows Server hinter der privaten Adresse `10.0.5.112`; der öffentliche Einstiegspunkt ist `193.111.249.190`. Beim DNS-Anbieter muss der A-Record `maxichen.de` auf `193.111.249.190` zeigen. Der zuletzt geprüfte DNS-Eintrag zeigte noch auf `87.106.245.164` und muss daher beim DNS-Anbieter korrigiert werden. DNS-Änderungen werden nicht durch dieses Projekt ausgeführt.

Für Maxi-Web/Portweiterleitung muss die Website auf `HOST=0.0.0.0`, `PORT=7777` lauschen; PM2 setzt diese Werte ebenfalls. Der Webserver ist dann lokal über `http://localhost:7777/health` und im privaten Netz über `http://10.0.5.112:7777/health` prüfbar. Die Firewall soll Port 7777 nur für die erforderliche Maxi-Web-/Proxy-Quelle freigeben.

Damit `https://maxichen.de` ohne Portangabe funktioniert, muss zusätzlich ein Reverse Proxy auf dem öffentlichen Gateway Port 443 annehmen und an `http://10.0.5.112:7777` weiterleiten. Auf `193.111.249.190` antwortet derzeit Caddy auf HTTP; die TLS-Verbindung schlug beim letzten Test jedoch fehl. Die Vorlage `deploy/caddy/Caddyfile` konfiguriert Caddy als Reverse Proxy und lässt Caddy das TLS-Zertifikat verwalten. Nach der DNS-Änderung muss diese Konfiguration auf dem Gateway aktiviert bzw. in dessen bestehende Caddy-Konfiguration übernommen und neu geladen werden. Die Nginx-Alternative liegt unter `deploy/nginx/maxichen.de.conf`. DNS, Gateway-/Maxi-Web-Routing, Zertifikat und Firewall werden nicht automatisch durch dieses Projekt geändert.

Für lokale Entwicklung genügt weiterhin `HOST=localhost`, `PORT=7777` in `.env.example`; die Serverkonfiguration in `.env` und PM2 verwendet dagegen `0.0.0.0`, damit die private Weiterleitung den Dienst erreicht.

Die öffentlichen Profilgrafiken liegen als SVG unter `public/assets/` (Logo, Profilbild und Titelbild). Für WhatsApp können Name `Тишина 🥀`, Info `Иногда тишина говорит больше, чем тысяча слов. 🥀` und die Projektwebsite manuell eingetragen werden. Die Base setzt keine Profilfelder oder Business-Daten automatisch und erfindet keine Support-E-Mail-Adresse.

## Kurz erklärt

`Тишина bot` bzw. diese `ТишинаBase` ist eine **WhatsApp-only** Bot-Basis mit einer bewusst einfachen Struktur:
Der Kern lebt in **`Тишина.js`** und nicht verteilt über viele halbfertige Loader, Events und Demo-Ordner.

Das heißt in der Praxis:

- du findest die Hauptlogik schneller
- du verstehst den Nachrichtenfluss leichter
- du kannst Commands direkter anpassen
- du musst nicht erst eine Plugin-Architektur auseinandernehmen, um kleine Änderungen zu machen

## Warum diese Base?

`ТишинаBase` ist keine verstreute Plugin-Wüste, sondern eine bewusst zentral gehaltene WhatsApp-Basis.
Die Kernlogik lebt in **`Тишина.js`**. Genau das macht die Base leichter zu verstehen, schneller zu warten und einfacher auf GitHub sauber zu halten.

Das Ziel ist simpel:

- **WhatsApp-only** statt Mischbetrieb mit Discord oder Fremd-Bridge-Logik
- **eine zentrale Runtime** statt zehn verstreuter Einstiegspunkte
- **moderne Maxichen-Pakete** statt halb-alter Legacy-Abhängigkeiten
- **direkt nutzbare Commands** für Alltag, Gruppen, Owner und Sessions

## So funktioniert die Base

Wenn du wissen willst, *wie es geht*, dann ist das hier der kurze Ablauf von oben nach unten:

1. **`Тишина.js` lädt die Konfiguration**  
  Beim Start werden `.env`, das lokale und ignorierte `owner.js` sowie die internen Runtime-Werte geladen.

2. **Die lokale Datenbasis wird vorbereitet**  
  Einstellungen wie Prefix, Nutzerdaten, Welcome-Status und Statistikwerte werden aus der Datenbank bzw. JSON-Struktur gelesen.

3. **Sessions werden hochgezogen**  
  Über `WA_API_BOOTSTRAP_SESSIONS` können Sessions automatisch gestartet werden. Alternativ geht das später auch per Chat-Command.

4. **Nachrichten werden normalisiert**  
  Eingehende WhatsApp-Nachrichten werden in eine Form gebracht, mit der Text, Medien, Buttons, Listen und Gruppenereignisse einheitlich verarbeitet werden können.

5. **Commands werden über Prefix + Alias erkannt**  
  Der Bot prüft den Prefix, ordnet Aliase zu und landet dann im passenden Case der Command-Logik.

6. **Antwort, Gruppenaktion oder Session-Aktion wird ausgeführt**  
  Je nach Command antwortet der Bot mit Text, sendet Medien, markiert Gruppenmitglieder, ändert Welcome-Einstellungen oder verwaltet Sessions.

Kurz: **Start → Config → Session → Nachricht → Command → Antwort**.

## Was du direkt bekommst

| Bereich | Inhalt |
| --- | --- |
| Runtime | zentrale Bot-Logik in `Тишина.js` |
| Sessions | Start, Pairing, Pause, Resume, Stop, Delete per Command |
| Gruppen | `tagall`, `groupinfo`, Welcome-/Goodbye-/Kick-Steuerung |
| Buttons | Benutzerbezogene Menüauswahl mit WhatsApp-Buttons und Text-Fallback |
| User | `register`, `me`, XP/Level-Basis |
| Owner | Sieben Rollen in `owner.js`; geschützte Owner-, Status- und Wartungsbefehle |
| Diagnose | `ping`, `uptime`, `stats`, `session-info` |
| Website | Express-Seiten, öffentliche Status-API und synchronisierte Commands |
| Betrieb | PM2-Ecosystem für Bot und Website mit Logs in `./logs` |
| Qualität | `smoke.test.js`, `node --check`, `.env.example`, `.gitignore` |

## Aktueller Stack

Diese Base ist auf den aktuellen WhatsApp-Flow mit dem **neelegirly**-Ökosystem ausgelegt:

- `@neelegirly/wa-api`
- `@neelegirly/baileys`
- `@neelegirly/libsignal`
- `@neelegirly/downloader`
- `lowdb`
- `dotenv`
- `chalk`
- `boxen`
- `pm2`
- `qrcode`
- `express`

## Schnellstart Schritt für Schritt

### 1. Abhängigkeiten installieren

```bash
npm install
```

### 2. `.env` vorbereiten

Nimm die Datei `.env.example` als Vorlage und passe die Werte an deine Umgebung an.

Wichtige Umgebungsvariablen:

- `APP_NAME`
- `BOT_PREFIX`
- `WHATSAPP_PRINT_QR`
- `WA_API_BOOTSTRAP_SESSIONS`
- `WA_API_RETRY_LIMIT`
- `Тишина bot_DRY_RUN`
- `WELCOME_BANNER_URL` / `WELCOME_BANNER_PATH`
- `LEAVE_BANNER_URL` / `LEAVE_BANNER_PATH`
- `KICK_BANNER_URL` / `KICK_BANNER_PATH`

Die Discord-Platzhalter `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `WELCOME_CHANNEL_ID`, `LEAVE_CHANNEL_ID` und `KICK_LOG_CHANNEL_ID` sind in `.env.example` enthalten, damit die Datei kompatibel bleibt. Diese Base nutzt sie nicht, solange kein Discord-Client eingebaut wird.

### 3. Lokales Owner-System prüfen

`owner.js` enthält die sieben autorisierten Nummern und wird durch `.gitignore` lokal gehalten. `owner.example.js` dokumentiert die Struktur; beim Klonen kopierst du die Vorlage zu `owner.js` und trägst die sieben eigenen Nummern ein. Nummern werden als internationale Ziffernfolge gespeichert und beim Start validiert. Ohne gültige Owner-Konfiguration startet der Bot nicht mit offenen Adminrechten.

Die Rollen 2–7 erhalten die vorgesehenen Owner-Funktionen; `restart` und `logs` sind dem Hauptinhaber vorbehalten. Owner-Prüfungen verwenden die WhatsApp-Absender-JID und erlauben nur passende Telefonnummern-JIDs. LIDs ohne verifizierbare Telefonnummer werden nicht als Owner akzeptiert. `,owner`, `,ownerlist`, `,botinfo`, `,botstatus`, `,maintenance`, `,logs` und `,restart` funktionieren unabhängig vom normalen Bot-Prefix. Vollständige Nummern werden nicht in Bot-Nachrichten angezeigt; `logs` ist auf private Chats beschränkt und maskiert Telefonnummern.

### 4. Erstmal sicher testen

Wenn du nur sehen willst, ob alles sauber startet, nutze den Dry-Run:

```bash
Тишина bot_DRY_RUN=true npm start
```

Dann wird **keine echte WhatsApp-Session** geöffnet, aber du siehst, ob Config und Runtime korrekt laden.

### 5. Normal starten

```bash
npm start
```

Wenn `WHATSAPP_PRINT_QR=true` gesetzt ist, rendert der wa-api-QR-Callback den gelieferten QR direkt im Terminal. Während Тишина diesen Callback verwendet, wird die eingebaute Ausgabe von Baileys unterdrückt; daher rendert Тишина den Code selbst. Bei ausbleibendem QR meldet Тишина nach 15 Sekunden den tatsächlichen wa-api-Verbindungsstatus. Für den optionalen Versand in Chats nutzt Тишина denselben Callback. Startest du später per Chat eine weitere Session mit `!session-start <id>`, sendet Тишина den QR-Code zusätzlich in der dunklen Тишина-Farbwelt in den Chat, sofern bereits eine verbundene Session zum Senden verfügbar ist.

### 6. Mit PM2 starten

```bash
npm run pm2:start
npm run pm2:restart
npm run pm2:stop
```

Die PM2-App heißt `ТишинаBaseV3`, nutzt `./Тишина.js` und schreibt Ausgaben nach `./logs`.

## Wenn du etwas ändern willst

Die Base ist extra so gebaut, dass du nicht lange suchen musst:

- **neuer Command** → meistens direkt in `Тишина.js`
- **Owner-/Branding-Werte** → `owner.json`
- **Startverhalten / Prefix / Sessions** → `.env`
- **kleine Helper** → `lib/`

Wenn du zum Beispiel einen neuen simplen Command willst, ist der typische Weg:

1. Alias ergänzen
2. Command in die Menü-/Help-Listen aufnehmen
3. den passenden `case` in `Тишина.js` ergänzen
4. testen mit `node --check Тишина.js` und `node --test smoke.test.js`

Dadurch bleibt die Base verständlich, auch wenn du später mehr Features einbaust.

## Commands im Alltag

### Allgemein

- `!menu` – Menü
- `!help` – ausführliche Hilfe
- `!ping` – schneller Lebenszeichen-Check
- `!uptime` – Laufzeit, Bootzeit, Counter
- `!about` – Stack- und Projektinfo
- `!rules` – Regeln anzeigen
- `!support` – Supportinfos anzeigen
- `!plugins` – eingebaute Features
- `!stats` – Runtime-Zahlen
- `!prefix` – aktiven Prefix anzeigen
- `!status` / `!version` / `!website` – öffentliche Informationen
- `!quote` / `!random` / `!fact` – kleine Gedanken und Fakten
- `,ai <Frage>` – optionale KI-Antwort nach Owner-Aktivierung anzeigen

### Profil & Owner

- `!register <Name>` – registriert den Nutzer
- `!me` – zeigt dein Profil
- `!owner` – Owner-Hilfe
- `,ownerlist` – autorisierte Owner und Rollen (ohne Nummern)
- `,botinfo` / `,botstatus` – geschützte Bot-Informationen und Status
- `,maintenance on|off|status` – Wartungsmodus für Nicht-Owner steuern
- `,logs` – letzte Fehlerprotokolle, nur Hauptinhaber im Privat-Chat
- `,restart` – PM2-Neustart, nur Hauptinhaber im Privat-Chat
- `,ai on|off|status` – optionale KI konfigurieren und steuern
- `!ownercontact` – Owner-Kontakt anzeigen
- `!setprefix <neu>` – Prefix ändern *(Owner-only)*

### Gruppen

- `!tagall [Nachricht]` – erwähnt alle Gruppenmitglieder in einer Nachricht (Owner oder Gruppen-Admin, mit 60 Sekunden Gruppenschutzpause)
- `!groupinfo` – zeigt Gruppeninfos und wenn möglich Gruppenbild
- `!addmeta` / `!kickmeta` – Meta AI hinzufügen oder entfernen (Owner oder Gruppen-Admin; der Bot braucht Adminrechte)
- `!welcome on|off|status|preview` – Welcome-System steuern
- `!welcome set <Text>` – eigenen Welcome-Text setzen
- `!welcome setbye <Text>` – Goodbye-Text setzen
- `!welcome setkick <Text>` – Kick-Text setzen
- `!welcome reset` – Welcome-, Goodbye- und Kick-Texte zurücksetzen

`@user` in Welcome-/Goodbye-/Kick-Vorlagen wird beim Senden durch eine echte WhatsApp-Erwähnung des betroffenen Mitglieds ersetzt. Bei unbekannter Teilnehmer-ID wird `Nutzer` statt eines wirkungslosen `@user`-Platzhalters angezeigt.

Der Befehl `tagall [Nachricht]` lädt aktuelle Gruppenmetadaten und sendet genau eine Nachricht. Für echte WhatsApp-Markierungen enthält deren Text die Mention-Tokens; die passenden PN-/LID-JIDs werden zusätzlich als `mentionedJid` übertragen. WhatsApp kann die Tokens beim Empfänger als Kontaktnamen darstellen; im Terminal-Log sind weiterhin Kennungen sichtbar. Ein Text nach dem Befehl wird einmal als Ankündigung eingesetzt; ohne Text erscheint eine Standardnachricht. Ungültige IDs werden ausgelassen und protokolliert. Nur Owner und Gruppen-Admins können den Befehl ausführen; pro Gruppe gilt eine Schutzpause von 60 Sekunden.

### Multi-Session

- `!sessions`
- `!session-info`
- `!session-start Support` – erstellt `Тишина_Support` per QR
- `!session-pair Support <nummer>` – unabhängige Support-Session per Pairing
- `!session-info Support` – Status einer bestimmten Session (Owner)
- `!session-pause Support`
- `!session-resume Support`
- `!session-stop Support`
- `!session-delete Support`

Jede Session-ID wird auf `Тишина_<Name>` normalisiert; `main-session` ist ein Migrationsalias für `Тишина_Maxichen`. Namen mit Pfadangaben, ungültigen Zeichen oder doppelten Einträgen werden abgewiesen. Beim Start migriert Тишина die alte Hauptsession-Registry und sichert Registry-Originale unter `runtime/session-backups/registries/`. Vorhandene `main-session`-Credentials werden bei freiem Ziel verifiziert nach `Neelegirly_Sessions/Тишина_Maxichen_neelegirly` kopiert; das Original wird anschließend in das von Git ignorierte `runtime/session-backups/credentials/` verschoben. Wenn das Ziel oder mehrere alte Credential-Verzeichnisse existieren, stoppt die Migration mit einem Konflikthinweis, ohne bestehende Credentials zu überschreiben.

Die Hauptsession kann nicht mit dem normalen Löschbefehl entfernt werden. Nur der Hauptinhaber kann sie mit `!session-delete Maxichen CONFIRM` und ausdrücklicher Bestätigung löschen.

> Der Prefix ist standardmäßig `!`, kann aber per Config oder mit `setprefix` geändert werden.

## Was in dieser Version modernisiert wurde

- Einstieg von **`MainТишина.js`** auf **`Тишина.js`** umgestellt
- Hilfetexte und Menüs an den neuen Einstieg angepasst
- neue eingebaute Commands: **`uptime`**, **`ownercontact`**, **`prefix`**, **`setprefix`**, **`groupinfo`**, **`rules`**, **`support`**
- Welcome-System erweitert: zufällige Join-/Leave-/Kick-Sprüche, Banner aus URL oder lokaler Datei, Kick-Moderator aus WhatsApp-Stubs wenn verfügbar
- Single-Select-Menü mit nativen WhatsApp-Listen, individuellen Benutzersitzungen und Ablaufzeit
- Тишина-Branding für Menü, Statusmeldungen, Gruppenereignisse, QR-Codes und Terminalausgaben
- QR-Flow erweitert: neue QR-Codes werden als PNG in den Тишина-Farben in den Owner- oder Anfrage-Chat gesendet, wenn eine aktive Sendesession vorhanden ist
- `sendTextMessage` wurde durch `sendТишина` ersetzt
- PM2-Konfiguration für `ТишинаBaseV3` ergänzt
- zentrale WhatsApp-Architektur beibehalten statt neue Extra-Ordner einzuführen
- Tests und Scripts auf den neuen Einstieg synchronisiert

Kurz gesagt: weniger Chaos, mehr nutzbare Base. Der Bot hat jetzt weniger „wo war das nochmal?“-Energie. 😄

## Projektstruktur

```text
ТишинаBase/
├── Тишина.js
├── server.js
├── public/
│   ├── index.html
│   ├── script.js
│   ├── style.css
│   ├── commands.json
│   ├── pages/
│   └── assets/
├── package.json
├── ecosystem.config.js
├── smoke.test.js
├── owner.json
├── owner.example.js
├── owner.js                 # lokal, in .gitignore
├── .env.example
├── .gitignore
├── runtime/status.json     # zur Laufzeit, ignoriert
├── logs/
├── lib/
└── docs/assets/
```

## Wo liegt was?

- `Тишина.js` → zentrale Runtime, Commands, Events, Session-Handling
- `server.js` → Express-Website und öffentliche, datensparsame API
- `public/` → Website, SVG-Markenbilder und öffentliche Commands-Metadaten
- `lib/` → kleine Helfer und Kompatibilitätsfunktionen
- `owner.js` → private Owner-Nummern und Rollen; niemals committen
- `owner.example.js` → Vorlage ohne echte Nummern
- `owner.json` → öffentliche Branding-Informationen
- `.env.example` → Startkonfiguration
- `ecosystem.config.js` → PM2-App `ТишинаBaseV3` mit Logdateien in `./logs`
- `smoke.test.js` → schneller Syntax-/README-/Package-Check

## Wie du die wichtigsten Sachen benutzt

### Prefix ändern

Wenn du den Prefix dauerhaft anders haben willst, hast du zwei Wege:

- direkt über `BOT_PREFIX` in der `.env`
- oder live per Chat über `setprefix`, wenn du die nötigen Rechte hast

### Neue Session starten

Für neue Sessions kannst du entweder Bootstrapping über die `.env` nutzen oder direkt im Chat mit den Session-Commands arbeiten.
Das ist praktisch, wenn du mehr als eine Nummer oder mehr als einen Einsatzzweck parallel brauchst.

Wenn du `!session-start <sessionId>` aus einem WhatsApp-Chat heraus nutzt, merkt sich Тишина den Chat kurzzeitig als QR-Ziel. Sobald die wa-api den QR-Code liefert, wird daraus ein QR-Bild in der Тишина-Farbwelt gebaut und direkt in diesen Chat geschickt. Falls kein Anfrage-Chat existiert, versucht die Base den QR an die Owner-Nummern zu senden. Beim allerersten Login gibt es naturgemäß noch keine verbundene Sendesession; dann bleibt der Terminal-QR der sichere Fallback.

### Welcome-System nutzen

Das Welcome-System reagiert auf Gruppenereignisse von WhatsApp.
Du kannst es aktivieren, deaktivieren, den Status prüfen und eigene Texte setzen. Join/Add wird als Welcome behandelt, Leave bekommt eigene zufällige Texte und Kick nutzt eine eigene Nachricht. Wenn WhatsApp den Ausführer im Gruppen-Stub mitliefert, wird der Moderator erwähnt; einen echten Audit-Log-Grund liefert WhatsApp nicht mit.

Banner funktionieren über `WELCOME_BANNER_URL`, `LEAVE_BANNER_URL`, `KICK_BANNER_URL` oder die passenden `*_BANNER_PATH`-Werte. Wenn nichts gesetzt ist, versucht die Base das lokale Hero-Bild aus `docs/assets/readme-hero.jpg`; danach fällt sie auf das Gruppenbild und zuletzt auf reinen Text zurück.

### Gruppen verwalten

Mit `tagall` und `groupinfo` hast du direkt zwei nützliche Gruppenwerkzeuge eingebaut, ohne erst weitere Dateien oder Plugins anlegen zu müssen.

## Entwicklung & Checks

Vor einem Push sollten mindestens diese Checks grün sein:

- Syntaxprüfung für `Тишина.js`
- Smoke-Tests über `smoke.test.js`
- optionaler Dry-Run mit `Тишина bot_DRY_RUN=true`

## Troubleshooting

### QR wird nicht angezeigt

Prüfe `WHATSAPP_PRINT_QR` in der `.env` und ob die Session sauber neu gestartet wurde.
Für QR-Versand in den Chat muss mindestens eine andere WhatsApp-Session bereits verbunden sein, sonst kann der Bot noch keine Nachricht senden.

### Pairing klappt nicht

Kontrolliere die übergebene Nummer im internationalen Format und ob die Session-ID korrekt ist.

### Welcome reagiert nicht

Das Welcome-System nutzt WhatsApp-Gruppenereignisse. Teste in einer echten Gruppe und prüfe, ob `!welcome status` aktiviert ist.

### Prefix reagiert nicht

Mit `!prefix` siehst du den aktiven Wert. Wenn du ihn geändert hast, teste direkt mit dem neuen Prefix weiter.

## Sicherheit & Hinweise

- Committe keine echten Session-Daten.
- Lass `.env`, Datenbanken und Session-Artefakte im Ignore.
- Wenn du öffentlich pushst, prüfe vorher Owner-Nummern und Branding.
- KI-Schlüssel und Owner-Telefonnummern gehören ausschließlich in lokale, ignorierte Dateien. Die Website darf erst nach Prüfung der Anbieterkennzeichnung und der geltenden Datenschutzpflichten öffentlich betrieben werden.

## Credits

**🥀 By Maxichen**

*«Иногда тишина говорит больше, чем тысяча слов.»*

Тишина — ein technisch moderner Bot mit einer ruhigen, wiedererkennbaren Identität.
