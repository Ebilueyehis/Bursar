# Bursar sales kit: prompt sequence

Nine prompts, run in order, each in a fresh session or continued in one.
Prompts 1 and 2 build the shared source of truth. Everything after reads from it,
which is what keeps three documents saying the same thing in the same voice.

**Deliverables**

| Doc | File | Job |
| --- | --- | --- |
| A. Introduction deck | `Bursar-Introduction.pptx` | Rep shows it to a proprietor, or sends it on WhatsApp |
| B. Product and company profile | `Bursar-Profile.docx` | Leave-behind that survives scrutiny |
| C. Pilot proposal | `Bursar-Pilot-Proposal.docx` | Named to one school, signed at the end |
| D. Extras | one-pager, WhatsApp card, follow-up email | Optional, prompt 9 |

---

## Fill these blanks before you start

Replace every one of these in the prompts below. They appear as `[[TOKEN]]`.

| Token | What it is |
| --- | --- |
| Collins Ebilueye | Your name as it appears on the contact page |
| `[[FOUNDER_TITLE]]` | e.g. Founder |
| +234 806 931 6819 | WhatsApp number, international format |
| ebilueyehis@gmail.com | Contact email |
| `[[WEBSITE]]` | Domain, or delete every reference if there is none yet |
|Lagos State | City and state, e.g. Port Harcourt, Rivers State |
| One Term of the Current Session | The term the pilot runs, e.g. First term, 2026/2027 session |
| N500 | The per student per term figure, under 500, e.g. 350 |
| a brief call at the end of month  | What a pilot school owes in return, e.g. a 30 minute call at mid-term and again at the end of term |

If you do not have one yet, leave the token in. The documents will carry a visible
blank rather than an invented fact, which is the correct failure mode here.

---

## Prompt 1: the brief

> Read `voice-guide.md` and `docs/PRD-bursar-develop.md` in this repository, then
> write `docs/sales-kit/brief.md`. This file is the single source of truth for a
> sales document kit, and every later document will be generated from it. Do not
> design anything yet.
>
> The brief must contain, in this order:
>
> **1. Voice rules.** Pull the three words and the sounds-like/doesn't-sound-like
> table from the voice guide. Add these hard rules as a checklist: no em-dashes
> anywhere; no emoji; no exclamation marks; no words like revolutionise, cutting
> edge, seamless, leverage, empower, game-changing, unlock, supercharge; one
> meaning per sentence; money always written to two decimals with the naira sign.
>
> **2. Vocabulary lock.** Reproduce the term table from the voice guide (Receipt,
> Outstanding balance, Student record, Guardian, Payment received, Dashboard) and
> add the terms this kit needs: School proprietor, Term bill, Ledger, Audit trail,
> Pilot school. One term per concept, used identically in all three documents.
>
> **3. Brand tokens.** Read `src/app/globals.css` and extract the light-theme
> palette with hex values and the name each colour carries in the comments (Paper,
> Card, Ink Navy, Ledger Green, Brass, Brick, Rule, Slate). Record the two
> typefaces: Bricolage Grotesque for headings, Inter for body and for figures with
> tabular numerals. Record the design principle stated at the top of that file,
> "Ledger, not gradient," and what it means for these documents: no gradients
> behind text, no drop shadows, no stock photography of smiling people, thin rules
> instead of heavy boxes, figures set in columns that line up.
>
> **4. Claims register.** This is the most important section. Two lists.
>
> *May claim*, drawn only from the PRD's Must, Should and Could sections, each
> written as a plain sentence a proprietor would understand.
>
> *May never claim*, absolute: any number of schools, users or students using
> Bursar today; any figure for money saved or recovered; any percentage
> improvement; any testimonial, quote or named customer; any award, partnership,
> certification or investor; any comparison to a named competitor; any claim about
> live SMS or WhatsApp delivery, parent self-registration, or online payment
> collection, because those are not built. Bursar has no customers yet and the
> documents must never imply otherwise.
>
> **5. Product facts.** A structured list of what is actually built, grouped as:
> student records, fees and bills, payments and receipts, ledger and audit trail,
> exams and records, staff and payroll, roles and access, the app itself (PWA,
> offline reads, dark theme, printing). Cite the PRD section each fact comes from
> so a later prompt can verify.
>
> Two of these groups need to be enumerated field by field rather than summarised,
> because they are what a proprietor actually inspects. Read
> `src/lib/domain/types.ts` and record them exactly:
>
> *The student record.* Admission number issued by the school, first, last and
> other name, gender, date of birth, class, enrolment date, and status, where a
> student may be active, pending, graduated or withdrawn. Then the guardian held
> against that student: full name, phone, alternate phone, email, and relationship
> to the child. State that the record opens on three tabs, Details, Payments and
> Receipts, so the person answering a parent at the counter has the child's
> details, what was paid, and the proof, in one place.
>
> *The term bill.* Built from the fee structure set for that class and term, one
> line per item such as tuition or a levy, each with its own amount. Any discount
> or scholarship is a separate line carrying the reason it was given. The total is
> the sum of the lines less the discount, and the outstanding balance is that total
> less everything paid. Record the two facts that matter most here: the bill
> snapshots the amounts at the time it was generated, so correcting the fee
> structure next term never rewrites a bill already issued, and a student
> registered provisionally can be handed a printed bill before their registration
> is approved.
>
> **6. Deliberate scope limits.** From the PRD's Won't list, written as choices
> rather than gaps. Bursar records money received, it does not process transfers,
> by design.
>
> Write it in the Bursar voice. Then read it back against your own checklist in
> section 1 and fix anything that fails.

