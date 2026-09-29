# Mealio — Feature Ideas

## Shopping List

- **Smart quantity merge** — when you add an item that's already on the list (e.g. "milk"), offer to increase quantity instead of adding a duplicate
- **Hide completed** — one-tap button to hide all checked items at once
- **Share list** — send a read-only link or copy a plain-text version of the list to paste into a message
- **Weekly Basics** — Add a weekly basics button next to Name in edit item so it is added when in grocery list. 
- **Item images from barcode** — scan a barcode and auto-fill the item name, brand, and photo from a product database

---

## Recipes

- **Recipe collections / folders** — group recipes into folders like "Quick dinners", "Batch cook", "Kids meals"
- **Recipe tags filter** — filter recipe list by dietary tags (vegan, gluten-free, etc.) already stored in the data
- **Nutritional info** — show estimated calories, protein, carbs per serving (could be AI-generated at import time)
- **Scaling memory** — remember the last serving count used for each recipe so it defaults to that next time
- **Recipe notes / journal** — per-recipe notes tied to a specific cook date ("added extra chilli, kids loved it")
- **Ingredient substitutions** — AI-suggested swaps when an ingredient is unavailable or flagged as disliked
- **Prep time filter** — filter recipes by total time so you can find "under 30 min" meals quickly
- **Recipe source link** — for imported recipes, keep a "View original" link back to the source URL

---

## Meal Planner

- **Drag to reschedule** — drag a meal chip from one day to another in the week/month view
- **Copy week** — duplicate the current week's plan to next week
- **Meal suggestions** — "suggest a dinner for Tuesday" button that picks from your recipe library based on what you haven't had recently - I have a conversational dinner suggestion feature that asks users a series of questions one at a time to narrow down what they want to cook. The current flow asks about: time available, number of people, whether kids are picky, mood (hearty vs fresh), protein preference, and cooking style (hands-on vs hands-off). It ends with a concrete recipe suggestion.
I want to add one additional question into the flow that asks whether the user has any ingredients they want to use up — things sitting in the fridge or pantry that need to go.
Where it should sit in the flow: after the protein question, before the hands-on/hands-off question. So once we know roughly what kind of protein they're after, we ask if they have anything that needs using.
How it should work:

Ask something like: "Anything in the fridge or pantry you want to use up — vegetables, herbs, sauces, anything like that?"
The user can type freely — e.g. "half a bag of spinach and some coconut milk" or "nothing really"
If they provide ingredients, factor them into the recipe suggestion. Don't force them in awkwardly — only use them if they genuinely fit the direction the conversation is heading. If they don't fit, you can acknowledge them briefly and explain why you didn't use them.
If they say nothing or "no", just continue as normal.

The recipe suggestion at the end should:

Mention any user-supplied ingredients it incorporates
Feel like a natural outcome of the whole conversation, not a mechanical list of constraints

The rest of the question flow and the recipe output format should stay exactly as they are. Just insert this one question and wire the response into the final prompt that generates the recipe suggestion.

- **Leftover tracking** — mark a meal as "made double batch" and it auto-plans leftovers for a choosen day.

- **Nutritional weekly summary** — alongside Daily Dozen, show estimated macros for the day and week across all planned meals - another toggle on an off 

## Notifications & Reminders

- **Meal reminder** — push notification at a configurable time (e.g. 4pm) saying "Tonight's dinner: Pasta Bolognese"
- **Shopping reminder** — remind on a chosen day each week to review the shopping list before heading out
- **Prep reminder** — "Chicken needs to defrost tonight for tomorrow's dinner" type alert based on the meal plan

---

## Onboarding & Discovery

- **Meal history** — calendar view of past meals so you can see what you cooked 3 weeks ago

---

## Settings & Personalisation

- **Dark mode** — manual dark/light toggle (separate from system setting)
- **Dietary preferences** — set household dietary restrictions (e.g. nut allergy) and get warnings when a recipe contains them
- **Default servings** — set a household default serving count so new recipes default to the right portion
- **Currency & units** — choose metric/imperial and currency symbol for prices
- **Account deletion** — already has a page, but wire it up fully with confirmation flow

---

## Performance & PWA

- **Faster recipe import** — streaming progress indicator while AI parses a recipe URL
