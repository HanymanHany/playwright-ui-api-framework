# Checklist: Auth (Login / Registration / Session)

**Source:** exploration session, 2026-08-29
**Context:** [docs/context/auth/context.md](../context/auth/context.md)
**Legend:** `[H/M/L]` priority · `[TC]` = a test case exists in
[cases_auth.md](../test-cases/cases_auth.md) · layer = where the check belongs

This is a worked example of what the exploration stage produces. Items are business
scenarios, not element checks — "the email field has a red border" is not a scenario,
"a user with a wrong password is told so and stays put" is.

## Functional context

Registration and login are the only way into the account area. The suite never uses the
shared demo customer: every run registers its own user, so all of the below runs against
an account nobody else touches.

Two facts shape almost every decision here:

- **The JWT lives 300 seconds.** Anything holding a token longer is a latent 401.
- **The form is stricter than the API.** `house_number` is optional in the schema and
  required by Angular, so a submit can validate client-side and send nothing at all.

## Checklist

### Login

- [x] [H] A registered user signs in with valid credentials and lands on their own account @Smoke @UI `[TC]` → ui
- [x] [H] A wrong password is rejected with a visible error, and the user stays on the login page @Negative @UI `[TC]` → ui
- [x] [H] `POST /users/login` returns a token whose lifetime is exactly 300 seconds @API @Security `[TC]` → api
- [x] [M] Signing out returns to the login page and ends the session @Regression @UI `[TC]` → ui
- [ ] [M] An unknown email is rejected with the same message as a wrong password (no account enumeration) @Security @API → api
- [ ] [L] The forgot-password link leads to the recovery page @Regression @UI → ui

### Registration

- [x] [H] A new account can be registered through the API and can immediately sign in @Smoke @API `[TC]` → api
- [x] [H] The UI registration form creates an account that works for login @Regression @UI `[TC]` → hybrid
- [x] [H] A password found in a known data leak is refused with 422 naming the password @Negative @Security `[TC]` → api
- [x] [M] A date of birth outside the 18-75 window is refused with 422 naming `dob` @Negative `[TC]` → api
- [ ] [M] A duplicate email cannot be registered twice @Negative → api
- [ ] [M] The form blocks submission when a UI-only required field is empty, and says which @Negative @UI → ui
- [ ] [L] The country is stored by its ISO value regardless of the interface language @Regression → hybrid

### Session and account

- [x] [H] The account page identifies the signed-in user by name, not merely by URL @Smoke @UI `[TC]` → ui
- [x] [M] A profile change made through the API is visible in the UI @Regression @Hybrid `[TC]` → hybrid
- [ ] [H] An unauthenticated request to an account endpoint is refused with 401 @Security @API → api
- [ ] [M] A user cannot delete their own account (403 — only admin can) @Security @API → api

## Coverage

13 items, 9 covered by test cases. The four open ones are deliberate: account
enumeration and self-deletion need decisions about what the demo is allowed to prove,
and the two UI-only items overlap with rules already asserted at the API layer.