---

## Prompt 2: the message spine

> Read `docs/sales-kit/brief.md`. Write `docs/sales-kit/messaging.md`. Still no
> design, no slides.
>
> Audience: the proprietor of a single Nigerian school, roughly 100 to 800
> students, who currently runs fees on receipt booklets and exercise books, may
> not own a laptop, and is not short of confidence about running a school. They
> are not a technology buyer. Treat them as an expert in their own business who is
> missing one instrument.
>
> Produce:
>
> **1. Positioning statement.** One sentence. What Bursar is, who it is for, and
> the single thing it changes.
>
> **2. The problem, in the proprietor's own terms.** Four to six plain statements,
> each about a specific moment rather than a category. Use the founder story in
> `voice-guide.md` section 6 as the source: the missing receipt booklet that was
> the only proof of a debt, the child's details recalled from memory, the wrong
> number dialled during registration, the vendor whose invoice nobody could check.
> Name the underlying fear once, exactly as the voice guide states it: money or
> information could be slipping away and I will not know until it is too late.
>
> **3. The cost arithmetic.** A worked example, not a statistic. Show a school
> with a stated number of students and a stated term fee, then show what a single
> forgotten outstanding balance per class per term adds up to across a year. Every
> number must be labelled as an illustration using the reader's own figures, never
> presented as a measured result. This section replaces the traction numbers a
> normal sales deck would carry, so it has to be arithmetic the reader can check
> on their own school in under a minute.
>
> **4. Three pillars.** In this order, each with a headline of six words or fewer,
> two supporting sentences, and the specific product facts from the brief that
> back it:
> - Who owes what, and receipts that cannot be lost
> - Every naira in and out, with an audit trail
> - Exams and records: CAs, exams, class and subject averages
>
> Pillar one has to carry the student record and the term bill in full, not as a
> passing mention. Write it so a proprietor can see the whole chain: the child's
> details and the guardian's number are held once and found in seconds, the class
> fee structure turns into that child's term bill line by line, any discount shows
> its reason, and the outstanding balance is simply what is left. This is the part
> the proprietor will test you on, because it is the part they do by hand today.
>
> **5. Two trust sections.** One on who can see what, covering the three roles and
> the fact that access is enforced in the database rather than merely hidden in the
> screen. One on records integrity, covering money stored to the kobo, receipts
> that cannot be deleted once issued, and an audit trail written by the database
> itself so it cannot be edited from inside the app.
>
> **6. The pilot offer.** Invitation only, no number of places stated. The first
> term, One Term of the Current Session, is free. In return the school agrees to a brief call at the end of month .
> After the pilot, N500 naira per student per term. Write the offer so the
> free term reads as a considered decision rather than a discount: Bursar is new,
> it should be judged on a real term of real fees before anyone is asked to pay.
> Include a worked line showing what a 300 student school would pay after the
> pilot, and set that against one term's fee income so the scale is obvious.
>
> **7. Objection handling.** Eight objections with an answer each, in voice, no
> defensiveness. Cover at minimum: we already have a system that works; my bursar
> will not use a phone app; what happens when there is no network; what if you
> shut down and my records go with you; my staff will make mistakes typing; is my
> school's money data safe from you; can parents see this; you have no other
> schools using it yet. Answer the last one honestly and turn it into the reason
> the first term is free.
>
> **8. Calls to action.** Three, escalating: see a fifteen minute demonstration on
> your own phone; put one class into Bursar and watch a term bill generate; join
> the pilot for One Term of the Current Session.
>
> Check every sentence against the claims register before you finish. Any sentence
> that implies existing customers gets rewritten.

