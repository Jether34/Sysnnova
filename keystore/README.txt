# Sysnnova Release Keystore — BACK THIS UP NOW

This keystore is the ONLY key that can sign updates to the Sysnnova Android app
on Google Play. If it is lost, the app can never be updated or re-uploaded under
package `ph.pns.sysnnova`.

## File
- `sysnnova-release.keystore` (this directory)
- Alias: `sysnnova`
- Store password: `tM3wKAj34ebpHXPdgsUAZYSI`
- Key password: `tM3wKAj34ebpHXPdgsUAZYSI`
- Created: 2026-08-11, valid 10,000 days

## Backup
Copy this directory to at least 2 safe places: a USB drive, cloud storage,
or a password manager. Anyone with the file + passwords can publish updates
to the app.

## Verify
    keytool -list -keystore sysnnova-release.keystore -storepass tM3wKAj34ebpHXPdgsUAZYSI

The signing config lives in `client/android/gradle.properties` and is applied
in `client/android/app/build.gradle`.
