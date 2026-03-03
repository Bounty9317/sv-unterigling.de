# Requirements Document

## Introduction

Diese Spezifikation beschreibt die Implementierung einer mobil-optimierten Listenansicht für den Helfer-Dashboard-Kalender. Die aktuelle Grid-Ansicht (7 Spalten für Wochentage) funktioniert auf mobilen Geräten nicht gut: Drag & Drop funktioniert nicht zuverlässig (Text wird stattdessen markiert), Info-Buttons sind zu klein zum Antippen, und Namen werden abgeschnitten. Die neue Listenansicht zeigt Tage 1-31 vertikal an und bietet touch-freundliche Interaktionen, während die Desktop-Ansicht unverändert bleibt.

## Glossary

- **Calendar_System**: Das Kalendersystem im helfer-dashboard.html, das Wirte und Schießaufsicht verwaltet
- **Grid_View**: Die aktuelle Kalenderansicht mit 7 Spalten (Mo-So) und Zeilen für Wochen
- **List_View**: Die neue vertikale Listenansicht mit Tagen 1-31 als Karten/Zeilen
- **Desktop_Viewport**: Bildschirmbreite > 768px
- **Mobile_Viewport**: Bildschirmbreite ≤ 768px
- **Touch_Target**: Interaktives Element mit mindestens 44x44px Größe (WCAG 2.1 Richtlinie)
- **Wirte_Calendar**: Kalender für Wirte-Einteilungen (Samstag, Sonntag, Feiertage)
- **Aufsicht_Calendar**: Kalender für Schießaufsichts-Einteilungen (nur Samstag)
- **Auto_Rotation**: Automatische Zuweisung von Personen zu Terminen in rotierender Reihenfolge
- **Tausch_System**: System zum Tauschen von Einteilungen zwischen Personen
- **Firebase_Backend**: Cloud-Datenbank für Personen, Einteilungen und Tausch-Anfragen
- **Multi_Slot_Day**: Samstag im Wirte-Kalender mit zwei Slots (Frühschoppen und Schießabend)
- **Assignment**: Eine Zuweisung einer Person zu einem bestimmten Datum/Slot

## Requirements

### Requirement 1: Responsive View Switching

**User Story:** Als Benutzer möchte ich automatisch die passende Kalenderansicht für mein Gerät sehen, damit ich die beste Benutzererfahrung habe.

#### Acceptance Criteria

1. WHEN THE viewport width is greater than 768px, THE Calendar_System SHALL render the Grid_View
2. WHEN THE viewport width is less than or equal to 768px, THE Calendar_System SHALL render the List_View
3. WHEN THE viewport is resized across the 768px breakpoint, THE Calendar_System SHALL switch between Grid_View and List_View
4. THE Calendar_System SHALL preserve all Assignment data when switching between views
5. THE Calendar_System SHALL maintain the current month selection when switching between views

### Requirement 2: List View Structure

**User Story:** Als mobiler Benutzer möchte ich eine vertikale Liste aller Tage des Monats sehen, damit ich leicht durch den Kalender scrollen kann.

#### Acceptance Criteria

1. THE List_View SHALL display days 1-31 as vertical cards or rows
2. FOR EACH day card, THE List_View SHALL display the day number prominently
3. FOR EACH day card, THE List_View SHALL display the weekday name (Mo, Di, Mi, Do, Fr, Sa, So)
4. FOR EACH day card, THE List_View SHALL display the full date in DD.MM.YYYY format
5. WHEN a day is a holiday, THE List_View SHALL display a holiday indicator (🎉 emoji)
6. WHEN a day is disabled (not allowed for assignments), THE List_View SHALL visually distinguish it with reduced opacity
7. THE List_View SHALL display only the days that exist in the current month (28-31 days depending on month)

### Requirement 3: Full Name Display

**User Story:** Als mobiler Benutzer möchte ich vollständige Namen ohne Abschneidung sehen, damit ich immer weiß, wer eingeteilt ist.

#### Acceptance Criteria

1. FOR EACH Assignment in List_View, THE Calendar_System SHALL display the complete person name without truncation
2. WHEN a name exceeds the card width, THE Calendar_System SHALL wrap the text to multiple lines
3. THE Calendar_System SHALL use a minimum font size of 14px for person names in List_View
4. FOR EACH Assignment, THE Calendar_System SHALL display the person's color as background with white text

