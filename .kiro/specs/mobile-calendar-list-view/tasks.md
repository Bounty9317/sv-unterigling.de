# Implementation Plan: Mobile Calendar List View

## Overview

This implementation adds a responsive mobile-optimized list view to the Helfer Dashboard calendar system. The approach uses CSS media queries for automatic view switching at 768px breakpoint, JavaScript rendering functions for the vertical day card list, and enhanced touch-friendly interactions. All changes are made to the single file `helfer-dashboard.html`, preserving the existing desktop grid view and all features (auto-rotation, PDF download, Firebase sync, person management).

## Tasks

- [x] 1. Add CSS media queries and list view styles
  - Add media query to hide grid view and show list view on mobile (≤768px)
  - Add media query to hide list view and show grid view on desktop (>768px)
  - Add `.calendar-list` container styles (vertical layout, full width)
  - Add `.day-card` styles with border, padding, border-radius
  - Add `.day-card.assigned` style with green left border (#4CAF50)
  - Add `.day-card.missing` style with red left border (#c62828) and background tint
  - Add `.day-card.disabled` style with reduced opacity (0.5) and dark background
  - Add `.day-card-header` styles for day info section
  - Add `.day-card-body` styles for assignment display area
  - Add `.assignment-button` styles with minimum 44x44px touch target
  - Add `.assignment-display` styles for slot sections
  - Add `.slot-label` styles for multi-slot labels
  - Add button active state with scale transform for touch feedback
  - Add spacing styles (8px minimum between elements)
  - Ensure month navigation buttons are 44x44px minimum on mobile
  - Ensure swap modal helper options are 44x44px minimum on mobile
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.5, 15.1, 15.2, 15.3, 15.4_

- [x] 2. Create list view HTML containers
  - Add `<div id="wirte-calendar-list" class="calendar-list"></div>` after wirte grid
  - Add `<div id="aufsicht-calendar-list" class="calendar-list"></div>` after aufsicht grid
  - Ensure containers are initially empty (populated by JavaScript)
  - _Requirements: 2.1_

- [ ] 3. Implement core list view rendering functions
  - [x] 3.1 Implement `renderCalendarList(type)` function
    - Get list container element by ID
    - Extract year and month from `currentMonth[type]`
    - Calculate days in month using `new Date(year, month, 0).getDate()`
    - Loop through days 1 to daysInMonth
    - For each day, determine date string, day of week, and day name
    - Check if day is holiday using `allHolidays.includes(dateStr)`
    - Determine if day is allowed based on calendar type rules
    - Call `createDayCard()` for each day and append to container
    - _Requirements: 2.1, 2.7_
  
  - [x] 3.2 Implement `createDayCard(type, dateStr, day, dayName, isAllowed, isHoliday, dayOfWeek)` function
    - Create div element with class `day-card` and data-date attribute
    - Add `disabled` class if day is not allowed
    - Check for assignments (handle multi-slot Saturdays separately)
    - Add `assigned` or `missing` class based on assignment status
    - Create header section with day number, day name, and full date
    - Style day number with larger font (24px) and green color (#4CAF50)
    - Add 🎉 emoji to day number if holiday, use orange color (#ffa726)
    - Create body section for assignments
    - For multi-slot days, call `createSlotDisplay()` for each slot
    - For single-slot days, call `createAssignmentDisplay()`
    - For disabled days, show "Keine Einteilung möglich" message
    - Return completed card element
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 13.1, 13.2, 13.3_
  
  - [x] 3.3 Implement `createSlotDisplay(type, dateStr, slot, label)` function
    - Create container div with class `assignment-display` and data-slot attribute
    - Create slot label element with emoji and text (☀️ Frühschoppen or 🌙 Schießabend)
    - Build slot key as `${dateStr}-${slot}`
    - Get assignment from `assignments[type][slotKey]`
    - If assignment exists, call `createAssignmentButton()` and append
    - If no assignment, create empty div with red background and "Nicht eingeteilt" text
    - Return container element
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 13.4_
  
  - [x] 3.4 Implement `createAssignmentDisplay(type, dateStr, slot)` function
    - Create container div with class `assignment-display`
    - Get assignment from `assignments[type][dateStr]`
    - If assignment exists, call `createAssignmentButton()` and append
    - If no assignment, create empty div with red background and "Nicht eingeteilt" text
    - Return container element
    - _Requirements: 3.1, 13.1, 13.2_
  
  - [x] 3.5 Implement `createAssignmentButton(type, dateKey, assignment)` function
    - Create button element with class `assignment-button`
    - Set background color to assignment.color
    - Check if assignment is swapped (has swappedWith and originalPerson)
    - For swapped assignments, create three-line display: original name with strikethrough, "Getauscht mit" label, replacement name in bold
    - For normal assignments, display person name in span
    - Add click event listener to call `openSwapModal(type, dateKey, assignment)`
    - Return button element
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.3, 14.1, 14.2, 14.3, 14.5_

- [ ] 4. Update existing rendering functions to support both views
  - [x] 4.1 Refactor existing calendar rendering code
    - Rename current `renderCalendar(type)` logic to `renderCalendarGrid(type)` (or extract grid-specific code)
    - Ensure `renderCalendarGrid(type)` only renders the grid view
    - Keep all existing grid rendering logic unchanged
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [x] 4.2 Update `renderCalendar(type)` to render both views
    - Call `renderCalendarGrid(type)` to render grid view
    - Call `renderCalendarList(type)` to render list view
    - Both views should be rendered; CSS controls visibility
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 4.3 Update `loadAssignments(type)` to trigger both renders
    - After loading assignments from Firebase, call `renderCalendar(type)`
    - Ensure both grid and list views are updated
    - _Requirements: 11.1, 11.2, 11.4_

- [x] 5. Enhance swap modal for mobile touch targets
  - Update swap modal helper option rendering to ensure 44x44px minimum size
  - Ensure adequate spacing between helper options (8px minimum)
  - Verify modal opens correctly when assignment button is tapped in list view
  - Ensure modal displays assignment details (date, person, slot if applicable)
  - Ensure modal displays all available replacement persons except current person
  - Verify swap request creation works identically from list view
  - _Requirements: 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 6. Implement error handling for list view
  - Add try-catch block in `renderCalendarList()` to handle rendering errors
  - Display user-friendly error message in list container on failure
  - Add validation in `createDayCard()` for invalid date parameters
  - Add validation in `createAssignmentButton()` for missing assignment data
  - Use default values for missing assignment fields (person: 'Unbekannt', color: '#666')
  - Log errors to console for debugging
  - _Requirements: 1.4, 11.4_

- [x] 7. Checkpoint - Test basic list view rendering
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Write property-based tests for view switching
  - [x] 8.1 Write property test for Property 1: View Switching Preserves Assignment Data
    - **Property 1: View Switching Preserves Assignment Data**
    - **Validates: Requirements 1.4**
    - Use fast-check to generate random assignments
    - Simulate viewport resize across 768px breakpoint
    - Verify all assignment data identical before and after switch
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 1"
  
  - [~] 8.2 Write property test for Property 2: View Switching Preserves Month Selection
    - **Property 2: View Switching Preserves Month Selection**
    - **Validates: Requirements 1.5**
    - Use fast-check to generate random month/year combinations
    - Simulate viewport resize across 768px breakpoint
    - Verify displayed month and year unchanged
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 2"

- [ ] 9. Write property-based tests for list view structure
  - [~] 9.1 Write property test for Property 3: List View Day Count Matches Month
    - **Property 3: List View Day Count Matches Month**
    - **Validates: Requirements 2.1, 2.7**
    - Use fast-check to generate random year/month combinations
    - Render list view and count day cards
    - Verify count equals actual days in month (28-31)
    - Handle leap years correctly
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 3"
  
  - [~] 9.2 Write property test for Property 4: All Day Cards Display Required Information
    - **Property 4: All Day Cards Display Required Information**
    - **Validates: Requirements 2.2, 2.3, 2.4**
    - Use fast-check to generate random dates
    - Render day card and verify presence of day number, weekday name, full date
    - Verify date format is DD.MM.YYYY
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 4"
  
  - [~] 9.3 Write property test for Property 5: Holiday Days Display Indicator
    - **Property 5: Holiday Days Display Indicator**
    - **Validates: Requirements 2.5**
    - Use fast-check to generate random dates including holidays
    - Render day card for holiday dates
    - Verify 🎉 emoji is present
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 5"
  
  - [~] 9.4 Write property test for Property 6: Disabled Days Have Reduced Opacity
    - **Property 6: Disabled Days Have Reduced Opacity**
    - **Validates: Requirements 2.6**
    - Use fast-check to generate random dates
    - Render day cards for disabled days (based on calendar type rules)
    - Verify computed opacity is ≤ 0.5
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 6"

- [ ] 10. Write property-based tests for name display
  - [~] 10.1 Write property test for Property 7: Person Names Display Without Truncation
    - **Property 7: Person Names Display Without Truncation**
    - **Validates: Requirements 3.1**
    - Use fast-check to generate random person names (5-50 characters)
    - Render assignment with name
    - Verify no text-overflow ellipsis or clipping
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 7"
  
  - [~] 10.2 Write property test for Property 8: Long Names Wrap to Multiple Lines
    - **Property 8: Long Names Wrap to Multiple Lines**
    - **Validates: Requirements 3.2**
    - Use fast-check to generate long person names (30-50 characters)
    - Render assignment in narrow viewport
    - Verify text wraps to multiple lines
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 8"

- [ ] 11. Write property-based tests for touch targets
  - [~] 11.1 Write property test for Property 9: Assignment Buttons Meet Minimum Size
    - **Property 9: Assignment Buttons Meet Minimum Size**
    - **Validates: Requirements 4.1**
    - Use fast-check to generate random assignments
    - Render assignment buttons in list view
    - Verify computed dimensions are ≥ 44x44px
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 9"
  
  - [~] 11.2 Write property test for Property 10: Adjacent Touch Targets Have Adequate Spacing
    - **Property 10: Adjacent Touch Targets Have Adequate Spacing**
    - **Validates: Requirements 4.2**
    - Use fast-check to generate random multi-slot days
    - Render day card with multiple buttons
    - Verify spacing between adjacent buttons is ≥ 8px
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 10"

- [ ] 12. Write property-based tests for swap modal
  - [~] 12.1 Write property test for Property 11: Tapping Assignment Opens Swap Modal
    - **Property 11: Tapping Assignment Opens Swap Modal**
    - **Validates: Requirements 4.3, 5.1**
    - Use fast-check to generate random assignments
    - Simulate tap on assignment button
    - Verify modal opens with correct context
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 11"
  
  - [~] 12.2 Write property test for Property 12: Swap Modal Displays Assignment Details
    - **Property 12: Swap Modal Displays Assignment Details**
    - **Validates: Requirements 5.2**
    - Use fast-check to generate random assignments
    - Open swap modal
    - Verify modal contains date, person name, slot label
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 12"
  
  - [~] 12.3 Write property test for Property 13: Swap Modal Displays Available Replacements
    - **Property 13: Swap Modal Displays Available Replacements**
    - **Validates: Requirements 5.3**
    - Use fast-check to generate random person lists
    - Open swap modal for assignment
    - Verify all persons except current are displayed
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 13"
  
  - [~] 12.4 Write property test for Property 14: Selecting Replacement Creates Swap Request
    - **Property 14: Selecting Replacement Creates Swap Request**
    - **Validates: Requirements 5.4**
    - Use fast-check to generate random assignments and replacements
    - Select replacement person in modal
    - Verify swap request created in Firebase with correct data
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 14"

- [ ] 13. Write property-based tests for multi-slot days
  - [~] 13.1 Write property test for Property 15: Multi-Slot Days Show Both Slots
    - **Property 15: Multi-Slot Days Show Both Slots**
    - **Validates: Requirements 6.1, 6.2**
    - Use fast-check to generate random Saturday dates
    - Render day card for Wirte calendar
    - Verify two slot sections with correct labels
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 15"
  
  - [~] 13.2 Write property test for Property 16: Slots Display Assigned Person When Present
    - **Property 16: Slots Display Assigned Person When Present**
    - **Validates: Requirements 6.3**
    - Use fast-check to generate random slot assignments
    - Render slot with assignment
    - Verify button contains person name
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 16"
  
  - [~] 13.3 Write property test for Property 17: Empty Slots Display Missing Indicator
    - **Property 17: Empty Slots Display Missing Indicator**
    - **Validates: Requirements 6.4**
    - Use fast-check to generate random Saturday dates
    - Render slot without assignment
    - Verify missing indicator is displayed
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 17"
  
  - [~] 13.4 Write property test for Property 18: Slot Assignment Tap Opens Modal With Slot Context
    - **Property 18: Slot Assignment Tap Opens Modal With Slot Context**
    - **Validates: Requirements 6.5**
    - Use fast-check to generate random slot assignments
    - Simulate tap on slot button
    - Verify modal includes correct slot identifier
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 18"

- [~] 14. Checkpoint - Test multi-slot functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Write property-based tests for cross-view consistency
  - [~] 15.1 Write property test for Property 19: Auto-Rotation Produces Identical Results in Both Views
    - **Property 19: Auto-Rotation Produces Identical Results in Both Views**
    - **Validates: Requirements 8.1**
    - Use fast-check to generate random person lists
    - Trigger auto-rotation in grid view, capture results
    - Trigger auto-rotation in list view with same data, capture results
    - Verify results are identical
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 19"
  
  - [~] 15.2 Write property test for Property 20: PDF Generation Produces Identical Output in Both Views
    - **Property 20: PDF Generation Produces Identical Output in Both Views**
    - **Validates: Requirements 9.5**
    - Use fast-check to generate random assignments
    - Generate PDF from grid view, capture content
    - Generate PDF from list view, capture content
    - Verify PDF content is identical
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 20"
  
  - [~] 15.3 Write property test for Property 21: Person Modal Functions Identically in Both Views
    - **Property 21: Person Modal Functions Identically in Both Views**
    - **Validates: Requirements 10.4**
    - Use fast-check to generate random person data
    - Add person from grid view, capture result
    - Add person from list view, capture result
    - Verify behavior is identical
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 21"

- [ ] 16. Write property-based tests for navigation and indicators
  - [~] 16.1 Write property test for Property 22: Month Navigation Updates Display Correctly
    - **Property 22: Month Navigation Updates Display Correctly**
    - **Validates: Requirements 12.2, 12.3**
    - Use fast-check to generate random starting months
    - Click next/previous month buttons
    - Verify month updates by exactly one month
    - Verify year boundaries handled correctly
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 22"
  
  - [~] 16.2 Write property test for Property 23: Assigned Days Display Green Indicator
    - **Property 23: Assigned Days Display Green Indicator**
    - **Validates: Requirements 13.1**
    - Use fast-check to generate random assignments
    - Render day card with assignment
    - Verify green border or badge is present
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 23"
  
  - [~] 16.3 Write property test for Property 24: Unassigned Allowed Days Display Red Indicator
    - **Property 24: Unassigned Allowed Days Display Red Indicator**
    - **Validates: Requirements 13.2**
    - Use fast-check to generate random allowed dates without assignments
    - Render day card
    - Verify red border or badge is present
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 24"
  
  - [~] 16.4 Write property test for Property 25: Disabled Days Show No Warning Indicator
    - **Property 25: Disabled Days Show No Warning Indicator**
    - **Validates: Requirements 13.3**
    - Use fast-check to generate random disabled dates
    - Render day card
    - Verify no red warning indicator
    - Verify reduced opacity
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 25"
  
  - [~] 16.5 Write property test for Property 26: Multi-Slot Days Show Independent Status Per Slot
    - **Property 26: Multi-Slot Days Show Independent Status Per Slot**
    - **Validates: Requirements 13.4**
    - Use fast-check to generate random Saturday assignments (some slots filled, some empty)
    - Render multi-slot day card
    - Verify each slot has independent status indicator
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 26"

- [ ] 17. Write property-based tests for swapped assignments
  - [~] 17.1 Write property test for Property 27: Swapped Assignments Display Replacement Name
    - **Property 27: Swapped Assignments Display Replacement Name**
    - **Validates: Requirements 14.1**
    - Use fast-check to generate random swapped assignments
    - Render assignment button
    - Verify replacement person name is displayed prominently
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 27"
  
  - [~] 17.2 Write property test for Property 28: Swapped Assignments Display Original Name With Strikethrough
    - **Property 28: Swapped Assignments Display Original Name With Strikethrough**
    - **Validates: Requirements 14.2**
    - Use fast-check to generate random swapped assignments
    - Render assignment button
    - Verify original name has strikethrough decoration
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 28"
  
  - [~] 17.3 Write property test for Property 29: Swapped Assignments Display Label
    - **Property 29: Swapped Assignments Display Label**
    - **Validates: Requirements 14.3**
    - Use fast-check to generate random swapped assignments
    - Render assignment button
    - Verify "Getauscht mit" label is present
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 29"
  
  - [~] 17.4 Write property test for Property 30: Swap Information Displays Without Truncation
    - **Property 30: Swap Information Displays Without Truncation**
    - **Validates: Requirements 14.5**
    - Use fast-check to generate random swapped assignments with long names
    - Render assignment button
    - Verify all swap information is fully visible
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 30"

- [ ] 18. Write property-based tests for accessibility
  - [~] 18.1 Write property test for Property 31: List View Uses Minimum Font Sizes
    - **Property 31: List View Uses Minimum Font Sizes**
    - **Validates: Requirements 15.1, 15.2**
    - Use fast-check to generate random day cards
    - Render list view
    - Verify body text font size ≥ 14px
    - Verify day numbers font size ≥ 16px
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 31"
  
  - [~] 18.2 Write property test for Property 32: List View Provides Sufficient Contrast
    - **Property 32: List View Provides Sufficient Contrast**
    - **Validates: Requirements 15.3**
    - Use fast-check to generate random color combinations
    - Render text elements with colors
    - Calculate contrast ratio
    - Verify ratio ≥ 4.5:1 (WCAG AA)
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 32"
  
  - [~] 18.3 Write property test for Property 33: List View Elements Have Adequate Spacing
    - **Property 33: List View Elements Have Adequate Spacing**
    - **Validates: Requirements 15.4**
    - Use fast-check to generate random day cards
    - Render list view
    - Measure spacing between adjacent elements
    - Verify spacing ≥ 8px
    - Run with minimum 100 iterations
    - Tag: "Feature: mobile-calendar-list-view, Property 33"

- [ ] 19. Write unit tests for edge cases
  - [~] 19.1 Write unit test for February in leap year (29 days)
    - Test list view renders exactly 29 day cards for February 2024
  
  - [~] 19.2 Write unit test for February in non-leap year (28 days)
    - Test list view renders exactly 28 day cards for February 2025
  
  - [~] 19.3 Write unit test for month boundary navigation
    - Test navigation from December to January (year increment)
    - Test navigation from January to December (year decrement)
  
  - [~] 19.4 Write unit test for very long person names
    - Test name with 50+ characters wraps correctly
    - Test no horizontal scrolling occurs
  
  - [~] 19.5 Write unit test for rapid view switching
    - Test multiple rapid viewport resizes
    - Verify no rendering errors or data loss
  
  - [~] 19.6 Write unit test for missing assignment data
    - Test rendering with assignment missing person field
    - Verify default value "Unbekannt" is used
  
  - [~] 19.7 Write unit test for invalid date strings
    - Test rendering with malformed date strings
    - Verify error handling prevents crashes
  
  - [~] 19.8 Write unit test for viewport at exactly 768px
    - Test which view is displayed at breakpoint
    - Verify consistent behavior

- [x] 20. Final checkpoint and integration testing
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All implementation is in the single file `helfer-dashboard.html`
- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties (33 total)
- Unit tests validate specific examples and edge cases
- Both grid and list views are rendered; CSS controls visibility
- Desktop grid view remains completely unchanged
- All existing features (auto-rotation, PDF, Firebase, person management) are preserved