---

## Prompt 3: deck outline

> Read `docs/sales-kit/brief.md` and `docs/sales-kit/messaging.md`. Write
> `docs/sales-kit/deck-a-outline.md`: the full slide-by-slide content for the
> Bursar introduction deck, as text. No file generation yet, because it is far
> cheaper to fix wording here than inside a PowerPoint.
>
> Seventeen slides. For each, give: slide number, title, the exact body copy, any
> figures or table contents, what visual element it needs, and the speaker note
> the rep reads from.
>
> 1. Cover. Bursar. "Every naira accounted for." One line saying what it is.
> 2. What this covers. Six items, numbered.
> 3. Why Bursar exists. The founder story compressed to four sentences, first
>    person, ending on the underlying fear.
> 4. What it costs a school. The cost arithmetic from the messaging spine,
>    presented as a small table the reader can substitute their own numbers into.
> 5. What Bursar is. The positioning statement, then the three pillars as three
>    labels only.
> 6. Pillar one, who owes what. Outstanding balance per student, oldest first, a
>    numbered receipt for every payment received, receipts that print.
> 7. The student record. Show the record as a labelled two column layout rather
>    than prose. Left, the child: admission number, full name, gender, date of
>    birth, class, date enrolled, and status. Right, the guardian: name,
>    relationship, phone, alternate phone, email. Underneath, the three tabs the
>    record opens on, Details, Payments and Receipts. The speaker note makes the
>    point directly: this is the slide that answers the parent standing at the
>    counter, and it is the one thing a receipt booklet has never been able to do.
> 8. The term bill. A worked example of one child's bill as a real table: three or
>    four fee lines with amounts, a discount line carrying its reason, the total,
>    what has been paid, and the outstanding balance. Use realistic Nigerian
>    figures and label the table as an illustration. Add two short notes beside it:
>    the bill is generated from the class fee structure so it is not typed per
>    child, and it holds the amounts as they stood when it was issued, so
>    correcting the fee structure next term never rewrites a bill already given to
>    a parent.
> 9. Registering a child today, paying later. A pending registration, the
>    provisional bill printed and handed to the parent on the spot, and the
>    approval once the first payment is recorded. Keep it to three steps.
> 10. Pillar two, every naira in and out. Payments, other income, expenses, running
>     ledger, and the audit trail.
> 11. Pillar three, exams and records. CA and exam entry, class and subject
>     averages, a report per student, spreadsheet template down and up.
> 12. It runs on the phone you already have. Installable, no laptop required,
>     records readable without a network. State plainly that recording money needs a
>     connection, so that no receipt is ever half-saved.
> 13. Who can see what. The three roles as a table: Proprietor, Bursar, Teacher,
>     and one line each on what they may and may not do.
> 14. Your records stay yours. Money to the kobo, receipts not deletable once
>     issued, audit trail written by the database, each school's data isolated.
> 15. Your first week. Six numbered steps from creating the school to printing the
>     first receipt. Give a realistic time against each step.
> 16. The pilot. The offer, what is free, what is asked in return, and the price
>     after.
> 17. Next steps and contact. Collins Ebilueye, +234 806 931 6819,
>     ebilueyehis@gmail.com, `[[WEBSITE]]`,Lagos State.
>
> Rules: no slide carries more than 40 words of body copy, counting labels and
> table cells as data rather than copy, which is what lets slides 7 and 8 be dense.
> Every number is either
> arithmetic the reader can verify or a product fact from the brief. No slide of
> logos, no slide of testimonials, no slide of company milestones, because none of
> those exist yet and their absence is more credible than their invention.

