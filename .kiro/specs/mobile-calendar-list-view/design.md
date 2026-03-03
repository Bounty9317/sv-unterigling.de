# Design Document: Mobile Calendar List View

## Overview

This design implements a responsive mobile-optimized list view for the Helfer Dashboard calendar system. The current grid-based calendar (7 columns for weekdays) presents significant usability challenges on mobile devices: drag-and-drop is unreliable (text selection interferes), interactive buttons are too small for touch targets, and names are truncated making assignments unclear.

The solution introduces a vertical list view that displays days 1-31 as cards, activated automatically on viewports ≤768px. This preserves the existing desktop grid experience while providing touch-friendly interactions for mobile users. The design maintains all existing functionality including auto-rotation, PDF download, Firebase synchronization, and the swap system.

### Key Design Goals

- Automatic responsive switching between grid (desktop) and list (mobile) views
- Touch-friendly interaction targets (minimum 44x44px per WCAG 2.1)
- Full name display without truncation
- Selection-based swap system replacing drag-and-drop on mobile
- Zero breaking changes to desktop experience
- Single-file implementation in helfer-dashboard.html

### Technical Approach

The implementation uses CSS media queries for responsive switching and JavaScript view rendering logic. The existing data structures and Firebase backend remain unchanged. Both views share the same data layer, ensuring consistency when switching between viewports.

## Architecture

### High-Level Structure

```
┌─────────────────────────────────────────┐
│         Viewport Detection              │
│    (CSS Media Query: 768px)             │
└────────────┬────────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
┌─────▼─────┐ ┌────▼──────┐
│ Grid View │ │ List View │
│ (>768px)  │ │ (≤768px)  │
└─────┬─────┘ └────┬──────┘
      │             │
      └──────┬──────┘
             │
┌────────────▼─────────────────────────────┐
│      Shared Data Layer                   │
│  - Firebase Backend                      │
│  - Assignments Object                    │
│  - Persons Array                         │
│  - Swap Requests                         │
└──────────────────────────────────────────┘
```

### Component Hierarchy

```
helfer-dashboard.html
├── Header (unchanged)
├── Tab Navigation (Wirte/Aufsicht)
├── Calendar Section
│   ├── Month Navigation
│   ├── Action Buttons (Download, Add Person)
│   ├── Person Cards (reference only in mobile)
│   └── Calendar Display
│       ├── Grid View (desktop)
│       │   └── 7-column grid with drag-drop
│       └── List View (mobile)
│           └── Vertical day cards
├── Modals
│   ├── Add Person Modal (unchanged)
│   └── Swap Modal (enhanced for mobile)
└── Firebase Integration (unchanged)
```

### Responsive Switching Mechanism

The system uses CSS `display` properties controlled by media queries:

- **Desktop (>768px)**: `.calendar-grid { display: grid; }` + `.calendar-list { display: none; }`
- **Mobile (≤768px)**: `.calendar-grid { display: none; }` + `.calendar-list { display: block; }`

JavaScript renders both views but CSS controls visibility. This ensures instant switching on resize without re-rendering.

## Components and Interfaces

### 1. List View Container

**Purpose**: Wrapper for the vertical list of day cards

**HTML Structure**:
```html
<div id="wirte-calendar-list" class="calendar-list">
  <!-- Day cards rendered here -->
</div>
```

**CSS Classes**:
- `.calendar-list`: Main container, hidden on desktop
- Vertical layout with scrolling
- Full viewport width on mobile

### 2. Day Card Component

**Purpose**: Individual card representing one day in the month

**HTML Structure**:
```html
<div class="day-card" data-date="2025-01-15">
  <div class="day-card-header">
    <span class="day-number">15</span>
    <span class="day-name">Mi</span>
    <span class="day-date">15.01.2025</span>
    <span class="holiday-indicator">🎉</span> <!-- if holiday -->
  </div>
  <div class="day-card-body">
    <!-- Assignment slots -->
  </div>
</div>
```

**CSS Classes**:
- `.day-card`: Card container with border and padding
- `.day-card.disabled`: Reduced opacity for non-allowed days
- `.day-card.assigned`: Green border indicator
- `.day-card.missing`: Red border indicator
- `.day-card-header`: Top section with day info
- `.day-card-body`: Assignment display area

**Visual States**:
- **Disabled**: Gray background, 50% opacity, no interaction
- **Assigned**: Green left border (4px), white background
- **Missing**: Red left border (4px), light red background tint
- **Holiday**: Orange day number with 🎉 emoji

### 3. Assignment Display Component

**Purpose**: Shows assigned person(s) for a day/slot

**HTML Structure**:
```html
<div class="assignment-display" data-slot="fruehschoppen">
  <div class="slot-label">☀️ Frühschoppen</div>
  <button class="assignment-button" data-person="Max Mustermann">
    <span class="person-name">Max Mustermann</span>
  </button>
</div>
```

**For swapped assignments**:
```html
<div class="assignment-display swapped">
  <div class="slot-label">☀️ Frühschoppen</div>
  <button class="assignment-button">
    <span class="person-name original">Max Mustermann</span>
    <span class="swap-label">Getauscht mit</span>
    <span class="person-name replacement">Anna Schmidt</span>
  </button>
</div>
```

