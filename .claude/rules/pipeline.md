# The Pipeline and Its Key

How the stages hand work to each other, and what each one does when what it needs is not
there. Read by `/checklist`, `/cases` and `/autotests`.

```
/setup → /checklist <key> → /cases <key> → /autotests <key> → /test-code-review → /commit-push
```

## The key

One argument travels the whole chain. It is either a tracker id (`PROJ-431`) or a feature
name (`checkout`), and every stage resolves its own inputs from it:

```
docs/checklists/checklist_<key>.md   the task checklist        (written by /checklist)
docs/test-cases/cases_<key>.md       the cases                 (written by /cases)
docs/plans/plan-<key>.md             the automation plan       (written by /autotests)
docs/context/<feature>/context.md    the feature knowledge base (merged by /checklist)
```

The first three belong to the task and end with it. The last one belongs to the feature
and is merged for years — which is why the key and the feature are recorded separately in
every artifact header:

```
Key:     PROJ-431
Feature: checkout
Context: docs/context/checkout/context.md
```

A task key is preferred where a tracker exists, because it survives renames and a change
of assignee. A feature name is a perfectly good key where it does not.

## When no key is given

Never invent one silently and never proceed on a guessed scope. A stage that decides for
itself what it is working on produces artifacts nobody agreed to, and the mistake only
surfaces three stages later.

**If the request names a feature** ("explore the cart", "write cases for favorites"),
derive the key from it and say so in one line before starting:

> Working under the key `cart` — checklist, cases and plan for this task will be stored
> under that name. Say the word if it should be the tracker id instead.

Deriving rules: lower kebab-case, the product's noun for the area (`checkout`, not
`payment-page-tests`), and — before anything else — **reuse a name that already exists**.
If `docs/context/cart/` is there, the key is `cart`, never `cart-2` or `shopping-cart`. Two
names for one feature is how the context map ends up duplicated and half wrong.

**If the request names nothing usable** ("write some tests", "check the app"), stop and
ask once, with the options laid out rather than an open question:

> I need a key to file this work under — either:
>
> - a tracker id (`PROJ-431`), and if a tracker MCP server is configured I will read the
>   ticket myself, or
> - the feature to work on. These already have a context map: `auth`, `cart`, `catalog`,
>   `favorites`. Anything else starts a new one.

List what actually exists (`ls docs/context/`, `ls docs/checklists/`) instead of asking the
specialist to remember it.

## When the input of a stage is missing

| Situation                                  | What the stage does                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/cases <key>`, no checklist for the key   | Stop. Say so and offer `/checklist <key>` — cases invented without a checklist skip the gate where the specialist chose what matters |
| `/autotests <key>`, no cases for the key   | Stop. Say so and offer `/cases <key>` — a checklist has no layers, no data plan and no cleanup owner                                 |
| `/autotests <key>`, plan exists already    | Read it. If `Status: ready` and the sources have not changed, continue from Phase 3 instead of re-planning                           |
| Any stage, no `context.md` for the feature | `/checklist <key>` first. Locators are never invented — that rule has no exception for a hurry                                       |
| Context sections older than 30 days        | Do not refuse and do not trust silently: list them under `## Risks` and let the Phase 2 gate decide                                  |
| An artifact exists for the key already     | Ask whether to extend it or use a new key. Never overwrite a reviewed artifact without saying so                                     |

The shape of every one of these messages is the same: what is missing, why it matters
here, and the exact command that produces it. "I cannot proceed" on its own wastes the
specialist's turn.

## What never changes between stages

- The key is chosen once and used verbatim by every later stage
- The gates belong to the human: the checklist, the cases and the plan are each approved
  before the next stage starts
- Artifacts are English, whatever language the conversation happens in