---

## Prompt 4: build the deck

> Use the pptx skill. Read `docs/sales-kit/brief.md` and
> `docs/sales-kit/deck-a-outline.md`, and build `Bursar-Introduction.pptx`
> exactly to that outline, 16:9.
>
> Design, taken from the brief's brand tokens:
> - Background Paper `#f2efe6`. Cards and panels Card `#fbfaf5` with a one point
>   Rule `#dcd6c4` border. Never a gradient behind text.
> - Headings Bricolage Grotesque, or Bricolage Grotesque falling back to Georgia if
>   unavailable, in Ink Navy `#1b2a3c`, tight letter spacing.
> - Body Inter, or Inter falling back to Calibri, in Ink Navy at 16 to 18 point.
>   Nothing below 14 point anywhere, because this deck gets viewed on a phone.
> - Money and all figures in Inter with tabular numerals, right aligned in tables,
>   always two decimals, always prefixed with the naira sign.
> - Ledger Green `#2f6f4e` for money in and for the single accent on each slide.
>   Brass `#a9793a` for anything partial or pending. Brick `#9c4234` only for money
>   owed. Never more than two accent colours on one slide.
> - Cover and the pilot slide may use the dark treatment: background `#16212e`,
>   text Paper. Do not use the ink token for a dark panel, use that hex directly.
> - A thin Rule line under every slide title. A slide number bottom right on every
>   slide except the cover.
>
> Diagrams instead of decoration. Slide 7, the student record, is drawn as two
> bordered Card panels side by side with field labels in Slate `#54677f` and values
> in Ink Navy, then a row of three tab labels beneath with the first one active in
> Ledger Green. Slide 8, the term bill, is a real table: fee lines left aligned,
> amounts right aligned on the decimal, the discount line in Brass `#a9793a` with
> its reason in smaller text, a rule above the total, the total in Ink Navy bold,
> the amount paid in Ledger Green, and the outstanding balance in Brick `#9c4234`.
> This is the only slide permitted three accent colours, because each colour is
> carrying a distinct meaning that the rest of the kit uses identically. Slide 9
> gets three numbered boxes with arrows. Slide 10 gets a horizontal flow, payment
> received to receipt issued to ledger entry to audit record, in Ink Navy and
> Ledger Green. Slide 13 gets a real table with a header row underlined in Ink
> Navy. Slide 15 gets a numbered vertical timeline.
>
> No stock photography. No icons of people. No rounded shadow cards. If a slide
> feels empty, remove words rather than adding graphics.
>
> When the file is built, render every slide to an image and inspect them. Check:
> nothing overflows its box, no text sits below 14 point, no em-dash survived, the
> naira sign renders, tables line up on the decimal, and every slide reads at
> phone size. Fix and rebuild until all of that is true.

---

## Prompt 5: profile outline

