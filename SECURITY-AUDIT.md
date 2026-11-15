# Тишина — Session- und Dependency-Audit

Stand der nachfolgenden ursprünglichen Detailaufnahme: 14.11.2026 vor dem späteren `npm update`. Vor einem Deployment erneut `npm audit` ausführen.

## Aktueller Audit nach `npm update`

Nach dem vom Betreiber ausgeführten `npm update` meldet `npm audit` 22 verwundbare Paketeinträge: 1 kritisch, 11 hoch, 4 moderat und 6 niedrig. Die frühere 33-Einträge-Tabelle unten ist eine historische Aufnahme vor diesem Update und nicht mehr die aktuelle Zählung. Aktuell verbleiben:

| Severity | Paket und installierte Version | Pfad | Fix-Angabe von npm |
|---|---|---|---|
| Kritisch | `protobufjs` 7.5.0 | `@neelegirly/libsignal` → `protobufjs` sowie `@neelegirly/baileys` → `protobufjs` | Kein automatischer Fix gemeldet. |
| Hoch | `@neelegirly/baileys` 2.2.31 | direkte Abhängigkeit, von `@neelegirly/wa-api` 1.8.15 gepinnt | Kein automatischer Fix; `@neelegirly/libsignal`, `music-metadata` und `uuid` bleiben verwundbar. |
| Hoch | `@neelegirly/libsignal` 1.0.33 | direkte Abhängigkeit und Baileys | Kein automatischer Fix; installiert weiterhin `protobufjs` 7.5.0. |
| Hoch | `@neelegirly/wa-api` 1.8.15 | direkte Abhängigkeit | Kein automatischer Fix; verwendet den Baileys-Fork. |
| Hoch | `@pm2/agent` 2.1.1 | PM2 → Proxy-Agent | Nur Gesamtupdate auf PM2 7.1.2 vorgeschlagen (Major). |
| Hoch | `basic-ftp` 5.3.1 | PM2-Proxy → `pac-proxy-agent` → `get-uri` | Nur Gesamtupdate auf PM2 7.1.2 vorgeschlagen (Major). |
| Hoch | `get-uri` 6.0.5 | PM2-Proxy → `pac-proxy-agent` → `get-uri` | Nur Gesamtupdate auf PM2 7.1.2 vorgeschlagen (Major). |
| Hoch | `js-yaml` 4.1.1 | PM2 → `js-yaml` | Nur Gesamtupdate auf PM2 7.1.2 vorgeschlagen (Major). |
| Hoch | `music-metadata` 7.14.0 | Baileys → `music-metadata` | Kein automatischer Fix gemeldet. |
| Hoch | `pac-proxy-agent` 7.2.0 | PM2 → `proxy-agent` → `pac-proxy-agent` | Nur Gesamtupdate auf PM2 7.1.2 vorgeschlagen (Major). |
| Hoch | `pm2` 6.0.14 | direkte Abhängigkeit | Nur PM2 7.1.2 vorgeschlagen (Major). |
| Hoch | `proxy-agent` 6.4.0 | PM2 → `@pm2/agent` → `proxy-agent` | Nur Gesamtupdate auf PM2 7.1.2 vorgeschlagen (Major). |
| Moderat | `file-type` 16.5.4 | Baileys → `music-metadata` → `file-type` | Kein automatischer Fix gemeldet. |
| Moderat | `minimatch` 10.2.6 | `nodemon` → `minimatch` | npm meldet Fix vorhanden. |
| Moderat | `nodemon` 3.1.14 | direkte Dev-Abhängigkeit → `minimatch` | npm meldet Fix vorhanden. |
| Moderat | `uuid` 9.0.1 | Baileys → `uuid` | Kein automatischer Fix gemeldet. |
| Niedrig | `@jest/core` 29.7.0 | `@neelegirly/wa-api` → Jest | Kein automatischer Fix gemeldet. |
| Niedrig | `create-jest` 29.7.0 | Jest-Toolchain | Kein automatischer Fix gemeldet. |
| Niedrig | `deepmerge` 4.3.1 | Jest-Toolchain | Kein automatischer Fix gemeldet. |
| Niedrig | `jest` 29.7.0 | `@neelegirly/wa-api` → Jest | Kein automatischer Fix gemeldet. |
| Niedrig | `jest-cli` 29.7.0 | Jest-Toolchain | Kein automatischer Fix gemeldet. |
| Niedrig | `jest-config` 29.7.0 | Jest-Toolchain | Kein automatischer Fix gemeldet. |

Der ehemals kritische `baileys`-Lockfile-Fund ist in der aktuellen Audit-Ausgabe nicht mehr enthalten. Die übrigen WhatsApp-Fork-Befunde bestehen fort; keine dieser Bibliotheken oder PM2 wurde in dieser Änderung aktualisiert.