**Touch Target Requirements**:
- Minimum button size: 44x44px
- Minimum spacing between buttons: 8px
- Font size: 14px minimum for names
- Full-width buttons for easy tapping

### 4. Multi-Slot Day Component

**Purpose**: Display Saturday with two slots (Frühschoppen + Schießabend) in Wirte calendar

**HTML Structure**:
```html
<div class="day-card multi-slot" data-date="2025-01-18">
  <div class="day-card-header">
    <span class="day-number">18</span>
    <span class="day-name">Sa</span>
    <span class="day-date">18.01.2025</span>
  </div>
  <div class="day-card-body">
    <div class="assignment-display" data-slot="fruehschoppen">
      <!-- Frühschoppen assignment -->
    </div>
    <div class="assignment-display" data-slot="schiessabend">
      <!-- Schießabend assignment -->
    </div>
  </div>
</div>
```

**Visual Treatment**:
- Each slot has its own label with emoji (☀️/🌙)
- Slots are vertically stacked with 12px spacing
- Independent status indicators per slot
- Each slot button is independently tappable

### 5. Swap Modal (Enhanced)

**Purpose**: Allow users to select replacement person for swap request

**Existing Structure** (unchanged):
```html
<div id="swap-modal" class="modal">
  <div class="modal-content">
    <span class="close-modal">&times;</span>
    <h2 id="swap-modal-title">Tausch-Anfrage</h2>
    <p id="swap-modal-info"></p>
    <div class="helper-select" id="helper-select">
      <!-- Helper options rendered here -->
    </div>
  </div>
</div>
```

**Enhancement**: Ensure helper option buttons meet 44x44px minimum on mobile

**Interaction Flow**:
1. User taps assignment button in list view
2. Modal opens with current assignment details
3. User taps replacement person from grid
4. Swap request created in Firebase
5. Modal closes with confirmation

### 6. Month Navigation Component

**Purpose**: Allow navigation between months (existing, ensure mobile-friendly)

**Current Structure**:
```html
<div style="display: flex; align-items: center; justify-content: center;">
  <button class="btn" onclick="previousMonth('wirte')">◀</button>
  <h3 id="wirte-month-display">Januar 2025</h3>
  <button class="btn" onclick="nextMonth('wirte')">▶</button>
</div>
```

**Mobile Enhancement**:
- Increase button size to 44x44px minimum
- Ensure adequate spacing (16px between buttons)
- Maintain existing functionality

## Data Models

### Assignment Object

The existing assignment data structure remains unchanged:

```javascript
{
  id: string,              // Firestore document ID
  date: string,            // Format: "YYYY-MM-DD"
  person: string,          // Full name
  color: string,           // Hex color code
  slot: string | null,     // "fruehschoppen" | "schiessabend" | null
  swappedWith: string | null,      // Replacement person name
  originalPerson: string | null    // Original person if swapped
}
```

**Storage Keys**:
- Single assignment: `assignments[type][date]`
- Multi-slot: `assignments[type]["YYYY-MM-DD-slotname"]`

### Person Object

```javascript
{
  id: string,      // Firestore document ID
  name: string,    // Full name "Firstname Lastname"
  color: string    // Hex color code
}
```

### Swap Request Object

```javascript
{
  id: string,                  // Firestore document ID
  requestPerson: string,       // Person requesting swap
  date: string,                // Date of assignment
  requestPersonColor: string,  // Color of requesting person
  replacementPerson: string | null,  // Selected replacement
  status: string,              // "pending" | "approved" | "rejected"
  createdAt: string           // ISO timestamp
}
```

### View State

New state to track current view mode (for debugging/testing):

```javascript
const viewState = {
  currentView: 'grid' | 'list',  // Determined by viewport width
  isMobile: boolean               // window.innerWidth <= 768
};
```

## Implementation Approach

### Phase 1: CSS Media Queries

Add responsive styles for list view:

```css
/* List View Styles - Mobile Only */
@media (max-width: 768px) {
  .calendar-grid {
    display: none !important;
  }
  
  .calendar-list {
    display: block;
  }
  
  .day-card {
    background: #2a2a2a;
    border-left: 4px solid transparent;
    border-radius: 8px;
    margin-bottom: 12px;
    padding: 16px;
  }
  
  .day-card.assigned {
    border-left-color: #4CAF50;
  }
  
  .day-card.missing {
    border-left-color: #c62828;
    background: rgba(198, 40, 40, 0.1);
  }
  
  .day-card.disabled {
    opacity: 0.5;
    background: #1a1a1a;
  }
  
  .assignment-button {
    min-height: 44px;
    min-width: 44px;
    width: 100%;
    padding: 12px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    color: white;
    cursor: pointer;
    margin-bottom: 8px;
    text-align: left;
  }
  
  .assignment-button:active {
    transform: scale(0.98);
  }
}

/* Desktop - Hide List View */
@media (min-width: 769px) {
  .calendar-list {
    display: none;
  }
}
```

### Phase 2: JavaScript Rendering Functions

Create new function `renderCalendarList(type)`:

