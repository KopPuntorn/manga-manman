# Manga-Manman Context

Manga-Manman is a personal manga reading context centered on reading MangaDex-sourced manga with Thai translation support.

## Language

**Manga**:
A readable series in Manga-Manman, currently sourced from MangaDex. A **Manga** can have many **Chapters** and may have one **Library Entry** for a reader.
_Avoid_: Title, series, MangaDex record

**Manga Source ID**:
The external identifier used to fetch a manga from its source, currently the MangaDex manga ID.
_Avoid_: Manga, internal ID

**Author**:
The person credited with writing or originating a **Manga**.
_Avoid_: Creator, artist

**Artist**:
The person credited with drawing a **Manga**. The same person may be both **Author** and **Artist**.
_Avoid_: Creator, author

**Reader**:
The person using Manga-Manman to read manga, manage their library, track progress, and correct translations.
_Avoid_: User, account

**Translation**:
The Thai text the app displays for one manga page. A **Translation** may start from AI output and may later be corrected by the reader.
_Avoid_: AI result, raw translation, generated text

**Generated Translation**:
The initial machine-produced Thai text for one manga page before any reader correction.
_Avoid_: Translation

**Translation Correction**:
A reader's edit to the Thai text in a **Translation**. A **Translation Correction** updates the saved **Translation** for that **Page**.
_Avoid_: Session edit, local edit, annotation

**Target Language**:
The language Manga-Manman translates into for the reader, currently Thai.
_Avoid_: Chapter Language, Source Text language

**Text Block**:
A bounded area of text on a manga page, such as dialogue, narration, signs, or sound effects. One **Translation** contains zero or more **Text Blocks**.
_Avoid_: Bubble, speech bubble, text area

**Source Text**:
The text detected from the manga image before Thai translation, stored inside a **Text Block** when available.
_Avoid_: Original, raw text

**Original Page**:
A **Page** shown without Thai translation overlays.
_Avoid_: Original, raw

**Bilingual Text Mode**:
A reader display mode that shows **Source Text** and Thai **Translation** text together for each **Text Block**.
_Avoid_: Side-by-side, original mode

**Translation Overlay**:
The visual presentation of a **Translation** positioned over a **Page** using its **Text Blocks**.
_Avoid_: Translation, overlay data

**Library Entry**:
A manga the reader has intentionally saved to their personal library. A **Library Entry** is not created merely because the reader opened or partially read a manga.
_Avoid_: Bookmark, reading history, saved progress

**Library Shelf**:
The reader's personal classification for a **Library Entry**, such as Reading, Plan to Read, Completed, or Dropped. Library Shelf is chosen by the reader and is not automatically derived from **Reading Progress**. Plan to Read means the reader intends to read the manga later, even if **Reading Progress** already exists. Completed means the reader considers the manga finished for their own library, regardless of **Manga Status**. Dropped means the **Library Entry** remains saved, but the reader does not intend to continue it for now.
_Avoid_: Status, category

**Manga Status**:
The publication or release status of a **Manga** from its source, such as ongoing or completed.
_Avoid_: Library status, shelf, category

**Content Rating**:
The source-provided maturity classification for a **Manga**, such as safe, suggestive, erotica, or pornographic.
_Avoid_: Reader rating, score

**Tag**:
A source-provided label used to describe or filter a **Manga**. A genre is one kind of **Tag**, not a separate domain concept.
_Avoid_: Genre, chip

**Reading Progress**:
The reader's latest known position within a **Manga**, expressed as a **Chapter** and **Page**. **Reading Progress** can exist separately from a **Library Entry** and is not a full reading log.
_Avoid_: Library, bookmark

**Reading History**:
A future concept for a chronological record of reading activity. Manga-Manman currently uses **Reading Progress** for resume behavior, not a full **Reading History** timeline.
_Avoid_: Reading Progress, Library Entry

**Bookmark**:
A future concept for intentionally saving a specific manga, chapter, or page location. Manga-Manman does not currently use **Bookmark** for saved manga or reading position.
_Avoid_: Library Entry, Reading Progress

**Chapter**:
A readable MangaDex chapter release for a manga. A **Chapter** has its own language, page count, and may have a scanlation group.
_Avoid_: Chapter number, episode

**Chapter Language**:
The source-provided language of a **Chapter** release.
_Avoid_: Target Language, Source Text language

**Chapter Number**:
The human-facing chapter label within a manga, such as "12" or "12.5". Multiple **Chapters** may share the same **Chapter Number** when they differ by language or scanlation group.
_Avoid_: Chapter