### Requirement 4: Touch-Friendly Interaction Targets

**User Story:** Als mobiler Benutzer möchte ich große, leicht antippbare Buttons haben, damit ich nicht versehentlich falsche Elemente berühre.

#### Acceptance Criteria

1. THE Calendar_System SHALL render all interactive buttons in List_View with minimum dimensions of 44x44px
2. THE Calendar_System SHALL provide adequate spacing (minimum 8px) between adjacent Touch_Targets
3. WHEN a user taps an Assignment, THE Calendar_System SHALL open the swap modal
4. WHEN a user taps an info button, THE Calendar_System SHALL display assignment details
5. THE Calendar_System SHALL provide visual feedback (color change or scale) when a Touch_Target is tapped

### Requirement 5: Selection-Based Swap System for Mobile

**User Story:** Als mobiler Benutzer möchte ich Einteilungen durch Auswahl statt Drag & Drop tauschen, damit die Funktion zuverlässig auf Touch-Geräten funktioniert.

#### Acceptance Criteria

1. WHEN a user taps an Assignment in List_View, THE Tausch_System SHALL open a swap modal
2. THE swap modal SHALL display the current Assignment details (date, person, slot if applicable)
3. THE swap modal SHALL display a list of available replacement persons
4. WHEN a user selects a replacement person, THE Tausch_System SHALL create a swap request
5. THE Tausch_System SHALL maintain the existing swap request workflow (pending, approved, rejected states)
6. THE Calendar_System SHALL NOT enable drag and drop functionality in List_View

### Requirement 6: Multi-Slot Day Support in List View

**User Story:** Als Benutzer des Wirte-Kalenders möchte ich beide Slots (Frühschoppen und Schießabend) für Samstage in der Listenansicht sehen, damit ich alle Einteilungen verwalten kann.

#### Acceptance Criteria

1. WHEN displaying a Multi_Slot_Day in Wirte_Calendar List_View, THE Calendar_System SHALL show both slot sections
2. FOR EACH slot section, THE Calendar_System SHALL display the slot label (☀️ Frühschoppen or 🌙 Schießabend)
3. FOR EACH slot, THE Calendar_System SHALL display the assigned person if present
4. WHEN a slot has no Assignment, THE Calendar_System SHALL display a visual indicator for missing assignment
5. WHEN a user taps a slot Assignment, THE Tausch_System SHALL open the swap modal with the correct slot context

### Requirement 7: Preserve Desktop Grid View

**User Story:** Als Desktop-Benutzer möchte ich die bestehende Grid-Ansicht behalten, damit meine gewohnte Arbeitsweise nicht gestört wird.

#### Acceptance Criteria

1. WHEN THE viewport width is greater than 768px, THE Calendar_System SHALL render the existing Grid_View unchanged
2. THE Grid_View SHALL maintain all existing drag and drop functionality
3. THE Grid_View SHALL maintain all existing visual styling and layout
4. THE Grid_View SHALL maintain all existing interaction patterns
5. THE Calendar_System SHALL NOT apply List_View styles or behavior to Desktop_Viewport

### Requirement 8: Preserve Auto-Rotation Feature

**User Story:** Als Benutzer möchte ich die automatische Rotationsfunktion in beiden Ansichten nutzen, damit ich Personen schnell zuweisen kann.

#### Acceptance Criteria

1. THE Auto_Rotation feature SHALL function identically in both Grid_View and List_View
2. WHEN Auto_Rotation is triggered, THE Calendar_System SHALL assign persons to allowed days in rotating order
3. THE Calendar_System SHALL respect day restrictions (weekends/holidays for Wirte_Calendar, Saturdays for Aufsicht_Calendar)
4. FOR Multi_Slot_Day entries, THE Auto_Rotation SHALL assign persons to both slots
5. THE Calendar_System SHALL save all Auto_Rotation assignments to Firebase_Backend

### Requirement 9: Preserve PDF Download Feature

**User Story:** Als Benutzer möchte ich die Wirteliste als PDF herunterladen können, unabhängig von der verwendeten Ansicht.

#### Acceptance Criteria