```javascript
function renderCalendarList(type) {
  const listContainer = document.getElementById(`${type}-calendar-list`);
  if (!listContainer) return; // Not in mobile view
  
  listContainer.innerHTML = '';
  
  const [year, month] = currentMonth[type].split('-');
  const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;
    const date = new Date(parseInt(year), parseInt(month) - 1, day);
    const dayOfWeek = date.getDay();
    const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    
    // Check if day is allowed
    const isHoliday = allHolidays.includes(dateStr);
    let isAllowed = false;
    
    if (type === 'aufsicht') {
      isAllowed = dayOfWeek === 6; // Saturday only
    } else if (type === 'wirte') {
      isAllowed = dayOfWeek === 0 || dayOfWeek === 6 || isHoliday;
    }
    
    // Create day card
    const card = createDayCard(type, dateStr, day, dayNames[dayOfWeek], isAllowed, isHoliday, dayOfWeek);
    listContainer.appendChild(card);
  }
}
```

Create helper function `createDayCard()`:

```javascript
function createDayCard(type, dateStr, day, dayName, isAllowed, isHoliday, dayOfWeek) {
  const card = document.createElement('div');
  card.className = 'day-card';
  card.dataset.date = dateStr;
  
  if (!isAllowed) {
    card.classList.add('disabled');
  }
  
  // Check for assignments
  const isSaturday = dayOfWeek === 6;
  const hasMultiSlots = type === 'wirte' && isSaturday;
  
  let hasAssignment = false;
  if (hasMultiSlots) {
    const frueh = assignments[type][`${dateStr}-fruehschoppen`];
    const schies = assignments[type][`${dateStr}-schiessabend`];
    hasAssignment = frueh || schies;
  } else {
    hasAssignment = !!assignments[type][dateStr];
  }
  
  if (isAllowed) {
    card.classList.add(hasAssignment ? 'assigned' : 'missing');
  }
  
  // Header
  const header = document.createElement('div');
  header.className = 'day-card-header';
  header.innerHTML = `
    <span class="day-number" style="font-size: 24px; font-weight: bold; color: ${isHoliday ? '#ffa726' : '#4CAF50'};">
      ${day}${isHoliday ? ' 🎉' : ''}
    </span>
    <span class="day-name" style="font-size: 14px; color: #999; margin-left: 8px;">${dayName}</span>
    <span class="day-date" style="font-size: 14px; color: #999; margin-left: auto;">
      ${String(day).padStart(2, '0')}.${currentMonth[type].split('-')[1]}.${currentMonth[type].split('-')[0]}
    </span>
  `;
  header.style.cssText = 'display: flex; align-items: center; margin-bottom: 12px;';
  card.appendChild(header);
  
  // Body with assignments
  const body = document.createElement('div');
  body.className = 'day-card-body';
  
  if (isAllowed) {
    if (hasMultiSlots) {
      // Render both slots
      body.appendChild(createSlotDisplay(type, dateStr, 'fruehschoppen', '☀️ Frühschoppen'));
      body.appendChild(createSlotDisplay(type, dateStr, 'schiessabend', '🌙 Schießabend'));
    } else {
      // Single assignment
      body.appendChild(createAssignmentDisplay(type, dateStr, null));
    }
  } else {
    body.innerHTML = '<div style="color: #666; font-size: 14px;">Keine Einteilung möglich</div>';
  }
  
  card.appendChild(body);
  return card;
}
```

Create helper function `createSlotDisplay()`:

```javascript
function createSlotDisplay(type, dateStr, slot, label) {
  const container = document.createElement('div');
  container.className = 'assignment-display';
  container.dataset.slot = slot;
  container.style.marginBottom = '12px';
  
  const slotLabel = document.createElement('div');
  slotLabel.className = 'slot-label';
  slotLabel.textContent = label;
  slotLabel.style.cssText = 'font-size: 12px; color: #999; margin-bottom: 6px; font-weight: 600;';
  container.appendChild(slotLabel);
  
  const slotKey = `${dateStr}-${slot}`;
  const assignment = assignments[type][slotKey];
  
  if (assignment) {
    const button = createAssignmentButton(type, slotKey, assignment);
    container.appendChild(button);
  } else {
    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = 'padding: 12px; background: rgba(198, 40, 40, 0.2); border-radius: 6px; color: #c62828; font-size: 14px;';
    emptyDiv.textContent = 'Nicht eingeteilt';
    container.appendChild(emptyDiv);
  }
  
  return container;
}
```

Create helper function `createAssignmentDisplay()`:

```javascript
function createAssignmentDisplay(type, dateStr, slot) {
  const container = document.createElement('div');
  container.className = 'assignment-display';
  
  const assignment = assignments[type][dateStr];
  
  if (assignment) {
    const button = createAssignmentButton(type, dateStr, assignment);
    container.appendChild(button);
  } else {
    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = 'padding: 12px; background: rgba(198, 40, 40, 0.2); border-radius: 6px; color: #c62828; font-size: 14px;';
    emptyDiv.textContent = 'Nicht eingeteilt';
    container.appendChild(emptyDiv);
  }
  
  return container;
}
```

Create helper function `createAssignmentButton()`:

```javascript
function createAssignmentButton(type, dateKey, assignment) {
  const button = document.createElement('button');
  button.className = 'assignment-button';
  button.style.background = assignment.color;
  
  if (assignment.swappedWith && assignment.originalPerson) {
    // Swapped assignment
    button.innerHTML = `
      <div style="text-decoration: line-through; opacity: 0.7; margin-bottom: 4px;">
        ${assignment.originalPerson}
      </div>
      <div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-bottom: 4px;">
        Getauscht mit
      </div>
      <div style="font-weight: bold;">
        ${assignment.swappedWith}
      </div>
    `;
  } else {
    button.innerHTML = `<span class="person-name">${assignment.person}</span>`;
  }
  
  button.addEventListener('click', () => {
    openSwapModal(type, dateKey, assignment);
  });
  
  return button;
}
```

### Phase 3: Update Existing Functions

Modify `renderCalendar(type)` to also render list view:

```javascript
function renderCalendar(type) {
  // Existing grid rendering code...
  renderCalendarGrid(type);  // Rename existing logic
  
  // Add list rendering
  renderCalendarList(type);
}
```

Modify `loadAssignments(type)` to trigger both renders:

```javascript
async function loadAssignments(type) {
  // Existing loading code...
  
  renderCalendarGrid(type);
  renderCalendarList(type);
}
```

### Phase 4: Enhance Swap Modal for Mobile

Ensure helper selection buttons are touch-friendly:

```css
@media (max-width: 768px) {
  .helper-option {
    min-height: 44px;
    min-width: 44px;
    padding: 12px;
    font-size: 14px;
  }
  
  .modal-content {
    margin: 10% auto;
    padding: 20px;
    max-width: 90%;
  }
}
```

### Phase 5: Testing and Validation

Test scenarios:
1. Resize browser across 768px breakpoint - verify view switches
2. Tap assignment in list view - verify modal opens
3. Select replacement person - verify swap request created
4. Navigate months - verify list updates correctly
5. Test multi-slot Saturdays - verify both slots display
6. Test swapped assignments - verify display shows both names
7. Test disabled days - verify reduced opacity and no interaction
8. Test holidays - verify emoji and orange color
9. Test PDF download from mobile - verify works correctly
10. Test auto-rotation from mobile - verify assignments appear in list



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies:

- **Criteria 4.3 and 5.1** are identical (tapping assignment opens swap modal) - consolidated into one property
- **Criteria 1.1 and 1.2** are complementary examples of the same viewport switching behavior - kept as examples
- **Criteria 12.2 and 12.3** test the same month navigation behavior in different directions - combined into one property
- **Criteria 13.1 and 13.2** test visual indicators for different states - kept separate as they validate different conditions
- **Requirements 7.x, 8.x (partial), 9.x (partial), 10.x (partial), 11.x** are about maintaining existing functionality, not new testable properties

The following properties provide unique validation value:

### Property 1: View Switching Preserves Assignment Data

*For any* set of assignments and any viewport resize across the 768px breakpoint, all assignment data (person names, colors, dates, slots, swap information) should remain identical before and after the view switch.

**Validates: Requirements 1.4**

### Property 2: View Switching Preserves Month Selection

*For any* selected month and year, when the viewport is resized across the 768px breakpoint, the displayed month and year should remain unchanged.

**Validates: Requirements 1.5**

### Property 3: List View Day Count Matches Month

*For any* month and year, the number of day cards rendered in list view should equal the actual number of days in that month (28-31 depending on month and leap year).

**Validates: Requirements 2.1, 2.7**

### Property 4: All Day Cards Display Required Information

*For any* day card in list view, the card should contain a day number element, a weekday name element, and a full date in DD.MM.YYYY format.

**Validates: Requirements 2.2, 2.3, 2.4**

### Property 5: Holiday Days Display Indicator

*For any* day that is a German holiday, the list view day card should display the 🎉 emoji indicator.

**Validates: Requirements 2.5**

### Property 6: Disabled Days Have Reduced Opacity

*For any* day that is not allowed for assignments (based on calendar type rules), the day card should have opacity less than 1.0 (specifically 0.5 or less).

**Validates: Requirements 2.6**

### Property 7: Person Names Display Without Truncation

*For any* assignment in list view, the person name should be fully visible without text-overflow ellipsis or clipping, regardless of name length.

**Validates: Requirements 3.1**

### Property 8: Long Names Wrap to Multiple Lines

*For any* person name that exceeds the card width, the text should wrap to multiple lines rather than being truncated.

**Validates: Requirements 3.2**

### Property 9: Assignment Buttons Meet Minimum Size

*For any* interactive button in list view (assignment buttons, month navigation, action buttons), the computed dimensions should be at least 44x44 pixels.

**Validates: Requirements 4.1**

### Property 10: Adjacent Touch Targets Have Adequate Spacing

*For any* pair of adjacent interactive elements in list view, the spacing (margin or gap) between them should be at least 8 pixels.

**Validates: Requirements 4.2**

### Property 11: Tapping Assignment Opens Swap Modal

*For any* assignment button in list view, when tapped/clicked, the swap modal should open with the correct assignment context (date, person, slot if applicable).

**Validates: Requirements 4.3, 5.1**

