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

## Support

[![Donate](https://camo.githubusercontent.com/ef8c60305542390406855547e32850909812a73c4abada236de22a6dc88b313f/68747470733a2f2f7777772e70617970616c6f626a656374732e636f6d2f64655f44452f44452f692f62746e2f62746e5f646f6e61746543435f4c472e676966)](https://www.paypal.com/donate/?hosted_button_id=3RJQGSJNRSHUJ)

## Changelog
### **WORK IN PROGRESS**

- (Voodoo2man) Improved release automation, updated Node.js release checks, and removed unpublished version metadata.
- (Voodoo2man) Added charging data
- (Voodoo2man) Fixed vehicle datapoint units and roles

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
