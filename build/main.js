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
var import_status_metadata = require("./status-metadata");
class MgSaic extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: "mg-saic"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  pollTimer;
  pollInProgress = false;
  stopping = false;
  client;
  loginOptions;
  accessToken;
  vehicles = [];
  async onReady() {
    var _a, _b, _c, _d, _e;
    const config = this.config;
    await this.setObjectNotExistsAsync("commands.refresh", {
      type: "state",
      common: {
        name: "Refresh vehicle status",
        type: "boolean",
        role: "button",
        read: false,
        write: true
      },
      native: {}
    });
    await this.setStateAsync("commands.refresh", { val: false, ack: true });
    this.subscribeStates("commands.refresh");
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
      this.client = new import_saic_client.SaicApiClient();
      this.loginOptions = {
        ...region,
        accountType: config.accountType,
        accountIdentifier: (_c = config.accountIdentifier) != null ? _c : "",
        phoneCountryCode: config.phoneCountryCode,
        password: (_d = config.password) != null ? _d : ""
      };
      const login = await this.client.login(this.loginOptions);
      this.accessToken = login.accessToken;
      this.vehicles = await this.client.listVehicles(this.loginOptions, login.accessToken);
      for (const vehicle of this.vehicles) {
        await this.createVehicleObjects(vehicle);
      }
      await this.setState("info.connection", true, true);
      this.log.info(`SAIC account authenticated; discovered ${this.vehicles.length} vehicle(s).`);
      await this.refreshVehicleStatuses();
      const intervalSeconds = (_e = config.pollIntervalSeconds) != null ? _e : import_config.DEFAULT_POLL_INTERVAL_SECONDS;
      this.pollTimer = this.setInterval(() => void this.refreshVehicleStatuses(), intervalSeconds * 1e3);
    } catch {
      const error = "SAIC login failed; check the selected region, account credentials, or connectivity";
      await this.setState("info.connection", false, true);
      await this.setState("info.lastError", error, true);
      this.log.warn(error);
    }
  }
  async refreshVehicleStatuses() {
    if (this.stopping || this.pollInProgress || !this.client || !this.loginOptions || !this.accessToken) {
      return;
    }
    this.pollInProgress = true;
    const statusErrors = [];
    try {
      for (const vehicle of this.vehicles) {
        if (this.stopping) {
          break;
        }
        try {
          const status = await this.client.getVehicleStatus(this.loginOptions, this.accessToken, vehicle.vin);
          await this.createVehicleStatusObjects(vehicle.vin, status);
        } catch (error) {
          const details = error instanceof Error ? error.message : "Unknown error";
          statusErrors.push(`Vehicle status request failed for ${vehicle.vin}: ${details}`);
          this.log.warn(`Could not retrieve current status for vehicle ${vehicle.vin}: ${details}`);
        }
        try {
          const status = await this.client.getCachedVehicleStatus(
            this.loginOptions,
            this.accessToken,
            vehicle.vin
          );
          await this.createVehicleStatusObjects(vehicle.vin, status, "cachedStatus", "SAIC cached status");
        } catch (error) {
          const details = error instanceof Error ? error.message : "Unknown error";
          statusErrors.push(`Cached vehicle status request failed for ${vehicle.vin}: ${details}`);
          this.log.warn(`Could not retrieve cached status for vehicle ${vehicle.vin}: ${details}`);
        }
      }
      if (!this.stopping) {
        await this.setState("info.lastError", statusErrors.join("; "), true);
      }
    } finally {
      this.pollInProgress = false;
    }
  }
  onStateChange(id, state) {
    if (id !== "commands.refresh" || !state || state.ack || state.val !== true || this.stopping) {
      return;
    }
    void this.setStateAsync("commands.refresh", { val: false, ack: true });
    void this.refreshVehicleStatuses();
  }
  async createVehicleStatusObjects(vin, status, channel = "status", channelName = "Current status") {
    const statusId = `vehicles.${vin}.${channel}`;
    await this.setObjectNotExistsAsync(statusId, {
      type: "channel",
      common: { name: channelName },
      native: {}
    });
    const values = { ...status.basicVehicleStatus };
    if (status.statusTime !== void 0) {
      values.statusTime = status.statusTime;
    }
    if (status.onlineStatus !== void 0) {
      values.onlineStatus = status.onlineStatus;
    }
    for (const [key, value] of Object.entries(values)) {
      const metadata = (0, import_status_metadata.getVehicleStatusMetadata)(key);
      await this.extendObjectAsync(`${statusId}.${key}`, {
        common: {
          type: metadata.type,
          role: metadata.role,
          ...metadata.unit ? { unit: metadata.unit } : {}
        }
      });
      await this.setStateAsync(`${statusId}.${key}`, { val: (0, import_status_metadata.normalizeVehicleStatusValue)(key, value), ack: true });
    }
  }
  async createVehicleObjects(vehicle) {
    const deviceId = `vehicles.${vehicle.vin}`;
    const values = {
      vin: vehicle.vin,
      name: vehicle.name,
      brandName: vehicle.brandName,
      modelName: vehicle.modelName,
      series: vehicle.series,
      modelYear: vehicle.modelYear,
      colorName: vehicle.colorName,
      isCurrentVehicle: vehicle.isCurrentVehicle,
      isSubaccount: vehicle.isSubaccount
    };
    await this.setObjectNotExistsAsync(deviceId, {
      type: "device",
      common: { name: vehicle.name || vehicle.modelName || vehicle.vin },
      native: {}
    });
    for (const [key, value] of Object.entries(values)) {
      if (value === void 0) {
        continue;
      }
      const isBoolean = typeof value === "boolean";
      await this.setObjectNotExistsAsync(`${deviceId}.${key}`, {
        type: "state",
        common: {
          name: key,
          type: isBoolean ? "boolean" : "string",
          role: isBoolean ? "indicator" : key === "vin" ? "text" : "info.name",
          read: true,
          write: false
        },
        native: {}
      });
      await this.setStateAsync(`${deviceId}.${key}`, { val: value, ack: true });
    }
  }
  onUnload(callback) {
    this.stopping = true;
    if (this.pollTimer) {
      this.clearInterval(this.pollTimer);
    }
    callback();
  }
}
if (require.main !== module) {
  module.exports = (options) => new MgSaic(options);
} else {
  (() => new MgSaic())();
}
//# sourceMappingURL=main.js.map