### Property 12: Swap Modal Displays Assignment Details

*For any* opened swap modal, the modal content should include the assignment date, person name, and slot label (if multi-slot day).

**Validates: Requirements 5.2**

### Property 13: Swap Modal Displays Available Replacements

*For any* opened swap modal, the modal should display a list of all persons except the currently assigned person.

**Validates: Requirements 5.3**

### Property 14: Selecting Replacement Creates Swap Request

*For any* replacement person selection in the swap modal, a swap request document should be created in Firebase with status "pending" and the correct date, requesting person, and replacement person.

**Validates: Requirements 5.4**

### Property 15: Multi-Slot Days Show Both Slots

*For any* Saturday in the Wirte calendar list view, the day card should contain two distinct slot sections with labels "☀️ Frühschoppen" and "🌙 Schießabend".

**Validates: Requirements 6.1, 6.2**

### Property 16: Slots Display Assigned Person When Present

*For any* slot that has an assignment, the slot section should display a button containing the assigned person's name.

**Validates: Requirements 6.3**

### Property 17: Empty Slots Display Missing Indicator

*For any* slot that has no assignment, the slot section should display a visual indicator (text or styled element) indicating the slot is not assigned.

**Validates: Requirements 6.4**

### Property 18: Slot Assignment Tap Opens Modal With Slot Context

*For any* slot assignment button tap, the opened swap modal should include the correct slot identifier (fruehschoppen or schiessabend) in its context.

**Validates: Requirements 6.5**

### Property 19: Auto-Rotation Produces Identical Results in Both Views

*For any* calendar state and person list, triggering auto-rotation should produce the same assignment results regardless of whether the current view is grid or list.

**Validates: Requirements 8.1**

### Property 20: PDF Generation Produces Identical Output in Both Views

*For any* calendar state with assignments, generating a PDF from grid view and from list view should produce identical PDF content (same assignments, dates, persons).

**Validates: Requirements 9.5**

### Property 21: Person Modal Functions Identically in Both Views

*For any* person addition operation, the modal should behave identically (same validation, same Firebase save, same UI update) regardless of current view mode.

**Validates: Requirements 10.4**

### Property 22: Month Navigation Updates Display Correctly

*For any* current month, clicking the previous or next month button should update the displayed month by exactly one month (handling year boundaries correctly) and reload the appropriate assignments.

**Validates: Requirements 12.2, 12.3**

### Property 23: Assigned Days Display Green Indicator

*For any* day in list view that has at least one assignment, the day card should display a green border or badge indicator.

**Validates: Requirements 13.1**

### Property 24: Unassigned Allowed Days Display Red Indicator

*For any* day in list view that is allowed for assignments but has no assignment, the day card should display a red border or badge indicator.

**Validates: Requirements 13.2**

### Property 25: Disabled Days Show No Warning Indicator

*For any* disabled day in list view, the day card should have reduced opacity and should not display a red warning indicator.

**Validates: Requirements 13.3**

### Property 26: Multi-Slot Days Show Independent Status Per Slot

*For any* multi-slot day (Saturday in Wirte calendar), each slot should have its own independent status indicator (assigned/missing) based on whether that specific slot has an assignment.

**Validates: Requirements 13.4**

### Property 27: Swapped Assignments Display Replacement Name

*For any* assignment that has been swapped (has swappedWith and originalPerson fields), the list view should display the replacement person's name prominently.

**Validates: Requirements 14.1**

### Property 28: Swapped Assignments Display Original Name With Strikethrough

*For any* assignment that has been swapped, the list view should display the original person's name with strikethrough text decoration.

**Validates: Requirements 14.2**

### Property 29: Swapped Assignments Display Label

*For any* assignment that has been swapped, the list view should display the text "Getauscht mit" between the original and replacement names.

**Validates: Requirements 14.3**

### Property 30: Swap Information Displays Without Truncation

*For any* swapped assignment, all swap information (original name, label, replacement name) should be fully visible without text truncation.

**Validates: Requirements 14.5**

### Property 31: List View Uses Minimum Font Sizes

*For any* text element in list view, body text should have computed font size of at least 14px and day numbers should have computed font size of at least 16px.

**Validates: Requirements 15.1, 15.2**

### Property 32: List View Provides Sufficient Contrast

*For any* text element in list view, the contrast ratio between text color and background color should be at least 4.5:1 (WCAG AA standard).

**Validates: Requirements 15.3**

### Property 33: List View Elements Have Adequate Spacing

*For any* adjacent elements in a day card, the spacing (margin or padding) between them should be at least 8 pixels.

**Validates: Requirements 15.4**



## Error Handling

### Viewport Detection Errors

**Scenario**: Media query not supported or viewport width detection fails

**Handling**:
- Default to grid view (safer fallback for existing users)
- Log warning to console for debugging
- Provide manual view toggle button as fallback (future enhancement)

**Implementation**:
```javascript
function detectViewport() {
  try {
    const width = window.innerWidth || document.documentElement.clientWidth;
    return width <= 768 ? 'list' : 'grid';
  } catch (error) {
    console.warn('Viewport detection failed, defaulting to grid view:', error);
    return 'grid';
  }
}
```

