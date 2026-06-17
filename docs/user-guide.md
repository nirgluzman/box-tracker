# BoxIndex — User Guide

A friendly walkthrough for the 4 family members using BoxIndex to pack and unpack the move. No technical setup here - for that see [auth-flow.md](./auth-flow.md) and [adding-a-member.md](./adding-a-member.md).

The app lives at **[box-tracker-81539.web.app](https://box-tracker-81539.web.app)**.

## What BoxIndex is for

- **While packing:** snap a photo, dictate the contents by voice, and the app gives you a box number to write on the box.
- **While unpacking:** search by box number (or contents) to instantly see what is inside and which room it belongs to.

Each box has: an auto-assigned **box number**, a **room**, a **photo** (or a few), a short **description**, and an **urgent** flag.

## Before you start

- **Use Chrome.** On your **Android phone** for packing (voice, camera, install). On a **laptop/desktop** Chrome for reviewing and editing. iPhone/Safari is not supported.
- **You need to be invited.** Sign-in is Google-only and limited to the 4 family accounts. If you see "This account isn't authorized to use BoxIndex", you are signed in with the wrong Google account, or your access hasn't been granted yet.
- **One person per room.** While packing, only one person should add boxes for a given room at a time, so two people don't grab the same number for that room.

## Installing the app on your phone (recommended)

1. Open [box-tracker-81539.web.app](https://box-tracker-81539.web.app) in **Android Chrome**.
2. Tap the **⋮** menu → **Install app** (or "Add to Home screen").
3. Launch it from your home screen - it opens full-screen like a normal app and works offline.

## Signing in

1. Tap **Sign in with Google**.
2. Pick your own Google account (the app always shows the account chooser, handy on a shared laptop).
3. You land on the **Add Box** screen.

Tap the **sign-out** button in the header (top of every screen) to switch accounts. Your photo in the header circle shows who is signed in.

## Adding a box (packing)

This is the main packing-time screen. Typical flow:

1. **Pick the room** - tap one of the color-coded room pills.
2. **Dictate the contents:**
   - Choose the language next to the mic (default Hebrew `he-IL`, plus English and German). Pick the language that matches what you are about to say so words keep their original spelling.
   - Tap the **mic** and speak the items in the box. An animated "listening" indicator shows it's recording.
   - Tap to stop. The app summarizes your speech into a tidy comma-separated item list and **adds it to** the description.
   - You can record again (even in another language) - each recording is **appended**, so you can dictate in several passes. You can also type/edit the description by hand anytime.
3. **Add photos** (optional):
   - **Take photo** uses the rear camera (phones only).
   - **Gallery** picks an existing photo.
   - Photos only get copied into the app; nothing is ever deleted from your phone's gallery.
4. **Urgent** - flip this on for boxes you'll want to find first (default off).
5. **Save.** The app assigns the next box number for that room and shows a confirmation like **"Saved as Box #205 (Kitchen) — write this on the box."** Write that number on the physical box with a marker.

The form then clears, ready for the next box.

**Notes**
- The box number is **not** shown while filling the form - it's decided at save time (next number in the room's range).
- If a number runs past the room's range, you'll still get the number plus a heads-up to widen the range in Config.
- **Packing number** (optional): if the moving company put their own label on the box, type it here for extra cross-reference. It's free text and searchable.

## Browsing & unpacking

The **Browse** screen lists every box in real time, ordered by box number. This is also where you unpack.

**Search (three separate fields, combined together):**
- **Box number** - exact match. The fastest way to find a specific box while unpacking.
- **Packing number** - the moving company's label, exact match.
- **Contents** - fuzzy text search over the description. It's forgiving about plurals and Hebrew prefixes (e.g. "glass" finds "glasses", "צלחות" finds "וצלחות").

**Filters:**
- **By room** - tap one or more room pills, or "All" to clear.
- **Urgent only.**
- **Group by room** - splits the list into per-room sections with colored headers and counts.

**Views:** cards on phones, a table on desktop - same data.

**Editing a box:** tap the **pencil** icon. You can change anything, add or remove photos, etc. Photo changes save immediately. This is also how you **add photos later** to a box you created offline.

**Unpacking a box:** when you've opened and emptied a box, tap the **trash** icon to delete it. Deleting *is* the "unpacked" action - it removes the box and its photos. You'll be asked to confirm (unless you turned that prompt off in Config).

**Warnings:** if two boxes in the same room share a number, both get a warning badge - fix it via Edit.

## Config (managing rooms & settings)

The **Config** screen is for setup and housekeeping:

- **Rooms:** add, edit, or delete rooms. Each room has a **name**, a **color**, and a **number range** (e.g. Kitchen = 100-199). New rooms auto-suggest the next free range start; you'll be warned if a range overlaps an existing one.
  - **Changing a room's color recolors all of its existing boxes too.** When you edit a room and pick a new sticker color, every box already saved in that room is updated to the new color automatically - so Browse stays consistent without re-saving each box. (Renaming a room or changing its range does *not* change existing boxes; only the color cascades.)
  - Deleting a room leaves its boxes untouched (they keep their name, color, and numbers).
- **Color palette:** rooms pick their color from a shared palette. You can add/remove palette colors with a honeycomb color-wheel picker. Editing a palette color recolors every room and box using it.
- **Confirmation prompts:** toggle the "Are you sure?" prompt for each destructive action (delete box, delete photo, delete room, etc.). These settings are per-device.
- **CSV download / upload** - see below.
- **Orphaned photos cleanup:** removes leftover photos from boxes that were never saved (needs a connection).

## CSV: bulk edits & backup

Great for editing many boxes at once on a computer (e.g. in a spreadsheet).

- **Download CSV** (on Browse or Config) exports **every** box - filters are ignored on purpose.
- Edit the file in any spreadsheet app. You can change box numbers, rooms, descriptions, urgent flags, and packing numbers. Leave the `_docId` column alone for existing boxes; leave it **empty** to create a new box.
- **Upload CSV** (Config) shows a summary first - how many boxes will be updated, created, and deleted - before anything is applied. Rows you removed from the file are treated as deletions, so always start from a fresh full export. Large deletion counts ask for an extra confirmation.

## Working offline

The app keeps working without a connection - useful in a half-packed house.

- A small **"Offline"** banner appears when you lose connection.
- You can still **add boxes** with a typed description and **save** them - they sync automatically once you're back online.
- **Voice and camera are disabled offline.** Add the photos later via Edit on Browse once you reconnect (a note on the form reminds you).
- Previously viewed photos stay visible offline.

## Quick tips

- Write the box number on the box **as soon as you save** - that confirmation message is your label.
- Coordinate rooms: one person per room while packing avoids duplicate numbers.
- Dictate in the matching language so item names keep their original spelling.
- Use **Urgent** for the boxes you'll need first at the new place.
- Search by **box number** when unpacking - it's the quickest path to a box's contents and room.

## Suggest improvements

Got an idea, hit a bug, or want a new feature? Please open an **issue on GitHub** in the [box-tracker](https://github.com/nirgluzman/box-tracker/issues) repo - describe what you'd like or what went wrong. All suggestions are welcome.