**Scanlation Group**:
The source-provided group credited for a **Chapter** release. A **Scanlation Group** is not Manga-Manman's **Translation Provider**.
_Avoid_: Translation Provider, translator

**Page**:
One ordered page within a **Chapter**, identified by its position in the chapter. A **Page** can have one **Translation**.
_Avoid_: Page image, image URL

**Page Image URL**:
The fetchable image URL for a **Page** from MangaDex's at-home image service.
_Avoid_: Page

**Reading Mode**:
The way **Pages** are arranged for the reader, such as Webtoon, Single Page, or Double Page. **Reading Mode** does not change what counts as a **Page** or **Reading Progress**.
_Avoid_: Reading Progress, page type

## Example Dialogue

Dev: "Should we show the Generated Translation directly?"

Domain expert: "Only until it is corrected. Once the reader edits it, the visible Translation is the corrected version."

Dev: "Does editing a translation only change the current screen?"

Domain expert: "No. A Translation Correction updates the saved Translation for that Page."

Dev: "When we say language, do we mean the chapter's source language or Thai?"

Domain expert: "Use Chapter Language for the source release and Target Language for the language Manga-Manman translates into."

Dev: "Is the Manga the same thing as the MangaDex ID?"

Domain expert: "No. The Manga is the readable series in the app; the Manga Source ID is how we fetch it from MangaDex."

Dev: "Can we just call everyone a Creator?"

Domain expert: "No. Keep Author and Artist distinct because the source exposes those roles separately."

Dev: "Should we call this person a User?"

Domain expert: "Use Reader in the domain. User is only appropriate when discussing account or authentication behavior."

Dev: "Is every Text Block a speech bubble?"

Domain expert: "No. A speech bubble is one kind of Text Block, but narration boxes and signs are Text Blocks too."

Dev: "When we say Original, do we mean the image or the detected text?"

Domain expert: "Use Original Page for the un-translated page view, and Source Text for detected text inside a Text Block."

Dev: "Does side-by-side mean two page images next to each other?"

Domain expert: "Not in the domain language. Bilingual Text Mode means each Text Block shows Source Text and Thai Translation together."

Dev: "Should Translation Overlay be stored separately from Translation?"

Domain expert: "No. Translation Overlay is how the Translation is displayed on the Page, not a separate saved thing."

Dev: "Should opening a manga add it to the Library?"

Domain expert: "No. Opening a manga may update Reading Progress, but a Library Entry only exists when the reader saves it intentionally."

Dev: "Can a manga stay Plan to Read after the reader opened it once?"

Domain expert: "Yes. Plan to Read is the reader's intent, not an automatic calculation from Reading Progress."

Dev: "Should the app move a manga to Reading as soon as Reading Progress exists?"

Domain expert: "No. Library Shelf is chosen by the reader; Reading Progress records what happened."

Dev: "Is Reading Progress every page the reader has visited?"

Domain expert: "No. Reading Progress is the latest resume position for a Manga, not a full Reading History timeline."

Dev: "Is Completed a Manga Status or a Library Shelf?"

Domain expert: "It depends on whose state it describes. If the source says the manga ended, it is Manga Status. If the reader says they finished it, it is Library Shelf."

Dev: "Can a Manga with ongoing Manga Status be on the Completed Library Shelf?"

Domain expert: "Yes. Completed is the reader's library classification, not a claim that the manga has ended at the source."

Dev: "Does Dropped remove the Manga from the Library?"

Domain expert: "No. Dropped is still a Library Shelf. Removing from the Library deletes the Library Entry."

Dev: "Is Content Rating the reader's score for a Manga?"

Domain expert: "No. Content Rating comes from the source and describes maturity level, not reader preference."

Dev: "Should we model Genres separately from Tags?"

Domain expert: "No. Use Tag as the canonical term; genre is only a kind of Tag or a friendly UI label."

Dev: "Are English chapter 12 and Thai chapter 12 the same Chapter?"

Domain expert: "No. They share a Chapter Number, but each MangaDex release is its own Chapter."

Dev: "Is the Scanlation Group the same thing as Groq or Gemini?"

Domain expert: "No. Scanlation Group is metadata on the source Chapter; Groq or Gemini are technical providers used by Manga-Manman."

Dev: "Should Reading Progress store the Page Image URL?"

Domain expert: "No. Reading Progress stores the Page position; the Page Image URL is just how the app fetches the image."

Dev: "Does Double Page mode make two Pages count as one Progress step?"

Domain expert: "No. Reading Mode only changes layout; Reading Progress still uses the underlying Page position."