### Rendering Errors

**Scenario**: List view rendering fails due to missing data or DOM errors

**Handling**:
- Catch rendering exceptions
- Display user-friendly error message in list container
- Fall back to grid view if available
- Log detailed error for debugging

**Implementation**:
```javascript
function renderCalendarList(type) {
  try {
    // Rendering logic...
  } catch (error) {
    console.error('List view rendering failed:', error);
    const listContainer = document.getElementById(`${type}-calendar-list`);
    if (listContainer) {
      listContainer.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: #c62828;">
          <p>Fehler beim Laden der Listenansicht.</p>
          <p style="font-size: 0.9rem; color: #999;">Bitte Seite neu laden oder Desktop-Ansicht verwenden.</p>
        </div>
      `;
    }
  }
}
```

### Assignment Data Errors

**Scenario**: Assignment object missing required fields (person, color, date)

**Handling**:
- Validate assignment data before rendering
- Use default values for missing fields
- Display warning indicator on affected day card
- Log data inconsistency

**Implementation**:
```javascript
function validateAssignment(assignment) {
  const defaults = {
    person: 'Unbekannt',
    color: '#999999',
    date: null
  };
  
  if (!assignment) return null;
  
  const validated = { ...defaults, ...assignment };
  
  if (!validated.date) {
    console.warn('Assignment missing date:', assignment);
    return null;
  }
  
  if (assignment.person !== validated.person || assignment.color !== validated.color) {
    console.warn('Assignment data incomplete, using defaults:', assignment);
  }
  
  return validated;
}
```

### Firebase Connection Errors

**Scenario**: Firebase connection lost or query fails

**Handling**:
- Display connection status indicator
- Show cached data if available
- Provide retry button
- Disable interactive features until reconnected

**Implementation**:
```javascript
async function loadAssignments(type) {
  try {
    const snapshot = await getDocs(collection(db, `${type}-assignments`));
    // Process assignments...
  } catch (error) {
    console.error('Firebase query failed:', error);
    
    // Show error banner
    showErrorBanner('Verbindungsfehler. Daten werden möglicherweise nicht aktualisiert.');
    
    // Use cached data if available
    if (cachedAssignments[type]) {
      assignments[type] = cachedAssignments[type];
      renderCalendar(type);
    }
  }
}
```

### Touch Event Errors

**Scenario**: Touch event handlers fail or conflict with other events

**Handling**:
- Use passive event listeners where appropriate
- Prevent default only when necessary
- Gracefully degrade to click events
- Log touch event errors

**Implementation**:
```javascript
function attachTouchHandlers(element, handler) {
  try {
    // Try touch events first
    element.addEventListener('touchstart', handler, { passive: true });
    element.addEventListener('click', handler);
  } catch (error) {
    console.warn('Touch event attachment failed, using click only:', error);
    element.addEventListener('click', handler);
  }
}
```

### Modal Errors

**Scenario**: Swap modal fails to open or display data

**Handling**:
- Validate modal DOM elements exist
- Check assignment data before opening
- Provide fallback UI for swap request
- Log modal errors

**Implementation**:
```javascript
function openSwapModal(type, dateKey, assignment) {
  try {
    const modal = document.getElementById('swap-modal');
    if (!modal) {
      throw new Error('Swap modal element not found');
    }
    
    if (!assignment || !assignment.person) {
      throw new Error('Invalid assignment data');
    }
    
    // Open modal logic...
  } catch (error) {
    console.error('Failed to open swap modal:', error);
    alert('Fehler beim Öffnen des Tausch-Dialogs. Bitte versuchen Sie es erneut.');
  }
}
```

### Date Calculation Errors

**Scenario**: Invalid date strings or month calculations fail

**Handling**:
- Validate date strings before parsing
- Handle edge cases (leap years, month boundaries)
- Default to current month on error
- Log date calculation errors

**Implementation**:
```javascript
function getDaysInMonth(year, month) {
  try {
    const days = new Date(parseInt(year), parseInt(month), 0).getDate();
    if (isNaN(days) || days < 28 || days > 31) {
      throw new Error('Invalid days calculation');
    }
    return days;
  } catch (error) {
    console.error('Date calculation failed:', error);
    return 31; // Safe default
  }
}
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property-based tests**: Verify universal properties across all inputs

Together, these approaches provide comprehensive coverage where unit tests catch concrete bugs and property tests verify general correctness.

### Property-Based Testing

**Library Selection**: Use **fast-check** for JavaScript property-based testing

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: mobile-calendar-list-view, Property {number}: {property_text}`

**Example Property Test**:
```javascript
import fc from 'fast-check';