> Read `docs/sales-kit/brief.md` and `docs/sales-kit/messaging.md`. Write
> `docs/sales-kit/doc-b-outline.md`, the full text of the Bursar product and
> company profile. This is the document a proprietor keeps and reads twice, so it
> may be longer and quieter than the deck. Target 12 to 16 pages.
>
> Sections:
> 1. Cover. Bursar, "Every naira accounted for," and the date.
> 2. Contents.
> 3. What Bursar is. Half a page.
> 4. Why Bursar exists. The founder story in full, from `voice-guide.md` section 6,
>    lightly edited for this document. Keep it first person. Do not sand off the
>    specifics, the missing booklet and the wrong number are what make it true.
> 5. What we believe. Three principles, each a short paragraph: every naira
>    accounted for; nothing lost, nothing forgotten; the record is the product.
> 6. Who it is for. The three roles as a table with what each does.
> 7. How it works, end to end. The full path: create the school and the term, set
>    the fee structure per class, add or import students, generate term bills,
>    record a payment received and issue a numbered receipt, record expenses, watch
>    it all land in the ledger, and see the audit trail. Write it as a narrative
>    with numbered steps, not a feature list.
> 8. The student record. The longest section in the document, and the one to write
>    most carefully, because it is what replaces the exercise book. Give the child's
>    details as a labelled table, field by field, exactly as enumerated in the
>    brief: admission number, first, last and other name, gender, date of birth,
>    class, date enrolled, status. Then the guardian held against that child: name,
>    relationship, phone, alternate phone, email, and say plainly why the alternate
>    number exists, which is that the founder story turns on dialling a number that
>    did not answer. Then the three tabs, Details, Payments and Receipts, and what
>    each holds. Close with how records get in: one at a time from the phone, or a
>    whole school at once from a spreadsheet template that is downloaded, filled and
>    uploaded back, and out again to a spreadsheet whenever the school wants them.
> 9. Fees, bills and outstanding balances. Set the fee structure once per class per
>    term, one line per item. Every child in that class gets a term bill built from
>    it, with the amounts snapshotted at the moment it was issued so a later
>    correction never rewrites a bill a parent already holds. Show a full worked
>    bill for one child as a table, with fee lines, a discount line carrying its
>    reason, the total, what has been paid, and the outstanding balance, all with
>    realistic Nigerian figures and labelled as an illustration. Explain the
>    provisional registration path in its own short paragraph: a child can be
>    entered as pending and handed a printed bill the same day, and the
>    registration is approved once payment is recorded. Finish on how outstanding
>    balances are ordered, oldest first, so the question of who to follow up with
>    first has one answer rather than an argument.
> 10. Exams and records. Score entry, averages by class and by subject, the student
>     report, and the spreadsheet template in both directions.
> 11. Staff and payroll. Brief, this is a supporting capability not a pillar.
> 12. Money integrity and security. Money held as whole kobo so rounding cannot
>     drift, receipts that cannot be deleted once issued, access enforced in the
>     database rather than hidden in the screen, each school's records isolated
>     from every other school's, and a security review run before and after every
>     release. Explain each in plain language and say the benefit before the
>     mechanism.
> 13. What Bursar deliberately does not do. From the brief's scope limits. State
>     that Bursar records money received and does not process transfers, and say
>     why that is the safer arrangement for a school. This section builds more
>     trust than any feature page, so do not soften it.
> 14. Pricing. N500 naira per student per term after the pilot. Include a
>     table of three school sizes, 150, 300 and 600 students, showing the term cost
>     and what that works out to per student per month. Say what is included, which
>     is everything, and confirm there is no separate charge per user, per receipt
>     or per device.
> 15. The pilot programme. Invitation only. One Term of the Current Session free. What is asked in
>     return. What happens at the end of the term, including that the school's
>     records remain theirs and can be exported to a spreadsheet whether or not
>     they continue.
> 16. Contact.
>
> Every claim traceable to the brief. Nothing about customers, savings or awards.

---

## Prompt 6: build the profile

