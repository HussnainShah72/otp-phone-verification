# Screenshots and screen recording

Evidence of the complete OTP flow: sending the code, receiving it, and verifying it.

## Screenshots — `screenshots/`

| File | Shows |
| --- | --- |
| `01-phone-entry.png` | Phone number entered with the country-code picker; backend reachable ("Connected") |
| `02-otp-entry.png` | Code screen mid-entry — the received code, the resend countdown, digits going in |
| `03-success.png` | **Success message** after the correct code is verified |
| `04-failure.png` | **Failure message** after the attempt limit is used up |
| `05-wrong-code-inline.png` | A single wrong code — retryable error with the remaining attempt count |

## Recording — `recording/`

`otp-verification-demo.webm` — the full run end to end: enter the number → request the code →
receive it → type it → success, then a second run that fails verification. WebM plays in any
modern browser, in VLC, and in Windows Media Player.

## How these were captured

The app was run with `npm run dev` (Express backend + Expo) and driven through Expo's web target
at a 412 x 915 phone viewport, which renders the same React Native components as the native build
via `react-native-web`. The backend was in **demo mode**, so the code appears on screen instead of
arriving as an SMS — which is why it is visible in the captures.

### Re-capturing on a real device

For a capture showing a real SMS arriving on a handset:

1. Add Twilio credentials to `server/.env` (see the main [README](../README.md)) and restart.
2. `npm run dev`, then open the project in Expo Go on your phone.
3. Record the screen — Android: quick-settings **Screen record**; iOS: Control Centre **Screen
   Recording** — and run through the flow so the incoming text message is on camera.
4. Save over the files above, keeping the same names so the README tables keep working.
