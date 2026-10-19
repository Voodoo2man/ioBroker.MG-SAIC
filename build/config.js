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
var config_exports = {};
__export(config_exports, {
  validateConfig: () => validateConfig
});
module.exports = __toCommonJS(config_exports);
var import_regions = require("./regions");
function validateConfig(config) {
  var _a, _b, _c;
  const errors = [];
  if (!((_a = config.region) == null ? void 0 : _a.trim())) {
    errors.push("Region/backend code is required");
  } else if ((0, import_regions.isIndiaRegion)(config.region)) {
    errors.push("India TAP connectivity is not implemented yet");
  } else if (!(0, import_regions.resolveSaicRegion)(config.region)) {
    errors.push("Unsupported SAIC region");
  }
  if (config.accountType !== "email" && config.accountType !== "phone") {
    errors.push("Login type must be email or phone");
  }
  if (!((_b = config.accountIdentifier) == null ? void 0 : _b.trim())) {
    errors.push("Email address or phone number is required");
  }
  if (config.accountType === "phone" && !((_c = config.phoneCountryCode) == null ? void 0 : _c.trim())) {
    errors.push("Phone country calling code is required");
  }
  if (!config.password) {
    errors.push("Password is required");
  }
  return errors;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  validateConfig
});
//# sourceMappingURL=config.js.map
