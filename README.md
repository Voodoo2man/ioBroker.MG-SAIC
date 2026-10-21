# ioBroker MG/SAIC

[![NPM version](https://img.shields.io/npm/v/iobroker.mg-saic.svg)](https://www.npmjs.com/package/iobroker.mg-saic)
[![Downloads](https://img.shields.io/npm/dm/iobroker.mg-saic.svg)](https://www.npmjs.com/package/iobroker.mg-saic)

<img src="MG.png" alt="MG" width="314">

The adapter is intended for connecting MG and SAIC vehicles to ioBroker through the iSmart cloud service. It is not affiliated with or endorsed by MG, SAIC, or iSmart.

## Setup

### Before you start

- Node.js 22.19.0 or later is required.
- Use an iSmart account that has access to the vehicle. A separate account shared with the vehicle is recommended to avoid interfering with the mobile app session.
- Have the account password ready. The adapter stores it as a protected setting.
- Select the region for the account. Available regions are European Union, China, Australia, Brazil, Israel, Turkey, Thailand, and Rest of World. India is not supported.

### Configure the adapter

1. Install the adapter and create an instance in ioBroker Admin.
2. Select the account region and login type (email or phone number).
3. Enter the account's email address or phone number and password. For phone login, also enter the phone country calling code.
4. Set the status polling interval in seconds. The default is 1800 seconds.
5. Save the settings and start the instance. Vehicles available to the account appear under `vehicles.<VIN>`.

## Features

- Connects ioBroker to the iSmart cloud service and retrieves vehicle status.
- Provides remote controls for supported vehicle functions.
- Supports climate, heating, and charging features where available for the vehicle.

## Installation

The adapter is published on npm but has not yet been added to the ioBroker adapter catalog.

## Changelog
### **WORK IN PROGRESS**

- (Voodoo2man) Improved release automation and removed unpublished version metadata.
- (Voodoo2man) Updated release checks for Node.js 24 and routed retry timers through adapter-managed timers.
- (Voodoo2man) Added a localized name for the charging port lock status.
- (Voodoo2man) Removed status objects when the reported values were unavailable.
- (Voodoo2man) Added charging-management and charge-status data from the SAIC charging endpoint.

Older changelog entries are available in [CHANGELOG_OLD.md](CHANGELOG_OLD.md).

### 0.0.2 (2026-10-20)

- (Voodoo2man) Added regional iSmart account setup, vehicle status, and supported remote controls.

## License

MIT License

Copyright (c) 2026 Voodoo2man Voodoo2man@outlook.de

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
