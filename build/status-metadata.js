"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var status_metadata_exports = {};
__export(status_metadata_exports, {
  getVehicleStatusMetadata: () => getVehicleStatusMetadata,
  normalizeVehicleStatusValue: () => normalizeVehicleStatusValue
});
module.exports = __toCommonJS(status_metadata_exports);
const booleanStatusFields = /* @__PURE__ */ new Set([
  "bonnetStatus",
  "bootStatus",
  "canBusActive",
  "dippedBeamStatus",
  "driverDoor",
  "driverWindow",
  "engineStatus",
  "handBrake",
  "lockStatus",
  "onlineStatus",
  "passengerDoor",
  "passengerWindow",
  "rearLeftDoor",
  "rearLeftWindow",
  "rearRightDoor",
  "rearRightWindow",
  "remoteClimateStatus",
  "sideLightStatus",
  "sunroofStatus"
]);
const statusUnits = {
  batteryVoltage: "V",
  currentJourneyDistance: "km",
  exteriorTemperature: "\xB0C",
  frontLeftTyrePressure: "bar",
  frontRightTyrePressure: "bar",
  fuelLevelPrc: "%",
  fuelRange: "km",
  fuelRangeElec: "km",
  interiorTemperature: "\xB0C",
  mileage: "km",
  rearLeftTyrePressure: "bar",
  rearRightTyrePressure: "bar",
  vehElecRngDsp: "km"
};
const statusScales = {
  batteryVoltage: { factor: 0.1, precision: 1 },
  currentJourneyDistance: { factor: 0.1, precision: 1 },
  fuelRange: { factor: 0.1, precision: 1 },
  fuelRangeElec: { factor: 0.1, precision: 1 },
  frontLeftTyrePressure: { factor: 0.04, precision: 2 },
  frontRightTyrePressure: { factor: 0.04, precision: 2 },
  mileage: { factor: 0.1, precision: 1 },
  rearLeftTyrePressure: { factor: 0.04, precision: 2 },
  rearRightTyrePressure: { factor: 0.04, precision: 2 }
};
function getVehicleStatusMetadata(key) {
  if (booleanStatusFields.has(key)) {
    return { type: "boolean", role: "indicator" };
  }
  return {
    type: "number",
    role: "value",
    ...statusUnits[key] ? { unit: statusUnits[key] } : {}
  };
}
function normalizeVehicleStatusValue(key, value) {
  if (booleanStatusFields.has(key) && (value === 0 || value === 1)) {
    return value === 1;
  }
  const scale = statusScales[key];
  return scale ? Number((value * scale.factor).toFixed(scale.precision)) : value;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getVehicleStatusMetadata,
  normalizeVehicleStatusValue
});
//# sourceMappingURL=status-metadata.js.map