## LRU-Cache-Startfehler

Der ursprüngliche Startfehler `TypeError: lru_cache_1.LRUCache is not a constructor` trat mit Baileys 2.2.18 und dessen inkompatibel aufgelöstem Cache auf. Der aktuelle Stack richtet `@neelegirly/wa-api` 1.8.15 und `@neelegirly/baileys` 2.2.31 aufeinander aus; Baileys lädt nun `lru-cache` 11.5.3 verschachtelt, während die direkte Root-Abhängigkeit 10.4.3 ist. Die Runtime-Auflösung sowie der Baileys-`MessageRetryManager`-Konstruktor wurden lokal geprüft.

## Session-Prüfung

Die installierte `@neelegirly/wa-api`-Version `1.8.4` verwendet im aktuellen Socket-Session-Manager:

`Neelegirly_Sessions/<Session-ID>_neelegirly`

Der Resolver prüft außerdem `sessions_neelegirly` und `wa_credentials` sowie die Endungen `_credentials_neelegirly` und `_credentials`. Die Anwendung ruft `setCredentialsDir` nicht auf; der Paketdefault bleibt deshalb aktiv. Die zusätzliche ältere `whatsapp/index.js`-Implementierung verwendet einen anderen Socket-Aufbau und ist nicht der von Тишина gestartete Session-Manager.

Bei dieser Prüfung waren die drei Credential-Wurzeln sowie `runtime/session-backups` nicht vorhanden. Die Datenbank enthält `Тишина_Maxichen` mit einem gespeicherten `starting`-Wert; das ist kein Nachweis einer WhatsApp-Verbindung. `startSessionByQr` und das `onConnecting`-Event speichern einen Zwischenstatus. Vorher konnte `buildSessionsText` diesen Datenbankwert auch dann anzeigen, wenn im aktuellen Prozess keine Session lief. Die Runtime setzt solche gespeicherten Statuswerte jetzt beim Prozessstart auf `offline`; tatsächliche Verbindungsereignisse aktualisieren sie wieder. Es wurden keine Credentials erstellt, gelesen, verschoben oder gelöscht. `Тишина_Support` ist nicht registriert.

## Ursprüngliche npm-Audit-Detailaufnahme (vor `npm update`)

`npm audit` meldete 33 verwundbare Paket-Einträge: 2 kritisch, 19 hoch, 5 moderat und 7 niedrig. Versionen und Installationspfade stammen aus `package-lock.json` und `npm explain`. „Fix vorhanden“ gibt ausschließlich die npm-Audit-Angabe wieder, nicht eine im Projekt getestete Version.

Ein unverändernder `npm audit fix --dry-run --json`-Versuch vor dem späteren Betreiber-Update brach wegen `EINVALIDPACKAGENAME` ab: npm beanstandete den Paketnamen `neelegirly/libsignal` in veralteten, als `extraneous` markierten Lockfile-Einträgen `node_modules/neelegirly/baileys` und `node_modules/neelegirly/libsignal`. `npm update` hat diese alten Lockfile-Funde entfernt; sie sind nicht Teil des aktuellen 22-Einträge-Audits oben.

