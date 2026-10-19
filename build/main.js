"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_config = require("./config");
var import_saic_client = require("./saic-client");
var import_regions = require("./regions");
class MgSaic extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: "mg-saic"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    var _a, _b, _c, _d;
    const config = this.config;
    await this.setState("info.connection", false, true);
    await this.setState("info.backend", ((_a = config.region) == null ? void 0 : _a.trim()) || "not configured", true);
    const errors = (0, import_config.validateConfig)(config);
    await this.setState("info.lastError", errors.join("; "), true);
    if (errors.length) {
      this.log.warn(`Configuration is incomplete: ${errors.join("; ")}`);
      return;
    }
    const region = (0, import_regions.resolveSaicRegion)((_b = config.region) != null ? _b : "");
    if (!region) {
      return;
    }
    try {
      await new import_saic_client.SaicApiClient().login({
        ...region,
        accountType: config.accountType,
        accountIdentifier: (_c = config.accountIdentifier) != null ? _c : "",
        phoneCountryCode: config.phoneCountryCode,
        password: (_d = config.password) != null ? _d : ""
      });
      await this.setState("info.connection", true, true);
      await this.setState("info.lastError", "", true);
      this.log.info("SAIC account authenticated. Vehicle discovery is not implemented yet.");
    } catch {
      const error = "SAIC login failed; check the selected region, account credentials, or connectivity";
      await this.setState("info.connection", false, true);
      await this.setState("info.lastError", error, true);
      this.log.warn(error);
    }
  }
  onUnload(callback) {
    callback();
  }
}
if (require.main !== module) {
  module.exports = (options) => new MgSaic(options);
} else {
  (() => new MgSaic())();
}
//# sourceMappingURL=main.js.map
