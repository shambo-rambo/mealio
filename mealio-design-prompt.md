# Mealio — AI Design Prompt

## App overview
Mealio is a family meal planning PWA (Progressive Web App). It runs in the browser and is installed to the iOS/Android home screen like a native app. The primary users are families planning meals and shopping together.

**Brand colour:** `#2D7D46` (green)
**Platform:** Mobile-first (iOS + Android home screen install). Also usable on desktop.
**Navigation:** Bottom tab bar with 4 tabs — Shopping, Recipes, Meal Plan, Family

---

## Screens to design

### 1. Login
Email and password fields. "Sign in" button. Link to register. App logo centred above the form.

### 2. Register
Name, email, password fields. "Create account" button. Link to login.

### 3. Family setup (first-time onboarding)
Shown once after registering. Two choices: "Create a family" (text input for family name) or "Join with a code" (6-digit code input). Full-screen onboarding card style.

---

### 4. Shopping — Lists index
List of all family shopping lists. Each row shows the list name and item count. A "New list" button. This is the landing tab.

### 5. Shopping — List detail
The most-used screen in the app. Layout:
- Header: list name, toggle between "All items" view and per-store tabs (e.g. Coles, Woolworths)
- Body: items grouped by food category (Produce, Dairy, Meat, Bakery, etc.). Each category has a section header. Unchecked items appear first; checked (ticked) items appear at the bottom with a strikethrough style.
- Each item row shows: checkbox, item name, quantity. Tap checkbox to check off. Swipe left to delete.
- Sticky bottom bar: text input to add a new item, barcode camera icon button on the right.

### 6. Shopping — Item detail (bottom sheet)
Slides up from the bottom when editing an item. Fields: name, quantity, package size, category (dropdown), store (dropdown), price, note, photo upload. "Save" button.

### 7. Shopping — Barcode scanner
Full-screen camera modal with a rectangular scan guide overlay. Cancel button. Decodes a barcode and fills the item name.

### 8. Shopping — Quick-add (public, no login)
A minimal shareable page. Shows the list name. One large text input. One "Add" button. No navigation, no login required.

---

### 9. Recipes — Library
Browseable grid of recipe cards. Filter bar at the top: search field, horizontal scrolling collection pills, dietary tag chips (Vegetarian, Vegan, Gluten Free, Dairy Free, Nut Free), meal label filter (Breakfast / Lunch / Dinner).

Each recipe card shows: photo thumbnail, recipe title, prep + cook time, star rating, dietary tag chips.

### 10. Recipes — Recipe detail
Full recipe page. Sections (scrollable):
- Hero image with title overlaid or below
- Meta row: prep time, cook time, servings count, average star rating
- Scaling controls: +/− stepper to change servings; a "scale by ingredient" toggle
- Ingredients list: quantity, unit, ingredient name. Quantities update live when servings change. Rounded values show a ~ prefix.
- Steps list: numbered method steps
- Nutrition panel: calories, protein, carbs, fat per serving
- Dietary tags: editable chips
- Collections: which collections this recipe belongs to
- Notes: user's own free-text notes
- Floating "Cook mode" button (prominent CTA)

### 11. Recipes — Cook mode
Full-screen, distraction-free. Shows one step at a time in large readable text. Step counter (e.g. "Step 3 of 8"). Progress bar at top. Back / forward buttons. An "Ingredients" button that reveals a summary panel. Screen stays on (wake lock).

### 12. Recipes — Import
Three-tab interface: URL, Photo, Text paste.
- URL tab: large URL input field, "Import" button
- Photo tab: camera viewfinder / file picker to photograph a recipe
- Text tab: large multiline text area, "Import" button
Loading state: pulsing skeleton while AI processes. Then navigates to the review screen.

### 13. Recipes — Post-import review / Create recipe
A form with all recipe fields pre-filled (on import) or blank (on manual create). Fields: title, source URL, photo, servings, prep time, cook time, ingredients (editable list with add/remove rows), steps (editable numbered list with add/remove), dietary tags, nutrition (shown as read-only AI estimate). "Save recipe" button at bottom.

---

### 14. Meal Plan — Week view
7-column calendar grid for the current week. Each day cell shows: date number, and up to 3 meal slots (Breakfast / Lunch / Dinner) as small labelled chips or rows — showing the recipe name or note text, truncated. Current day is highlighted. Swipe horizontally to move to next/previous week. Tap any day cell to open day detail.

### 15. Meal Plan — Month view
Standard monthly calendar grid. Each day shows dot indicators for meals planned. Tap a day to open day detail. Toggle between week and month view at the top.

### 16. Meal Plan — Day detail (bottom sheet or full page)
Shows all meals for the selected day in order: Breakfast, Lunch, Dinner. Each entry shows a coloured label badge, the recipe name or note text, and an "Add to list" icon button. A separate day note field at the bottom. "Add meal" and "Add note" buttons.

### 17. Meal Plan — Add meal sheet (bottom sheet)
Step 1: Select meal label — Breakfast, Lunch, or Dinner (three large tappable options).
Step 2: Either search and pick a recipe from the library (with thumbnails), or type a free-text note.
Step 3: Optional recurrence toggle — if on, show frequency options (Daily / Weekly / Fortnightly / Specific days of week) with a day-of-week multi-select.
"Add to plan" confirm button.

### 18. Meal Plan — Ingredient pull sheet (bottom sheet)
Triggered by tapping "Add to list" on a meal plan entry. Shows:
- Recipe name + photo at top
- Serving scaler
- Checklist of all ingredients (all pre-ticked). User unticks what they already have.
- Dropdown to choose which shopping list to add to
- "Add to list" button

---

### 19. Family — Family page
Shows: family name (editable inline by admin). Member list — each row has avatar, name, role badge (Owner / Admin / Member). Overflow menu per row for admins (Remove, Change role). "Invite member" button.

### 20. Family — Invite (bottom sheet)
Three tabs: Share link (URL with copy button), Show code (large 6-digit code with copy button and TTL countdown), Invite by email (email input + send button).

### 21. Family — Join family
A 6-digit code entry input (six individual digit boxes). Auto-submit when all six digits are entered. Or auto-filled from an invite link.

### 22. Family — Store management
Settings-style list of stores (e.g. Coles, Woolworths, Farmers Market). Each row: store name, edit/delete actions. "Add store" row at the bottom.

---

### 23. Settings
Profile section at top: avatar, name (editable), email. Below: notification preferences toggle. Sign out button. (Family settings link back to the Family page.)

---

## Shared / reusable components

### Bottom sheet
A modal panel that slides up from the bottom of the screen. Drag handle at the top. Dims the background behind it. Used for: item detail, add meal, ingredient pull, invite, join family.

### Toast notifications
Small feedback banner that appears briefly after an action (e.g. "Item added", "Recipe saved", "Link copied"). Appears above the bottom tab bar. Variants: success (green), error (red), neutral (grey).

### Empty states
Shown when a list or library is empty. Each screen has its own: a simple illustration or icon, a short message, and a CTA button (e.g. "Add your first recipe").

### Skeleton loaders
Shown during initial data fetch. Grey animated placeholder shapes that match the layout of the real content. Used on: recipe library, shopping list, meal plan calendar.

### Offline banner
A thin banner at the top of the screen that appears when the device has no network. Shows "You're offline — changes will sync when reconnected."

### Confirmation dialog
A small modal for destructive actions (delete item, remove family member, delete recipe). Shows action title, short description, Cancel + Confirm buttons.