| Severity | Paket (installierte Version) | Abhängigkeitspfad | Befund | Fix / Maßnahme |
|---|---|---|---|---|
| Kritisch | `baileys` 2.2.18 (Lockfile-only, `extraneous`) | Veralteter Lockfile-Eintrag `node_modules/neelegirly/baileys`; tatsächlicher Paketordner fehlt | Gefälschte Message-/History-Sync-Payloads können App-State beschädigen (`<6.7.22`). | npm meldet Fix vorhanden, aber dieser Eintrag ist kein bestätigter aktiver Codepfad. Lockfile in einer getrennten Kopie bereinigen und Audit wiederholen. |
| Kritisch | `protobufjs` 7.5.0, 7.5.6 | `@neelegirly/libsignal` und `@neelegirly/baileys` | Mehrere Code-Execution-, Prototype-Injection- und DoS-Befunde, unter anderem bis 7.6.4. | Kein Fix gemeldet. `@neelegirly/libsignal` pinnt 7.5.0; Upstream-Fork oder gezielter kompatibler Patch erforderlich. |
| Hoch | `@neelegirly/baileys` 2.2.18 | direkte Abhängigkeit und `@neelegirly/wa-api` | Verwundbare Abhängigkeiten `@neelegirly/libsignal`, `music-metadata`, `uuid`. | Kein automatischer Fix. Fork-Update und WhatsApp-Regressionsprüfung erforderlich. |
| Hoch | `@neelegirly/libsignal` 1.0.28 | direkte Abhängigkeit von Тишина/der Baileys-Fork | Zieht verwundbares `protobufjs` 7.5.0 ein. | Kein automatischer Fix. Maintainer-Fix oder kontrollierter Fork nötig. |
| Hoch | `@neelegirly/wa-api` 1.8.4 | direkte Abhängigkeit | Zieht verwundbare Baileys- und Jest-Abhängigkeiten ein. | Kein automatischer Fix. API-/Session-Kompatibilität vor Fork-Update prüfen. |
| Hoch | `@pm2/agent` 2.1.1 | `pm2` 6.0.14 → `@pm2/agent` → `proxy-agent` | Verwundbare Proxy-Abhängigkeit. | Audit schlägt PM2 7.1.2 vor (Major); nur in Testkopie validieren. |
| Hoch | `axios` 1.15.2 | `@neelegirly/baileys` → `axios` | Mehrere ReDoS-, DoS-, Prototype-Pollution- und Proxy-/Header-Leak-Befunde. | npm meldet Fix vorhanden; Zielversion und Fork-Verträglichkeit nicht verifiziert. |
| Hoch | `basic-ftp` 5.3.1 | `pm2` → `proxy-agent` → `pac-proxy-agent` → `get-uri` → `basic-ftp` | Parser-DoS und Prozessabsturz bei manipulierten FTP-Antworten/Eingaben. | Audit weist auf PM2 7.1.2 (Major); FTP-/PM2-Test erforderlich. |
| Hoch | `brace-expansion` 1.1.14, 5.0.5 | `glob`/`minimatch`; zusätzlich `nodemon` | Mehrere CPU-, Speicher- und Stack-DoS-Befunde. | npm meldet Fix vorhanden; beide installierten Kopien nach Lockfile-Update prüfen. |
| Hoch | `browserslist` 4.28.2 | Babel/`baseline-browser-mapping` | Unbegrenztes Speicherwachstum und Crash/Prototype-Schreibzugriff bei Stats-Eingaben. | npm meldet Fix vorhanden; Build-/Website-Tests ausführen. |
| Hoch | `follow-redirects` 1.16.0 | `@neelegirly/baileys` → `axios` → `follow-redirects` | Credential-Header können bei Redirects offengelegt werden. | npm meldet Fix vorhanden; Zielversion nicht aufgelöst. |
| Hoch | `form-data` 4.0.5 | `@neelegirly/baileys` → `axios` → `form-data` | CRLF-Injection über nicht maskierte Multipart-Namen. | npm meldet Fix vorhanden; Zielversion nicht aufgelöst. |
| Hoch | `get-uri` 6.0.5 | PM2-Proxy-Kette über `pac-proxy-agent` | Wird durch verwundbares `basic-ftp` beeinträchtigt. | Audit führt als Gesamtfix PM2 7.1.2 (Major) auf; Einzelpfad prüfen. |
| Hoch | `ip-address` 10.1.1 | `socks` → `socks-proxy-agent` | Mehrere SSRF-/Trust-Boundary-Bypässe und DoS durch fehlerhafte IP-/CIDR-Prüfung. | npm meldet Fix vorhanden; Proxy-Abhängigkeiten testen. |
| Hoch | `js-yaml` 3.14.2, 4.1.1 | Istanbul/Babel; zusätzlich `pm2` → `js-yaml` | Mehrere quadratische CPU-DoS-Befunde bei YAML-Merge-/Aliasverarbeitung. | Audit führt PM2 7.1.2 (Major) als Fix auf; beide Versionen müssen geprüft werden. |
| Hoch | `music-metadata` 7.14.0 | `@neelegirly/baileys` → `music-metadata` | Parser-Schleifen, unkontrollierte Speicherbelegung und Prozessabstürze bei manipulierten Medien. | Kein automatischer Fix gemeldet. Medienparser-Update benötigt Baileys-Kompatibilitätstest. |
| Hoch | `pac-proxy-agent` 7.2.0 | `pm2` → `proxy-agent` → `pac-proxy-agent` | Verwundbare transitive URI-/FTP-Verarbeitung. | Audit führt PM2 7.1.2 (Major) als Fix auf; Proxy-Funktionen testen. |
| Hoch | `pm2` 6.0.14 | direkte Abhängigkeit | ReDoS sowie verwundbare `js-yaml`-/Proxy-Unterabhängigkeiten. | Audit schlägt 7.1.2 (Major) vor. Nicht ohne PM2-/Prozessmanager-Test übernehmen. |
| Hoch | `proxy-agent` 6.4.0 | `pm2` → `@pm2/agent` → `proxy-agent` | Verwundbare `pac-proxy-agent`-Abhängigkeit. | Audit führt PM2 7.1.2 (Major) als Fix auf; keine isolierte Änderung getestet. |
| Hoch | `systeminformation` 5.31.5 | `pm2` → optional `pm2-sysmonit` → `systeminformation` | Linux-/Windows-Command-Injection sowie Pfad-/Prototype-Probleme. | npm meldet Fix vorhanden; optionale PM2-Monitoring-Funktionen testen. |
| Hoch | `ws` 7.5.10, 8.20.0 | PM2-Agent/PM2-JS-API und `@neelegirly/baileys` | Speicher-Offenlegung und Speicher-DoS durch WebSocket-Frames. | npm meldet Fix vorhanden; beide Hauptversionen in Tests abdecken. |
| Moderat | `baseline-browser-mapping` 2.10.24 | `browserslist` → `baseline-browser-mapping` | Prozessabbruch bei ungültiger Eingabe. | npm meldet Fix vorhanden. |
| Moderat | `file-type` 16.5.4 | `@neelegirly/baileys` → `music-metadata` → `file-type` | Endlosschleife im ASF-Parser bei manipulierten Medien. | Kein automatischer Fix gemeldet; `music-metadata`-Abhängigkeit aktualisieren. |
| Moderat | `minimatch` 10.2.5 | `nodemon` → `minimatch` | DoS durch Verstärkung von Glob-Teilen. | npm meldet Fix vorhanden. |
| Moderat | `nodemon` 3.1.14 | direkte Dev-Abhängigkeit → `minimatch` | Erbt den moderaten `minimatch`-DoS-Befund. | npm meldet Fix vorhanden; nur Entwicklungswerkzeug, trotzdem Lockfile aktualisieren. |
| Moderat | `uuid` 9.0.1 | `@neelegirly/baileys` → `uuid` | Fehlende Buffer-Grenzprüfung in bestimmten Versionen, wenn ein Buffer bereitgestellt wird. | Kein Fix gemeldet; v11.1.1 wäre ein Major-Sprung und darf nicht ungeprüft erzwungen werden. |
| Niedrig | `@babel/core` 7.29.0 | Jest/Babel-Testtoolchain | Arbitrary File Read über `sourceMappingURL`. | npm meldet Fix vorhanden. |
| Niedrig | `@jest/core` 29.7.0 | `@neelegirly/wa-api` → Jest | Erbt niedrig bewertete `jest-config`-Befunde. | Kein automatischer Fix gemeldet; Jest-Toolchain aktualisieren/testen. |
| Niedrig | `create-jest` 29.7.0 | `jest` → `jest-cli` → `create-jest` | Erbt `jest-config`-Befunde. | Kein automatischer Fix gemeldet. |
| Niedrig | `deepmerge` 4.3.1 | Jest → `jest-config` → `deepmerge` | Prototype-Poisoning im zurückgegebenen Objekt. | Kein automatischer Fix gemeldet. |
| Niedrig | `jest` 29.7.0 | `@neelegirly/wa-api` → Jest | Erbt niedrige Jest-/Konfigurationsbefunde. | Kein automatischer Fix gemeldet; Produktionsabhängigkeit der wa-api beim Maintainer adressieren. |
| Niedrig | `jest-cli` 29.7.0 | `@neelegirly/wa-api` → Jest → `jest-cli` | Erbt `jest-config`-Befunde. | Kein automatischer Fix gemeldet. |
| Niedrig | `jest-config` 29.7.0 | Jest-Toolchain | Erbt `deepmerge`-Prototype-Poisoning. | Kein automatischer Fix gemeldet. |

