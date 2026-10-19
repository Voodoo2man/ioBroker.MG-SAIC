# ioBroker MG/SAIC

<img src="MG.png" alt="MG" width="314">

**The adapter foundation is under development. Global SAIC OAuth login, vehicle discovery, and a current vehicle-status snapshot are implemented. Automatic polling, commands, and India TAP are not implemented yet.**

This is an unofficial community project and is not affiliated with or endorsed by MG, SAIC, or the iSmart service.

## Account setup

To avoid possible session interference with the mobile app, use a separate iSmart account for ioBroker where possible. Share the vehicle with that account and grant the permissions needed for your intended use.

The Admin form accepts an email address or phone number, an optional phone country calling code, a supported global region, and a password. The password is configured as an encrypted and protected native field in ioBroker. Global regions can authenticate against the SAIC API; India uses a separate TAP protocol and is not available yet.

## Current status

- The adapter validates required account fields and displays initialization status under `info`.
- For supported global regions, the adapter authenticates with SAIC, retrieves the account's vehicle list, and reports connection status in `info.connection` and `info.lastError`.
- Each discovered vehicle has a `vehicles.<VIN>` device with its VIN and available name, brand, model, series, year, color, and account flags.
- At startup, the adapter requests one current status snapshot for each vehicle. Available numeric values are stored as read-only states under `vehicles.<VIN>.status`; `statusTime` contains the raw timestamp returned by SAIC.
- Status values are raw API values and are not converted or assigned units. The adapter does not refresh them automatically; polling, controls, persistence, and India TAP are not available yet.
- Home Assistant is not a runtime dependency.

## Installation

The adapter is not published yet. Install it through the ioBroker Admin adapter catalog after a release is available.

## Changelog

### WORK IN PROGRESS

- (Voodoo2man) Added the initial TypeScript adapter foundation, secure account settings, and configuration validation.
- (Voodoo2man) Added regional SAIC OAuth login, account connection status, vehicle discovery, and a current status snapshot for each vehicle; automatic polling, controls, and India TAP remain unavailable.

## License

MIT License

Copyright (c) 2026 Voodoo2man <62031459+Voodoo2man@users.noreply.github.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