// Feature: mobile-calendar-list-view, Property 3: List View Day Count Matches Month
test('List view renders correct number of days for any month', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 2024, max: 2026 }), // year
      fc.integer({ min: 1, max: 12 }),      // month
      (year, month) => {
        // Set current month
        currentMonth.wirte = `${year}-${String(month).padStart(2, '0')}`;
        
        // Render list view
        renderCalendarList('wirte');
        
        // Get rendered day cards
        const dayCards = document.querySelectorAll('#wirte-calendar-list .day-card');
        
        // Calculate expected days
        const expectedDays = new Date(year, month, 0).getDate();
        
        // Verify count matches
        expect(dayCards.length).toBe(expectedDays);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property Test Coverage**:

Each of the 33 correctness properties should have a corresponding property-based test:

1. **Property 1-2**: View switching tests with random assignments and months
2. **Property 3-6**: List view structure tests with random months and dates
3. **Property 7-8**: Name display tests with randomly generated long names
4. **Property 9-10**: Touch target size tests across all interactive elements
5. **Property 11-14**: Swap modal tests with random assignments
6. **Property 15-18**: Multi-slot tests with random Saturday dates
7. **Property 19-21**: Cross-view consistency tests with random data
8. **Property 22**: Month navigation tests with random starting months
9. **Property 23-26**: Visual indicator tests with random assignment states
10. **Property 27-30**: Swap display tests with random swapped assignments
11. **Property 31-33**: Accessibility tests with random content

**Generators for Property Tests**:

```javascript
// Generate random person
const personArbitrary = fc.record({
  name: fc.string({ minLength: 5, maxLength: 50 }),
  color: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`)
});