## Ergebnis und nächste sichere Schritte

- Geändert: Beim Prozessstart werden gespeicherte `starting`/`connecting`/`online`/`running`-Statuswerte als nicht-live auf `offline` zurückgesetzt. Erst aktuelle Runtime-/WhatsApp-Ereignisse markieren eine Session wieder als verbunden.
- Als gezielter Runtime-Fix wurde `lru-cache` 10.x direkt ergänzt; die von `cache-manager` benötigte 7.x-Version bleibt getrennt. WhatsApp-Forks und PM2 wurden nicht aktualisiert.
- Der frühere trockene npm-Fixlauf scheiterte vor einer Änderungsplanung. npm-Updates aus dem Betreiberlauf wurden nicht als WhatsApp-/PM2-Kompatibilitätstest gewertet.
- Zuerst eine getrennte Testkopie anlegen und dort `npm audit fix` ohne `--force` prüfen. Danach den PM2-Major-Sprung und WhatsApp-Fork-/Signal-Abhängigkeiten getrennt behandeln und Build, Tests sowie Session-/Menü-/Gruppenregressionen ausführen.
- Die Audit-Warnungen sind kein Beweis einer ausnutzbaren Schwachstelle in dieser konkreten Bereitstellung. Öffentlich erreichbare Parser-/Proxy-Pfade und tatsächlich verarbeitete nicht vertrauenswürdige Eingaben müssen separat bewertet werden.
- WhatsApp-Anmeldung, Support-Session, Gruppenaktionen, KI-Label und VPS/DNS/HTTPS konnten ohne Credentials bzw. Serverzugang nicht live getestet werden.
