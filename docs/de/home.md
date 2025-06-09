# 1. Einführung

Keine Registrierung erforderlich, einfache Einrichtung!  
InsightBuddy Extension ist ein KI-Chat-Assistent, der auf Webseiten verwendet werden kann. Sie können ihn sofort nutzen, indem Sie einfach den API-Schlüssel Ihres bevorzugten KI-Anbieters eingeben – egal ob OpenAI, Anthropic, Google oder ein anderer Anbieter – ganz ohne Registrierung.  
Darüber hinaus kann er auch mit Ihrer selbstgehosteten, OpenAI-kompatiblen Umgebung verbunden werden.

- Ab Februar 2025 ist Googles Gemini teilweise kostenlos verfügbar, sodass Sie generative KI kostenlos nutzen können, wenn Sie diese Option ausnutzen.
- Der folgende Artikel fasst zusammen, wie Sie ein Konto einrichten können ( https://j-aic.com/techblog/google-ai-studio-api-free ).

## 1.1 Hauptfunktionen

- Unterstützt mehrere KI-Anbieter
- Ermöglicht Gespräche, bei denen der Webseiteninhalt berücksichtigt wird
- Enthält eine Funktion zum Speichern des Chatverlaufs
- Mit der Leitfaden-Funktion können Sie auf bestimmten Seiten spezifische Aktionen durchführen.

## 1.2 Informationsverarbeitung

- API-Schlüssel und Chatverlauf werden ausschließlich lokal auf Ihrem Gerät gespeichert.
- Für Details zur Verarbeitung der über die Chat-Funktion gesendeten Daten lesen Sie bitte die Nutzungsbedingungen der jeweiligen Modellanbieter.
- Unser Unternehmen sammelt keine Nutzungsdaten oder andere Informationen ausschließlich über diese Funktion.

---

# 2. Erste Einrichtung

## 2.1 Schritte zur Konfiguration des API-Anbieters

1. **Öffnen Sie den API-Einstellungsbildschirm**  
   - Öffnen Sie das Chat-Widget in der unteren rechten Ecke des Bildschirms  
   - Klicken Sie auf das "Startseite"-Symbol im unteren Menü  
   - Klicken Sie im linken Menü auf "API-Einstellungen"
2. **Wählen Sie den Anbieter aus und geben Sie den API-Schlüssel ein**  
   - Suchen Sie die Karte des gewünschten KI-Anbieters  
   - Klicken Sie auf das Zahnrad-Symbol, um in den Konfigurationsmodus zu gelangen  
   - Geben Sie Ihren API-Schlüssel ein  
   - Klicken Sie auf "Speichern"
3. **Wählen Sie das Modell aus**  
   - Klicken Sie auf der Anbieterkachel auf "Modell auswählen"  
   - Wählen Sie aus der Liste der verfügbaren Modelle
4. **Aktivieren Sie den Anbieter**  
   - Schalten Sie nach der Konfiguration den Umschalter ein  
   - Der Status wird aktualisiert, sobald die Konfiguration korrekt ist

## 2.2 Unterstützte Anbieter

### OpenAI

- Schlüsselformat: Ein String, der mit `sk-` beginnt
- Hauptmodelle: GPT-4, GPT-3.5-turbo
- API-Schlüssel beziehen: Verfügbar auf der OpenAI-Website

### Anthropic

- Schlüsselformat: Ein String, der mit `sk-ant-api` beginnt
- Hauptmodelle: Claude-3-Opus, Claude-3-Sonnet
- API-Schlüssel beziehen: Verfügbar auf der Anthropic-Website

### Google Gemini

- Schlüsselformat: Ein String, der mit `AIza` beginnt
- Hauptmodell: gemini-pro
- API-Schlüssel beziehen: Verfügbar in der Google Cloud Console

### Deepseek

- Schlüsselformat: Ein String, der mit `sk-ds-api` beginnt
- Hauptmodelle: Deepseek-LLM, Deepseek-XL
- API-Schlüssel beziehen: Verfügbar auf der Deepseek-Website

### OpenAI-kompatibel

- Schlüsselformat: Jeder beliebige String (entsprechend den Vorgaben des Anbieters)
- Hauptmodelle: Vom Anbieter bereitgestellte OpenAI-kompatible Modelle
- API-Schlüssel beziehen: Verfügbar auf der Website des jeweiligen Anbieters
- Besonderheiten:
  - Erfordert die Konfiguration einer benutzerdefinierten Endpunkt-URL
  - Erfordert die manuelle Eingabe des Modellnamens
  - Kann mit jedem Dienst verwendet werden, der eine OpenAI-kompatible API anbietet

### Lokale API

- Dies ist die firmeneigene API von InsightBuddy.
- Zur Nutzung ist eine separate Vereinbarung erforderlich.
- Bietet Funktionen wie das Lesen von Formularen und eine Formular-Eingabeschnittstelle.

---

# 3. Grundlegende Nutzung

## 3.1 Einen Chat starten

1. Klicken Sie auf den blauen Tab am rechten Rand Ihres Browsers.
2. Das Chat-Widget wird geöffnet.
3. Geben Sie Ihre Nachricht in das Eingabefeld am unteren Rand ein.
4. Klicken Sie auf den Senden-Button oder drücken Sie die Eingabetaste, um die Nachricht zu senden.

## 3.2 Verwendung der Chat-Funktion

- **Neuen Chat starten**  
  - Klicken Sie oben rechts auf das "+"-Symbol.
- **Chatverlauf anzeigen**  
  - Klicken Sie auf das Uhr-Symbol im unteren Menü.  
  - Wählen Sie ein vergangenes Gespräch aus, um es anzuzeigen.
- **Webseiteninhalt nutzen**  
  - Wenn aktiviert, ermöglicht die Option "Aktuelle Webseiteninhalte abrufen" dem Assistenten, den Inhalt der aktuellen Seite bei der Generierung einer Antwort zu berücksichtigen.

---

# 4. Fehlerbehebung

## 4.1 Häufige Fehler und ihre Lösungen

### API-Schlüssel-Fehler

- **Symptom**: Eine Fehlermeldung, die besagt "API-Schlüssel ist ungültig."
- **Lösung**:
  1. Überprüfen Sie, ob das Format des API-Schlüssels korrekt ist.
  2. Prüfen Sie das Ablaufdatum des API-Schlüssels.
  3. Beantragen Sie bei Bedarf einen neuen API-Schlüssel.

### Verbindungsfehler

- **Symptom**: Nachricht kann nicht gesendet werden.
- **Lösung**:
  1. Überprüfen Sie Ihre Internetverbindung.
  2. Laden Sie den Browser neu.
  3. Überprüfen Sie den Status des API-Anbieters.

### Modellwahl-Fehler

- **Symptom**: Es kann kein Modell ausgewählt werden.
- **Lösung**:
  1. Überprüfen Sie die Berechtigungen des API-Schlüssels.
  2. Prüfen Sie die Nutzungseinschränkungen des Anbieters.
  3. Versuchen Sie, ein anderes Modell auszuwählen.

### Fehler bei der Verbindung zu OpenAI-kompatiblen Diensten

- **Symptom**: Es kann keine Verbindung hergestellt oder keine Antwort empfangen werden.
- **Lösung**:
  1. Überprüfen Sie, ob die Endpunkt-URL korrekt ist.
  2. Stellen Sie sicher, dass der eingegebene Modellname den Vorgaben des Anbieters entspricht.
  3. Bestätigen Sie, dass das Format des API-Schlüssels den Anforderungen des Anbieters entspricht.
  4. Überprüfen Sie den Status des Dienstes des Anbieters.

## 4.2 Zurücksetzen der Konfiguration

1. Öffnen Sie den API-Einstellungsbildschirm.
2. Deaktivieren Sie die Einstellungen für jeden Anbieter.
3. Geben Sie die API-Schlüssel erneut ein.
4. Wählen Sie die Modelle erneut aus.

---

# 5. Sicherheit und Datenschutz

## 5.1 Datenverarbeitung

- API-Schlüssel werden verschlüsselt lokal auf Ihrem Gerät gespeichert.
- Der Chatverlauf wird ausschließlich lokal gespeichert.
- Webseiteninformationen werden nur im erforderlichen Umfang verwendet.

## 5.2 Empfohlene Sicherheitsmaßnahmen

- Aktualisieren Sie regelmäßig die API-Schlüssel.
- Deaktivieren Sie nicht genutzte Anbieter.
- Überprüfen Sie die Datenschutzeinstellungen Ihres Browsers.

## 5.3 Überprüfung auf Updates

- Stellen Sie sicher, dass automatische Updates der Chrome-Erweiterung aktiviert sind.
- Überprüfen und aktualisieren Sie regelmäßig Ihre Einstellungen.

---

# 6. Technische Spezifikationen

## 6.1 Mehrfachdialogsystem

### Grundlegendes Design

- **Maximale Anzahl an beibehaltenen Gesprächsabschnitten:** 4 Abschnitte  
  - Beschränkt, um die Token-Nutzung zu optimieren.
  - Ein Abschnitt = Benutzer-Nachricht + KI-Antwort.
  - Ab dem 5. Abschnitt werden die ältesten entfernt.

### Implementiertes Gesprächsmanagement

- **Gesprächsverlauf wird im Markdown-Format verwaltet**  
  - **Aktueller Dialogverlauf:** Vergangene Gesprächsabschnitte  
  - **Aktuelle Benutzernachricht:** Die derzeitige Eingabe  
  - **Seitenkontext:** Informationen zur aktuellen Webseite (optional)  
  - **Markdown-Konfiguration:**

    ```markdown
    # Aktueller Dialogverlauf
    ## Abschnitt 1
    ### Benutzer
    Inhalt der Benutzer-Nachricht
    ### Assistent
    Inhalt der KI-Antwort
    # Aktuelle Benutzernachricht
    Derzeitige Benutzereingabe
    # Seitenkontext (optional)
    Webseiteninhalt
    ```

- **Zu jeder Anfrage wird ein Systemprompt angehängt**  
  - Antworten erfolgen in der Sprache des Benutzers.
  - Es gibt Einschränkungen hinsichtlich der Verwendung von Formatierungen und Markdown.
  - Dies gewährleistet Konsistenz im gesamten Gespräch.
  - **Systemprompt-Konfiguration:**

    ```text
    Du bist ein leistungsstarker KI-Assistent. Bitte antworte gemäß den folgenden Anweisungen:

    # Grundlegendes Verhalten
    - Die vom Benutzer gesendete Nachricht wird in ("Aktuelle Benutzernachricht") gespeichert.
    - Antworte in der Sprache, die der Benutzer in ("Aktuelle Benutzernachricht") verwendet.
    - Halte deine Antworten prägnant und genau.
    - Verwende keine Formatierungen oder Markdown.

    # Verarbeitung des Gesprächsverlaufs
    - Verstehe den Kontext, indem du den bereitgestellten, im Markdown-Format formatierten Gesprächsverlauf ("Aktueller Dialogverlauf") heranziehst.
    - Jeder Abschnitt wird als "Abschnitt X" angegeben und enthält den Dialog zwischen Benutzer und Assistent.
    - Strebe Antworten an, die konsistent mit dem vorherigen Gespräch sind.

    # Verarbeitung von Webinformationen
    - Falls ein Abschnitt "Seitenkontext" existiert, berücksichtige den Inhalt der Webseite bei der Antwort.
    - Nutze die Webseiteninformationen als Ergänzung und beziehe dich nur auf die Teile, die direkt mit der Frage des Benutzers zusammenhängen.
    ```

---

## 6.2 Kontextverarbeitungssystem

### Abrufen von Webseiteninformationen

- **Implementierung zur Optimierung der Token-Nutzung**
  - Der Webseiteninhalt wird für jede Anfrage neu abgerufen (wird nicht im Verlauf gespeichert).
  - Die Token-Nutzung wird durch Optimierung des HTML reduziert.
  - Unnötige Elemente (wie `<script>`, `<style>`, `<iframe>` etc.) werden entfernt.
- **Funktion zum Umschalten des Seitenkontexts**
  - Ermöglicht dem Benutzer, diese Funktion ein- oder auszuschalten.
  - Wird automatisch aktiviert, wenn die lokale API verwendet wird.

### Formularlesefunktionalität

- Erkennt Formular-Elemente automatisch.
- **Integration mit der PDF-Parsing-Funktionalität**
  - Automatische Erkennung von PDF-Dateien.
  - Prozess zur Textextraktion.
  - Integration in den ursprünglichen Formularkontext.

---

## 6.3 Anbietermanagementsystem

### Anbieter-spezifische Implementierungen

- **OpenAI / Deepseek**
  - Verwendet Bearer-Authentifizierung.
  - Unterstützt automatisches Abrufen von Modellen.
- **Anthropic**
  - Verwendet x-api-key-Authentifizierung.
  - Erfordert die Angabe einer Version (z.B. 2023-06-01).
- **Google Gemini**
  - Authentifizierung mittels API-Schlüssel.
  - Unterstützt ein spezielles Antwortformat.
- **OpenAI-kompatibel**
  - Unterstützt die Konfiguration benutzerdefinierter Endpunkte.
  - Erfordert manuelle Eingabe des Modellnamens.
  - Ermöglicht anpassbare Authentifizierungsmethoden.
- **Lokale API**
  - Unterstützt benutzerdefinierte Endpunkte.
  - Verwendet ein firmeneigenes Authentifizierungssystem.

### Anbieterwechsel-Funktion

- Es kann jeweils nur ein Anbieter aktiviert werden.
- Führt eine Integritätsprüfung der Konfiguration durch:
  - Überprüft das Format des API-Schlüssels.
  - Prüft, ob alle erforderlichen Konfigurationselemente vorhanden sind.
  - Stellt sicher, dass ein Modell ausgewählt wurde.

---

## 6.4 Verlaufmanagementsystem

### Implementierte Speicherfunktion

- Speichert bis zu 30 Chatverläufe.
- **Gespeicherte Daten umfassen:**
  - Anbieterinformationen
  - Ausgewähltes Modell
  - Zeitstempel
  - Nachrichtenverlauf
- **Integration mit der Chrome Storage API:**
  - Ermöglicht den Datenaustausch zwischen Erweiterungen.
  - Nutzt lokalen Speicher als Fallback.

### Verlauf-Funktionen

- **Funktion zum Bearbeiten von Gesprächen**
  - Ermöglicht das Bearbeiten von Nachrichten.
  - Generiert Antworten nach Bearbeitung neu.
  - Aktualisiert automatisch nachfolgende Nachrichten.
- Verlauf-Filterung.
- **Anbieter-Kompatibilitätsprüfung**
  - Überprüft, ob das ausgewählte Modell mit dem Anbieter übereinstimmt.
  - Zeigt bei Bedarf Kompatibilitätswarnungen an.

---

## 6.5 Implementierung des Chat-Widgets

### UI/UX-Funktionen

- **Implementiert mithilfe von iframes**
  - Isoliert von der übergeordneten Seite.
  - Kommuniziert über Nachrichtenübermittlung.
- **Responsives Design**
  - Passt die Anzeige an die Bildschirmgröße an.
  - Passt den Eingabebereich automatisch an.

### Besondere Funktionen

- **Anzeige von Seiteninformationen**
  - Rendert HTML-Inhalte.
  - Zeigt Formularinhalte an.
- **Nachrichtenverwaltung**
  - Erstellen eines neuen Chats.
  - Bearbeiten und erneutes Senden von Chats (Hinweis: Eine Wiederverwendung von Webseiteninformationen ist nicht gestattet).
  - Umschalten der Anzeige des Chatverlaufs.

---

## 6.6 Sicherheitsimplementierungen

### API-Verwaltung

- **Sichere Speicherung der API-Schlüssel**
  - Verwendet die Chrome Storage API.
  - Maskiert Schlüssel, wenn sie angezeigt werden.

### Datenschutz

- **Begrenzung des Seitenkontexts**
  - Ruft nur die notwendigen Informationen ab.
  - Schließt sensible Daten aus.
- **Lokale Datenverwaltung**
  - Verwaltet Sitzungsdaten.

---

## 6.7 Debug-Protokoll

- Das folgende Debug-Protokoll wird ausgegeben:

  ```javascript
  console.group('Externe API-Übertragungs-Debug-Informationen');
  console.log('Gesendete Nachricht:', message);
  console.log('API-Konfiguration:', {
      provider: apiConfig.provider,
      model: apiConfig.model,
      customSettings: apiConfig.customSettings
  });
  console.log('API-Antwort:', result);
  console.groupEnd();
