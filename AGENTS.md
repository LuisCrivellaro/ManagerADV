<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- AI calls stay server-only: Ana uses the uploaded Anthropic sample adapter; legal analysis uses Lovable Gateway Responses. Why: isolates provider billing and keeps keys private.
- External integrations use `src/services/integracoes.ts`; why: no third-party browser calls.
- Integration readiness only checks credentials with auth and never activates workflows. Why: setup must not send legal data, sign or charge.
- Office pages live under `src/routes/_authenticated/` (client-only login gate); cases and checklist items are per-user rows protected by owner RLS, and new users get demo cases copied from `casos_modelo` by the signup trigger; why: each staff member has their own saved data.
- Roles live only in `user_roles` (new users get `atendente`); why: prevents self-promotion.
- Shared office pages use `office_workspace` owner-scoped state and private append-only document storage; why: drafts, review findings and original files persist without modifying originals.
- Human approvals are server-validated against `user_roles` and a material revision hash in `legal_approvals`; why: editing a case invalidates approval and clients cannot forge approval records.
- Checklist and draft approval use authenticated database functions and database advancement triggers; why: direct client writes cannot bypass legal gates and material changes invalidate approval.
- Office-wide dashboard reads run through a server function restricted to senior lawyers or admins, other users read only owned cases; why: aggregate visibility must not weaken owner RLS on editable records.
- Legal prompt texts are server-only guidance applied by practice area; Drive organization guidance (`organizacao-drive.txt`) stays server-side, never in Ana's prompt. Why: Ana does not operate Drive.
- Draft review scheduling lives separately from legal material, with authenticated database functions for scoped queue reads and validated lawyer assignment; why: scheduling must not invalidate approvals or grant cross-owner material edits/approvals.
- Client directory and quick search project saved cases into CPF-grouped client records, with authenticated role-scoped reads and owner-scoped case creation/history; why: keeps dashboard and client records consistent without duplicating case ownership or bypassing legal gates.
- Connection probes are senior/admin-only and read-only, never activate workflows. Why: no silent legal-data or financial actions.
- Visual Law preview and DOCX share explicit block classification and document-layout roles; why: preserves source text and consistent formatting without importing area-specific legal claims.
- Attendance and assessor rules are pure modules with tests; optional attendance fields stay in case JSON and automation settings stay at workspace root, without schema changes; why: preserves existing storage and legal gates.
- Originals share server analysis; matched address receipt can retain review caveats. Saves use their original baseline and reload real rows; approved changes need confirmation. Why: prevent stale UI writes undoing receipts.
- Drive uploads resolve Start; shared analysis creates append-only named PDF copies with type/description receipts and hash-based retry lookup. Originals stay unchanged. Why: organize evidence without implying legal approval.
- Ana reads real checklist/training server-side; email intake uses owner-scoped validated client text, case email and checklist writes with approval checks. Why: no invented receipts or model-owned contact data.
- Demo reminders stay browser-only; Ana uses owner training and CAS claims. Calendar offers refresh availability and retain offer history. Bookings use verified receipts. Cancellation consent is stored after sending the question, bound to the conversation receipt/contact. Rescheduling reserves new before cancelling old, with rollback. Why: prevent repeated offers and unauthorized or lost appointments without weakening legal gates.
- Optional operational case fields can invalidate draft approval under the unchanged database revision function; why: preserving the existing legal gate takes priority over bypassing reapproval without a migration.
- Attendance details open inline at ≥1024px or in a drawer below. Staff changes use owner-authenticated functions, verified receipts and confirmation before notification. New Calendar events request Meet and expose only returned HTTPS links; why: prevent unauthorized changes and false meeting claims.
- Attendance ProJuris details project only the selected case and its owner-scoped workspace; local records and simulated sync markers never imply a provider import; why: prevents cross-client mixing and misleading integration claims.
- Quick replies use owner overrides, authenticated Calendar reads and verified receipts; locks never send/store offers and braces block sends. Why: safe live drafts.
- Attendance channel management is directly accessible from the list header with existing senior/admin permissions; why: channel setup must not depend on selecting a conversation.

- Intake defaults to automatic, preserving modes/pauses. Active `ana-prompt.txt` and `ana-restrictions.txt` supply identity with owner training; `ana-scheduling.ts` validates intent, offers and pending-slot consent. Why: no forced greeting or unsafe booking.
- National Brazilian public holidays are checked using date-holidays; local office closures remain Calendar busy blocks until a location-specific policy is supplied. Why: avoid inventing municipal holiday jurisdiction.
- Trato feito rules (base docs, AC/RT folder, phase, production notice) live in src/lib/atendimento/trato-feito.ts with tests; Production start stays manual; why: future automation must respect legal gates.
- Ana inference uses `ana.functions.ts` with the uploaded `claudeComoSample` adapter; Telegram and UltraMsg share channel-validated orchestration, consent and released conversation-owned destinations, with only one active channel. Why: temporary channel testing must preserve operational safety and provider billing.
- Subdirectories may have their own `AGENTS.md`; read it before changing files there.
- Ana scope is scheduling-only for now: she books, reschedules and cancels; team-only subjects (process, documents, contract, payment, hearings, deadlines) hand off with `encaminhar_humano` and the server's "só dos agendamentos" handoff text; `processo` intent still falls back to draft. Fictional slots are never stored as offers. Why: avoid triage without legal review and keep first offers correct.
- The office has a dedicated WhatsApp phone: with `entradaWhatsApp.ativa` (server-saved in the senior/admin workspace, preserved by `saveOffice`), any non-blocked number gets an owner-scoped conversation and a released contact; blocked contacts never get Ana. `message_create` from the office number pauses Ana in that conversation unless the text matches a system send. Why: open entry on the office phone without Ana talking over the team.
