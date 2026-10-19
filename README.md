# ioBroker MG/SAIC

<img src="MG.png" alt="MG" width="314">

**The adapter is currently at its initial version (0.0.1) and remains under development. Global SAIC OAuth login, vehicle discovery, and live and cached vehicle status retrieval are implemented. India TAP is not implemented yet.**

This is an unofficial community project and is not affiliated with or endorsed by MG, SAIC, or the iSmart service.

MG, SAIC, and iSmart are trademarks of their respective owners. Their names are used solely to identify the vehicles and services supported by this community project.

## Account setup

To avoid possible session interference with the mobile app, use a separate iSmart account for ioBroker where possible. Share the vehicle with that account and grant the permissions needed for your intended use.

The Admin form accepts an email address or phone number, an optional phone country calling code, a supported global region, and a password. The password is configured as an encrypted and protected native field in ioBroker. Global regions can authenticate against the SAIC API; India uses a separate TAP protocol and is not available yet.

## Current status

- The adapter validates required account fields and displays initialization status under `info`.
- For supported global regions, the adapter authenticates with SAIC, retrieves the account's vehicle list, and reports connection status in `info.connection` and `info.lastError`.
- Each discovered vehicle has a `vehicles.<VIN>` device with its VIN and available name, brand, model, series, year, color, and account flags.
- The adapter requests both a live status and SAIC's last cached status for each vehicle at startup and at the configured interval. Available numeric values are stored separately as read-only states under `vehicles.<VIN>.status` and `vehicles.<VIN>.cachedStatus`.
- Configure the automatic status polling interval in seconds in the adapter settings (default: 1800 seconds). Write `true` to `commands.refresh` to request an immediate refresh.
- Status measurements are converted from documented raw API scales to display units where known (including km, V, and bar); binary status fields are exposed as boolean indicators. Other measurements retain their API values. Persistence and India TAP are not available yet.
- Home Assistant is not a runtime dependency.

## Installation

The adapter is not published yet. Install it through the ioBroker Admin adapter catalog after a release is available.

## Changelog

### **WORK IN PROGRESS**

- (Voodoo2man) Initial Version

## License

MIT License

Copyright (c) 2026 Voodoo2man Voodoo2man@hotmail.de

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