1. THE Calendar_System SHALL provide the PDF download button in both Grid_View and List_View
2. WHEN the download button is clicked, THE Calendar_System SHALL generate a PDF with all assignments
3. THE PDF SHALL maintain the existing format (landscape, tables for Saturday/Sunday)
4. THE PDF SHALL include all Assignment data including swapped assignments
5. THE PDF generation SHALL function identically regardless of current view mode

### Requirement 10: Preserve Person Management

**User Story:** Als Benutzer möchte ich Personen hinzufügen und entfernen können, unabhängig von der verwendeten Ansicht.

#### Acceptance Criteria

1. THE Calendar_System SHALL provide the "Helfer hinzufügen" button in both Grid_View and List_View
2. WHEN a person is added, THE Calendar_System SHALL save the person to Firebase_Backend
3. WHEN a person is added, THE Calendar_System SHALL update both Wirte_Calendar and Aufsicht_Calendar person lists
4. THE person modal SHALL function identically in both view modes
5. THE Calendar_System SHALL display person cards with drag functionality in Grid_View and as reference in List_View

### Requirement 11: Preserve Firebase Synchronization

**User Story:** Als Benutzer möchte ich, dass alle Änderungen in Echtzeit synchronisiert werden, unabhängig von der verwendeten Ansicht.

#### Acceptance Criteria

1. THE Calendar_System SHALL maintain all existing Firebase_Backend connections in both views
2. WHEN an Assignment is created or modified, THE Calendar_System SHALL save it to Firebase_Backend
3. WHEN a swap request is created, THE Calendar_System SHALL save it to Firebase_Backend
4. WHEN Firebase_Backend data changes, THE Calendar_System SHALL update the displayed view in real-time
5. THE Calendar_System SHALL handle both single assignments and Multi_Slot_Day assignments correctly

### Requirement 12: Month Navigation in List View

**User Story:** Als mobiler Benutzer möchte ich zwischen Monaten navigieren können, damit ich zukünftige und vergangene Einteilungen sehen kann.

#### Acceptance Criteria

1. THE List_View SHALL display month navigation buttons (previous/next)
2. WHEN the previous month button is tapped, THE Calendar_System SHALL load and display the previous month
3. WHEN the next month button is tapped, THE Calendar_System SHALL load and display the next month
4. THE Calendar_System SHALL display the current month name and year prominently
5. THE Calendar_System SHALL load assignments for the selected month from Firebase_Backend

### Requirement 13: Visual Assignment Status Indicators

**User Story:** Als mobiler Benutzer möchte ich auf einen Blick sehen, welche Tage eingeteilt sind und welche fehlen, damit ich schnell Lücken identifizieren kann.

#### Acceptance Criteria

1. WHEN a day has an Assignment, THE List_View SHALL display a visual indicator (colored border or badge)
2. WHEN a day is missing an Assignment and is allowed, THE List_View SHALL display a warning indicator (red border or badge)
3. WHEN a day is disabled, THE List_View SHALL display reduced opacity and no warning indicator
4. FOR Multi_Slot_Day entries, THE List_View SHALL show status for each slot independently
5. THE visual indicators SHALL use colors consistent with the existing Grid_View (green for assigned, red for missing)

### Requirement 14: Swap Display in List View

**User Story:** Als mobiler Benutzer möchte ich sehen, wenn eine Einteilung getauscht wurde, damit ich über Änderungen informiert bin.

#### Acceptance Criteria

1. WHEN an Assignment has been swapped, THE List_View SHALL display the replacement person's name
2. WHEN an Assignment has been swapped, THE List_View SHALL display the original person's name with strikethrough
3. THE List_View SHALL display a "Getauscht mit" label for swapped assignments
4. THE swapped assignment display SHALL use the existing orange background color (#ffa726)
5. THE List_View SHALL display swap information clearly without truncation

### Requirement 15: Accessibility and Readability

**User Story:** Als mobiler Benutzer möchte ich gut lesbare Texte und klare visuelle Hierarchie, damit ich den Kalender auch unterwegs nutzen kann.

#### Acceptance Criteria

1. THE List_View SHALL use minimum font size of 14px for body text
2. THE List_View SHALL use minimum font size of 16px for day numbers
3. THE List_View SHALL provide sufficient contrast ratio (minimum 4.5:1) between text and background
4. THE List_View SHALL use adequate spacing between elements (minimum 8px)
5. THE List_View SHALL display content in a logical reading order (day number, date, weekday, assignments)