> Use the docx skill. Read `docs/sales-kit/brief.md` and
> `docs/sales-kit/doc-b-outline.md`, and build `Bursar-Profile.docx` to that
> outline, A4, ready to print in colour or greyscale.
>
> Design:
> - Headings Bricolage Grotesque in Ink Navy `#1b2a3c`, body Inter at 11 point,
>   line spacing 1.4, generous margins.
> - A full-bleed cover page in `#16212e` with Paper `#f2efe6` text.
> - Section headings numbered, each with a thin Ledger Green `#2f6f4e` rule beneath.
> - Tables with an Ink Navy underlined header row, no vertical borders, no fill
>   except a very light Paper tint on alternate rows. Figures right aligned with
>   tabular numerals, two decimals, naira sign.
> - Pull quotes from the founder story set in Bricolage Grotesque, larger, in Ink
>   Navy, indented, with a Brass `#a9793a` left rule. Use two at most in the whole
>   document.
> - Page numbers and a "Bursar" footer on every page except the cover.
> - Generated table of contents on page two.
>
> No headers or footers on the cover. No clip art. Greyscale printing must still
> be readable, so never rely on colour alone to carry meaning.
>
> When built, convert to PDF, render the pages as images, and inspect them. Check
> for orphaned headings, broken tables across page breaks, any em-dash, and text
> that fails at greyscale. Fix and rebuild.

---

## Prompt 7: build the pilot proposal

> Use the docx skill. Read `docs/sales-kit/brief.md` and
> `docs/sales-kit/messaging.md`. Build `Bursar-Pilot-Proposal.docx`, A4, six to
> eight pages. This document is addressed to one named school and the rep edits it
> per prospect, so every school-specific value must be a clearly visible
> placeholder in square brackets that a non-technical person can find and replace.
>
> Placeholders: `[School Name]`, `[Proprietor Name]`, `[Town, State]`,
> `[Number of Students]`, `[Number of Classes]`, `[Date]`.
>
> Sections:
> 1. Cover. "A proposal for [School Name]", the Bursar mark, `[Date]`, and the
>    mission line. Dark cover, same treatment as the profile.
> 2. Summary. Four sentences. What is being proposed, what it costs during the
>    pilot, which is nothing, what it costs after, and what is asked in return.
> 3. What we understand about your school. A short bulleted list built from the
>    placeholders, phrased so the rep can fill it from a single conversation:
>    student count, number of classes, how fees are recorded today, how outstanding
>    balances are tracked today. Leave a blank line after each for handwriting if
>    the document is printed.
> 4. What would change. A two column table. Left column, how it is done today, one
>    row each for holding a child's details and the guardian's number, issuing a
>    term bill, recording a payment, proving an outstanding balance, checking an
>    expense, and preparing results. Right column, how it is done in Bursar. Keep
>    each cell to one sentence.
> 5. What one child's record and bill would look like. Two small tables side by
>    side or stacked. First, the student record with its field labels and the values
>    left as fillable blanks, so the proprietor can see exactly what is held about a
>    child and what will be asked of them at setup. Second, a worked term bill using
>    `[School Name]`'s own fee items where the rep knows them and a realistic
>    illustration where they do not, running fee lines down to total, paid, and
>    outstanding balance. This is the page that makes the product concrete, so give
>    it a full page and do not crowd it.
> 6. What it would cost after the pilot. Compute `[Number of Students]` times
>    N500 naira as a worked line with the placeholder shown, then a small
>    table for 150, 300 and 600 students so the reader can locate their own size
>    even before the blank is filled.
> 7. The pilot. One Term of the Current Session at no cost. What Bursar provides: setup of the
>    school, classes and fee structure, the first import of student records, and
>    training for whoever handles fees. What the school provides: a brief call at the end of month .
>    State plainly that the school's records belong to the school and can be
>    exported to a spreadsheet at any time, including if they decide not to
>    continue.
> 8. Next steps. Three numbered steps with a blank date beside each. End with a
>    two column signature block, one side for the proprietor and one for
>    Collins Ebilueye, each with name, signature and date lines.
> 9. Contact block.
>
> Same typography and colour rules as the profile document. Verify by rendering to
> images before you finish.

