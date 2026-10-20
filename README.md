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
- The adapter requests live status for each vehicle at startup and at the configured interval. If the live request fails, it also requests SAIC's last cached status as a fallback. Values are grouped under `vehicles.<VIN>.status.<group>` and `vehicles.<VIN>.cachedStatus.<group>` channels (for example, `driving`, `climate`, `tires`, and `energy`). Existing flat status states are moved to the grouped paths when refreshed.
- Configure the automatic status polling interval in seconds in the adapter settings (default: 1800 seconds). Write `true` to `commands.refresh` to request an immediate refresh.
- Each vehicle exposes momentary buttons under `vehicles.<VIN>.commands` for door locking/unlocking, boot release, climate and front/rear defrost, driver/passenger seat heating levels, battery heating, charging start/stop, charging-port locking/unlocking, and the horn-and-lights vehicle finder. SAIC command completion is logged; availability and behavior depend on the vehicle and account permissions.
- Writable settings in the same channel configure the climate target temperature in °C, charging target SOC (40-100% in 10% steps), charging current limit (6 A, 8 A, 16 A, or maximum), scheduled charging times and mode, and battery-heating schedule enablement and start time. Apply each group with its matching `*Apply` button. Climate temperatures are converted to the SAIC index using the vehicle series' supported range. Battery-heating start time uses the next occurrence in the adapter host's local time zone. Heated steering wheel control is not exposed because the HA integration does not define a writable steering-wheel heating command.
- All finite numeric fields in SAIC's `basicVehicleStatus` and numeric GPS waypoint fields are exposed, including fields added by SAIC that the adapter does not yet have a friendly name for. The `extendedData1` field is exposed as battery state of charge; on some vehicle types its meaning may differ. Known measurements are converted from documented raw API scales where available; `remoteClimateStatus` retains its numeric API codes. Status timestamps older than 24 hours or more than five minutes in the future are rejected; responses without a timestamp remain usable, and an older live response cannot replace a newer one. Data from separate charging endpoints is not currently requested. Persistence and India TAP are not available yet.
- Binary door, window, lighting, engine, and other known status fields are exposed as booleans in both live and cached status channels. Read-only measurement states use specific ioBroker roles where their meaning is known, such as temperature, distance, voltage, pressure, and GPS coordinates; these metadata and value conversions are shared by both channels.
- Known datapoint names are localized in all supported adapter languages for both live and cached status channels. SAIC fields not yet recognized by the adapter retain their technical field names.
- Home Assistant is not a runtime dependency.

## Installation

The adapter is not published yet. Install it through the ioBroker Admin adapter catalog after a release is available.

## Changelog

### **WORK IN PROGRESS**

- (Voodoo2man) Initial Version
- (Voodoo2man) Corrected live-status signing and value mappings, bounded retries, and handled shutdown cancellation and stale responses.
- (Voodoo2man) Exposed additional numeric SAIC status and GPS values, including battery state of charge.
- (Voodoo2man) Continued live-status event polling when SAIC returned code 4 with a pending event ID, while retaining final error reporting when no event remained.
- (Voodoo2man) Parsed nested GPS coordinates and altitude from SAIC waypoint responses.
- (Voodoo2man) Added per-vehicle controls for access, climate, heating, charging, vehicle finding, and charging schedules.
- (Voodoo2man) Clarified that SAIC code 4 is a remote service or vehicle response, not an adapter parsing error.
- (Voodoo2man) Matched climate target temperature and charging target SoC controls to Home Assistant's Celsius and percentage values.
- (Voodoo2man) Converted binary live and cached status codes to booleans and assigned specific ioBroker roles to known measurements.
- (Voodoo2man) Added localized names for known live and cached status datapoints in all supported languages.


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
