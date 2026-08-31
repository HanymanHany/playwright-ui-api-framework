# Context: Auth (Login / Registration / Account / Profile)

**Last updated:** 2026-08-29
**Sources:** explore (live DOM dump + API probing + OpenAPI `/docs`)
**Covers:** `/auth/login`, `/auth/register`, `/account`, `/account/profile`,
API `/users/login`, `/users/register`, `/users/me`, `/users/{userId}`

## Routes

| Path                 | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `/auth/login`        | Login form                                               |
| `/auth/register`     | Registration form                                        |
| `/account`           | My account page — redirect target after successful login |
| `/account/profile`   | Profile form (authenticated)                             |
| `/account/favorites` | Favorites list (authenticated)                           |

## data-test Attributes Map

### Login — `/auth/login` (verified 2026-06-10)

| Element            | data-test              | Notes                                        |
| ------------------ | ---------------------- | -------------------------------------------- |
| Email input        | `email`                |                                              |
| Password input     | `password`             |                                              |
| Submit             | `login-submit`         | `<input type=submit>`                        |
| Login form         | `login-form`           | container                                    |
| Login error        | `login-error`          | appears on invalid credentials               |
| Register link      | `register-link`        |                                              |
| Forgot password    | `forgot-password-link` |                                              |
| Sign-in nav link   | `nav-sign-in`          | header, only when logged out                 |
| Account page title | `page-title`           | "My account" — reliable login-success marker |

### Registration — `/auth/register` (verified 2026-08-29, 35 elements)

| Element        | data-test         | Notes                                         |
| -------------- | ----------------- | --------------------------------------------- |
| Form container | `register-form`   | validation alerts render inside it            |
| First name     | `first-name`      |                                               |
| Last name      | `last-name`       |                                               |
| Date of birth  | `dob`             | `<input type=text>`, format `YYYY-MM-DD`      |
| Country        | `country`         | `<select>`, **249 options** — select by VALUE |
| Postal code    | `postal_code`     |                                               |
| House number   | `house_number`    | **required by the form**, optional in the API |
| Street         | `street`          |                                               |
| City           | `city`            |                                               |
| State          | `state`           |                                               |
| Phone          | `phone`           |                                               |
| Email          | `email`           |                                               |
| Password       | `password`        |                                               |
| Submit         | `register-submit` | `<button type=submit>`                        |

### Account — `/account` (verified 2026-08-29, 31 elements)

| Element          | data-test       | Notes                                         |
| ---------------- | --------------- | --------------------------------------------- |
| Page title       | `page-title`    | "My account"                                  |
| Header user menu | `nav-menu`      | text is the signed-in user's **full name**    |
| Sign out         | `nav-sign-out`  | inside the header menu; open `nav-menu` first |
| Favorites tile   | `nav-favorites` | on the account page body                      |
| Profile tile     | `nav-profile`   |                                               |
| Invoices tile    | `nav-invoices`  |                                               |
| Messages tile    | `nav-messages`  |                                               |

### Profile — `/account/profile` (verified 2026-08-29, 42 elements)

| Element                                  | data-test                                           | Notes                          |
| ---------------------------------------- | --------------------------------------------------- | ------------------------------ |
| Page title                               | `page-title`                                        | "Profile"                      |
| First name                               | `first-name`                                        | prefilled from `GET /users/me` |
| Last name                                | `last-name`                                         |                                |
| Email                                    | `email`                                             |                                |
| Phone                                    | `phone`                                             |                                |
| Street / city / state / country / postal | `street`, `city`, `state`, `country`, `postal_code` | no `house_number` here         |
| Update profile                           | `update-profile-submit`                             | fires `PUT /users/{userId}`    |
| Current password                         | `current-password`                                  | separate change-password block |
| New password                             | `new-password`                                      |                                |
| Confirm password                         | `new-password-confirm`                              |                                |
| Change password                          | `change-password-submit`                            |                                |

## API field mapping

| Endpoint                 | Verified behavior                                                          |
| ------------------------ | -------------------------------------------------------------------------- |
| `POST /users/login`      | 200 → `{access_token, token_type, expires_in}`; wrong password → **401**   |
| JWT lifetime             | **300 seconds** (`exp − iat`) — asserted in `tests/auth/auth.api.spec.ts`  |
| `POST /users/register`   | **201** → `UserResponse` with generated `id`                               |
| `GET /users/me`          | profile with `first_name`, `last_name`, `email`, `phone`, nested `address` |
| `PUT /users/{userId}`    | updates own profile; `address.city` and `phone` confirmed persisted        |
| `DELETE /users/{userId}` | **403 Forbidden** for the user itself — requires the admin role            |

### Registration validation rules (from the OpenAPI descriptions, confirmed live)

| Rule                  | Response                                                                              |
| --------------------- | ------------------------------------------------------------------------------------- |
| Password complexity   | must contain upper, lower, digit and symbol                                           |
| Password breach check | **422** `"The given password has appeared in a data leak."` — `Welcome01!` is refused |
| Date of birth         | must be between 18 and 75 years ago; otherwise **422** naming `dob`                   |
| Duplicate email       | 4xx client error                                                                      |

## Known Pitfalls

- **JWT expires in 5 minutes.** Never cache a token for the whole run; use `getToken()`,
  which re-authenticates after 240s. Never store a token in a shared file.
- **A user cannot delete itself** (403). Teardown removes the run user as admin.
- **The registration form is stricter than the API.** `house_number` is required by the
  form but optional in the schema. Leave it empty and Angular blocks the submit
  client-side — no request is sent, which looks exactly like a broken test.
- **Never select the country by visible label.** NL renders as `"Netherlands (the)"`,
  and the app ships eight locales (`lang-de`, `lang-el`, `lang-en`, `lang-es`,
  `lang-fr`, `lang-nl`, `lang-tr`). Use the ISO value: `selectOption('NL')`.
- **`nav-menu` shows the user's full name** — this is the only assertion that proves
  _who_ is signed in, as opposed to merely that a redirect happened.
- **UI project uses storageState** (already logged in). Login and registration tests
  must use the `guest` fixture — one fresh context shared by all three page objects,
  otherwise the assertion runs in a browser that never saw the action.
- **The suite does not use the shared demo customer.** Every run registers its own
  user (`core/run-user.ts`); tests assert on `runUser`, never on `Jane Doe`.