// Generate random assignment
const assignmentArbitrary = fc.record({
  date: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') })
    .map(d => d.toISOString().split('T')[0]),
  person: fc.string({ minLength: 5, maxLength: 50 }),
  color: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`),
  slot: fc.option(fc.constantFrom('fruehschoppen', 'schiessabend'), { nil: null })
});

// Generate random viewport width
const viewportArbitrary = fc.integer({ min: 320, max: 1920 });

// Generate random month
const monthArbitrary = fc.record({
  year: fc.integer({ min: 2024, max: 2026 }),
  month: fc.integer({ min: 1, max: 12 })
});
```

### Unit Testing

**Framework**: Jest with jsdom for DOM testing

**Test Categories**:

1. **Responsive Switching Tests**
   - Test viewport at exactly 768px
   - Test viewport at 767px (mobile)
   - Test viewport at 769px (desktop)
   - Test resize event handling

2. **List View Rendering Tests**
   - Test rendering empty month
   - Test rendering month with all days assigned
   - Test rendering month with some days assigned
   - Test rendering February in leap year
   - Test rendering February in non-leap year
   - Test rendering month with holidays

3. **Day Card Tests**
   - Test disabled day rendering
   - Test assigned day rendering
   - Test missing assignment day rendering
   - Test holiday day rendering
   - Test multi-slot Saturday rendering
   - Test single-slot day rendering

4. **Assignment Display Tests**
   - Test normal assignment display
   - Test swapped assignment display
   - Test empty slot display
   - Test long name wrapping
   - Test name truncation prevention

5. **Touch Interaction Tests**
   - Test assignment button tap
   - Test modal opening
   - Test replacement selection
   - Test modal closing
   - Test month navigation taps

6. **Multi-Slot Tests**
   - Test Saturday with both slots assigned
   - Test Saturday with one slot assigned
   - Test Saturday with no slots assigned
   - Test slot-specific swap modal

7. **Cross-View Tests**
   - Test data preservation on view switch
   - Test month preservation on view switch
   - Test auto-rotation in both views
   - Test PDF generation in both views
   - Test person addition in both views

8. **Error Handling Tests**
   - Test rendering with missing data
   - Test rendering with invalid dates
   - Test Firebase connection failure
   - Test modal with invalid assignment
   - Test viewport detection failure

9. **Accessibility Tests**
   - Test minimum font sizes
   - Test contrast ratios
   - Test touch target sizes
   - Test spacing between elements
   - Test keyboard navigation (future)

10. **Edge Cases**
    - Test month boundary navigation (Dec to Jan, Jan to Dec)
    - Test leap year February
    - Test very long person names (50+ characters)
    - Test rapid view switching
    - Test multiple simultaneous swap requests

**Example Unit Tests**:

```javascript
describe('List View Rendering', () => {
  test('renders correct number of days for January 2025', () => {
    currentMonth.wirte = '2025-01';
    renderCalendarList('wirte');
    
    const dayCards = document.querySelectorAll('#wirte-calendar-list .day-card');
    expect(dayCards.length).toBe(31);
  });
  
  test('renders correct number of days for February 2024 (leap year)', () => {
    currentMonth.wirte = '2024-02';
    renderCalendarList('wirte');
    
    const dayCards = document.querySelectorAll('#wirte-calendar-list .day-card');
    expect(dayCards.length).toBe(29);
  });
  
  test('disabled days have reduced opacity', () => {
    currentMonth.wirte = '2025-01';
    renderCalendarList('wirte');
    
    // Monday (day 6) should be disabled in Wirte calendar
    const mondayCard = document.querySelector('[data-date="2025-01-06"]');
    const opacity = window.getComputedStyle(mondayCard).opacity;
    expect(parseFloat(opacity)).toBeLessThanOrEqual(0.5);
  });
});

describe('Touch Target Sizes', () => {
  test('assignment buttons meet 44x44px minimum', () => {
    // Setup assignment
    assignments.wirte['2025-01-04'] = {
      person: 'Max Mustermann',
      color: '#4CAF50',
      date: '2025-01-04'
    };
    
    currentMonth.wirte = '2025-01';
    renderCalendarList('wirte');
    
    const buttons = document.querySelectorAll('.assignment-button');
    buttons.forEach(button => {
      const rect = button.getBoundingClientRect();
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    });
  });
});

describe('Swap Modal', () => {
  test('opens with correct assignment details', () => {
    const assignment = {
      person: 'Max Mustermann',
      color: '#4CAF50',
      date: '2025-01-04'
    };
    
    openSwapModal('wirte', '2025-01-04', assignment);
    
    const modal = document.getElementById('swap-modal');
    expect(modal.style.display).toBe('block');
    
    const info = document.getElementById('swap-modal-info');
    expect(info.textContent).toContain('Max Mustermann');
  });
  
  test('displays all replacement options except current person', () => {
    persons.wirte = [
      { name: 'Max Mustermann', color: '#4CAF50' },
      { name: 'Anna Schmidt', color: '#2196F3' },
      { name: 'Peter Müller', color: '#FF9800' }
    ];
    
    const assignment = {
      person: 'Max Mustermann',
      color: '#4CAF50',
      date: '2025-01-04'
    };
    
    openSwapModal('wirte', '2025-01-04', assignment);
    
    const options = document.querySelectorAll('.helper-option');
    expect(options.length).toBe(2);
    expect(Array.from(options).map(o => o.textContent)).toEqual([
      'Anna Schmidt',
      'Peter Müller'
    ]);
  });
});

describe('Multi-Slot Days', () => {
  test('Saturday shows both slot sections in Wirte calendar', () => {
    currentMonth.wirte = '2025-01';
    renderCalendarList('wirte');
    
    // January 4, 2025 is a Saturday
    const saturdayCard = document.querySelector('[data-date="2025-01-04"]');
    const slots = saturdayCard.querySelectorAll('.assignment-display');
    
    expect(slots.length).toBe(2);
    
    const labels = Array.from(slots).map(s => 
      s.querySelector('.slot-label').textContent
    );
    expect(labels).toEqual(['☀️ Frühschoppen', '🌙 Schießabend']);
  });
});
```

### Integration Testing

**Scenarios**:

1. **Complete Swap Workflow**
   - User taps assignment in list view
   - Modal opens with correct data
   - User selects replacement
   - Swap request created in Firebase
   - List view updates to show swap

2. **Month Navigation Flow**
   - User navigates to next month
   - Assignments load from Firebase
   - List view renders new month
   - User navigates back
   - Previous month restored

3. **View Switching Flow**
   - User resizes window from desktop to mobile
   - Grid view hides, list view shows
   - All data preserved
   - User resizes back to desktop
   - Grid view restored with same data

4. **Auto-Rotation Flow**
   - User triggers auto-rotation in list view
   - Assignments created for allowed days
   - List view updates with new assignments
   - Firebase contains all new assignments

### Manual Testing Checklist

- [ ] Test on actual mobile devices (iOS Safari, Android Chrome)
- [ ] Test touch interactions (tap, scroll, pinch-zoom disabled)
- [ ] Test in landscape and portrait orientations
- [ ] Test with very long person names (30+ characters)
- [ ] Test with maximum assignments (all days filled)
- [ ] Test with no assignments (empty calendar)
- [ ] Test month navigation across year boundaries
- [ ] Test PDF download from mobile view
- [ ] Test person addition from mobile view
- [ ] Test swap workflow end-to-end
- [ ] Test with slow network connection
- [ ] Test with Firebase offline
- [ ] Test accessibility with screen reader (future)
- [ ] Test with browser zoom at 200%
- [ ] Test rapid view switching (resize window quickly)

### Performance Testing

**Metrics to Monitor**:

- List view render time (should be < 100ms for 31 days)
- View switch time (should be instant via CSS)
- Modal open time (should be < 50ms)
- Firebase query time (existing, should remain unchanged)
- Memory usage (should not increase significantly)

**Performance Tests**:

```javascript
describe('Performance', () => {
  test('list view renders within 100ms', () => {
    currentMonth.wirte = '2025-01';
    
    const start = performance.now();
    renderCalendarList('wirte');
    const end = performance.now();
    
    expect(end - start).toBeLessThan(100);
  });
  
  test('view switching is instant (CSS only)', () => {
    // Both views should already be rendered
    renderCalendarGrid('wirte');
    renderCalendarList('wirte');
    
    const start = performance.now();
    // Simulate viewport change (CSS media query handles visibility)
    window.innerWidth = 500;
    window.dispatchEvent(new Event('resize'));
    const end = performance.now();
    
    // Should be nearly instant (< 10ms) since it's just CSS
    expect(end - start).toBeLessThan(10);
  });
});
```

### Test Coverage Goals

- **Line Coverage**: Minimum 80% for new code
- **Branch Coverage**: Minimum 75% for new code
- **Property Test Coverage**: 100% of correctness properties
- **Unit Test Coverage**: All edge cases and error conditions
- **Integration Test Coverage**: All user workflows

### Continuous Testing

- Run unit tests on every commit
- Run property tests on every pull request
- Run integration tests before deployment
- Run manual tests on actual devices before release
- Monitor error logs in production for unexpected issues

