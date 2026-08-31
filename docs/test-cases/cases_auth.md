# Test cases: Auth

**From:** [checklist_auth.md](../checklists/checklist_auth.md)
**Context:** [context.md](../context/auth/context.md)
**Written:** 2026-08-29

A worked example of the case-writing stage. Two things are decided here and nowhere
else: **which layer owns the check**, and **what counts as proof**. Both are cheaper to
get right now than after the code exists.

---

## [UI / Auth / Login] Sign in with valid credentials and be greeted by name

Priority: High
Layer: ui
Automation: To Be Automated
Tags: Smoke, UI

Preconditions:

- The run user registered by global-setup exists and its credentials are known

Steps:

1. Action: open `/auth/login` in a logged-out context
   Expected: —
2. Action: fill email and password with the run user's credentials, submit
   Expected:
   - The browser lands on `/account`
   - The header (`nav-menu`) shows the run user's first and last name

Automation notes:

- Data: `runUser` fixture — never a hardcoded account
- Locators: `email`, `password`, `login-submit`, `nav-menu`, `page-title`
- Isolation: the `guest` fixture — the `ui` project is authenticated by storageState,
  and logging in is the thing under test, so it cannot start from a logged-in state
- Cleanup: none — nothing is created
- Note: "landed on /account" is NOT the assertion. It proves a redirect, not identity.
  The name in `nav-menu` is what proves the session belongs to this user

---

## [UI / Auth / Login] Wrong password is refused and the user stays on the login page

Priority: High
Layer: ui
Automation: To Be Automated
Tags: Negative, UI

Preconditions:

- The run user exists

Steps:

1. Action: open `/auth/login` in a logged-out context
   Expected: —
2. Action: submit the correct email with a deliberately wrong password
   Expected:
   - `login-error` is visible
   - The URL is still `/auth/login`

Automation notes:

- Locators: `login-error` — the element, not the message text (the app ships eight locales)
- Isolation: `guest` fixture
- Both assertions are needed: an error that appears while the app navigates anyway is
  still a defect

---

## [API / Auth / Token] The access token lives exactly 300 seconds

Priority: High
Layer: api
Automation: To Be Automated
Tags: Security, API

Preconditions:

- The run user exists

Steps:

1. Action: `POST /users/login` with valid credentials
   Expected:
   - 200, body contains `access_token`, `token_type`, `expires_in`
2. Action: decode the JWT payload
   Expected:
   - `exp − iat === 300`

Automation notes:

- API call: `POST /users/login` — in the OpenAPI spec
- This case exists to protect an architectural decision, not a feature. The whole
  token-provider design follows from this number; if the server changes it, the design
  should be revisited rather than discovered through a 401 in an unrelated test

---

## [API / Auth / Registration] A leaked password is refused with 422

Priority: High
Layer: api
Automation: To Be Automated
Tags: Negative, Security, API

Preconditions:

- None — the request creates nothing

Steps:

1. Action: `POST /users/register` with a valid payload whose password is `Welcome01!`
   Expected:
   - 422
   - The error body names the `password` field

Automation notes:

- Data: `buildApiUser('leak')` with the password overridden
- The rule is documented only in the `description` of the schema property, and was
  confirmed live. This is why the exploration stage reads descriptions, not just types
- Cleanup: none — the request is expected to fail, so nothing is created

---

## [Hybrid / Auth / Profile] A profile change made via API is visible in the UI

Priority: Medium
Layer: hybrid
Automation: To Be Automated
Tags: Regression, Hybrid

Preconditions:

- Signed in as the run user (storageState)

Steps:

1. Action: `PUT /users/{userId}` changing `phone` and `address.city` to values carrying `RUN_ID`
   Expected:
   - 200
2. Action: open `/account/profile`
   Expected:
   - The form fields hold exactly the values just sent

Automation notes:

- Token: `getToken()` at the point of use — a token taken at the top of the describe
  is dead before a slow run reaches this test
- Assertion: `assertInputHasValue` (retries), never a bare `inputValue()` comparison
- Isolation: the values carry `RUN_ID`, so two concurrent runs cannot read each other's
- Cleanup: none — the run user is deleted wholesale in global-teardown

---

## Not automated

**A duplicate email cannot be registered twice** — Manual for now. The demo reseeds on
its own schedule, so an assertion about an address already existing is only as stable as
the reseed job. Worth revisiting if the run user's own address is used as the duplicate.
