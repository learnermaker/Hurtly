# Contributing to Hurtly

Thanks for helping. Hurtly is a hobby and mission project, so small, focused contributions are the easiest to review.

## Good ways to help

- **Report a bug or confusing moment** using the issue templates. Screenshots help.
- **Share what it's like to use** if you live with pain. What would make logging easier on a bad day?
- **Clinicians:** tell us what would make the report more useful in an appointment.
- **Code:** for anything bigger than a small fix, open an issue first so we can agree on the approach.

## Running it

```bash
npm install
npm run dev
npm test
npm run build
```

## Before opening a pull request

- `npm run build` and `npm test` pass. CI runs both.
- The change works on a phone-sized screen, with a keyboard, and in dark mode.
- Health data stays on the device. Never add analytics, tracking, or anything that sends entries to a server.
- User-facing text is plain and calm, and never diagnoses.
- Match the surrounding code style; keep comments for the "why".

## Licence and sign-off

Hurtly is licensed under [AGPL-3.0-or-later](LICENSE). By contributing, you agree your contribution is licensed under the same terms.

Please sign off your commits (`git commit -s`) to certify you wrote the change or have the right to submit it, under the [Developer Certificate of Origin](https://developercertificate.org/).

## Conduct

Be kind and assume good faith. Many people here live with pain; be patient with each other. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Report problems to the maintainer through GitHub.