---

## Prompt 8: the audit pass

> Read `docs/sales-kit/brief.md`, then audit all three generated files,
> `Bursar-Introduction.pptx`, `Bursar-Profile.docx` and
> `Bursar-Pilot-Proposal.docx`. Extract the full text of each and check every one
> of the following, reporting findings as a table of file, location, problem and
> fix, then apply the fixes.
>
> 1. **Fabricated claims.** Any sentence implying existing customers, schools,
>    users, savings, percentages, testimonials, partners, awards or funding. This
>    check comes first and any hit is critical.
> 2. **Unbuilt features.** Anything promising live SMS or WhatsApp delivery, parent
>    self-registration, online payment collection or multi-campus support.
> 3. **Voice.** Every banned word from the brief. Every exclamation mark. Every
>    emoji. Every em-dash, including any that the document generator introduced
>    through autocorrect.
> 4. **Vocabulary drift.** The same concept called two different names across the
>    three files. Receipt must never appear as invoice or slip. Outstanding balance
>    must never appear as debt or arrears.
> 5. **Money formatting.** Every figure carries the naira sign, two decimals, and
>    tabular alignment in tables.
> 6. **Unfilled tokens.** Any `[[TOKEN]]` left in a finished document, as distinct
>    from the intentional square-bracket placeholders in the proposal, which must
>    remain.
> 7. **Arithmetic.** Recompute every worked example and pricing table, including
>    every worked term bill: the fee lines less the discount must equal the stated
>    total, and the total less the amount paid must equal the stated outstanding
>    balance. Any figure that does not add up is critical.
> 8. **Record and bill fidelity.** Compare every student record field and every
>    bill element named in the three documents against `src/lib/domain/types.ts`.
>    A field shown to a proprietor that the product does not actually hold is a
>    fabricated claim and is treated as critical. A field the product does hold and
>    the documents omit is a finding, not a fault, but report it.
> 9. **Legibility.** Nothing below 14 point in the deck. Nothing below 10 point in
>    the documents. Greyscale print still readable.
>
> Report what you changed. Do not report a clean pass unless every check ran.

---

## Prompt 9: the extras

> Read `docs/sales-kit/brief.md` and `docs/sales-kit/messaging.md`. Produce three
> short pieces in the same voice and palette:
>
> 1. **One page leaflet**, A4 single side, `Bursar-Leaflet.docx`. Headline, the
>    problem in two sentences, the three pillars as three short blocks, one small
>    worked term bill so the reader sees the actual output rather than a promise,
>    the pilot offer, and contact. This is what a rep leaves at a school where the
>    proprietor was not available.
> 2. **A WhatsApp card**, a single 1080 by 1350 image built as HTML I can screenshot.
>    Headline, three lines, one call to action, the phone number. It must be
>    readable as a thumbnail, so no more than 25 words total.
> 3. **A follow-up message sequence**: one WhatsApp message sent the same day, one
>    sent after three days, one after ten days. Each under 60 words, each giving a
>    reason to reply that is not "just checking in". Write them so the rep can send
>    them as typed, and mark the one place in each where a school-specific detail
>    goes.
>
> Same claims register applies. Nothing about customers or savings.

---

## Notes on running this

- Run prompts 1 and 2 in one session and read the output yourself before going
  further. If the brief is wrong, all three documents inherit the error.
- Prompts 3 and 5 produce text you can edit by hand in five minutes. Editing
  PowerPoint by hand takes an hour, so spend the attention there.
- Prompt 8 is not optional. The single biggest risk in recreating a deck built on
  traction numbers is that a fabricated statistic survives into a document you hand
  to a real proprietor.
- When you have a pilot school with real figures, the correct change is to add one
  case study section to the profile and one slide to the deck, and to relax the
  claims register in the brief. Do not rewrite the kit.
