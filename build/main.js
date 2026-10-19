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
var import_refresh_command = require("./refresh-command");
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
  refreshQueued = false;
  stopping = false;
  unloadCallbackCalled = false;
  abortController = new AbortController();
  client;
  loginOptions;
  accessToken;
  accessTokenExpiresAt = 0;
  vehicles = [];
  lastStatusTimes = /* @__PURE__ */ new Map();
  async onReady() {
    var _a, _b, _c, _d, _e;
    if (this.stopping) {
      return;
    }
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
    if (this.stopping) {
      return;
    }
    await this.setStateAsync("commands.refresh", { val: false, ack: true });
    if (this.stopping) {
      return;
    }
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
      this.client = new import_saic_client.SaicApiClient(void 0, Date.now, void 0, (message) => this.log.debug(message));
      this.loginOptions = {
        ...region,
        accountType: config.accountType,
        accountIdentifier: (_c = config.accountIdentifier) != null ? _c : "",
        phoneCountryCode: config.phoneCountryCode,
        password: (_d = config.password) != null ? _d : ""
      };
      await this.authenticate();
      if (this.stopping) {
        return;
      }
      this.vehicles = await this.client.listVehicles(
        this.loginOptions,
        this.accessToken,
        this.abortController.signal
      );
    } catch (error) {
      if (this.stopping) {
        return;
      }
      const details = error instanceof Error ? error.message : "Unknown initialization error";
      const message = `SAIC initialization failed: ${details}`;
      await this.setState("info.connection", false, true);
      await this.setState("info.lastError", message, true);
      this.log.warn(message);
      return;
    }
    try {
      for (const vehicle of this.vehicles) {
        if (this.stopping) {
          return;
        }
        await this.createVehicleObjects(vehicle);
      }
      await this.setState("info.connection", true, true);
      this.log.info(`SAIC account authenticated; discovered ${this.vehicles.length} vehicle(s).`);
      if (this.vehicles.length === 0) {
        await this.setState("info.lastError", "No vehicles are linked to this SAIC account", true);
        this.log.warn("No vehicles are linked to this SAIC account.");
        return;
      }
      await this.refreshVehicleStatuses();
      const intervalSeconds = (_e = config.pollIntervalSeconds) != null ? _e : import_config.DEFAULT_POLL_INTERVAL_SECONDS;
      if (!this.stopping) {
        this.pollTimer = this.setInterval(() => this.triggerRefresh(), intervalSeconds * 1e3);
      }
    } catch (error) {
      if (this.stopping) {
        return;
      }
      const details = error instanceof Error ? error.message : "Unknown local adapter error";
      await this.setState("info.lastError", `Could not initialize vehicle objects: ${details}`, true);
      this.log.error(`Could not initialize vehicle objects: ${details}`);
    }
  }
  async authenticate() {
    if (!this.client || !this.loginOptions || this.stopping) {
      throw new Error("Adapter is stopping or not initialized");
    }
    const login = await this.client.login(this.loginOptions, this.abortController.signal);
    if (this.stopping) {
      return;
    }
    this.accessToken = login.accessToken;
    this.accessTokenExpiresAt = Date.now() + login.expiresIn * 1e3;
    await this.setState("info.connection", true, true);
  }
  triggerRefresh() {
    void this.refreshVehicleStatuses().catch((error) => {
      const details = error instanceof Error ? error.message : "Unknown refresh error";
      this.log.error(`Vehicle status refresh failed: ${details}`);
    });
  }
  async refreshVehicleStatuses() {
    var _a;
    if (this.stopping || !this.client || !this.loginOptions || !this.accessToken) {
      return;
    }
    if (this.pollInProgress) {
      this.refreshQueued = true;
      return;
    }
    this.pollInProgress = true;
    const statusErrors = [];
    let followUpUsed = false;
    try {
      do {
        this.refreshQueued = false;
        for (const vehicle of this.vehicles) {
          if (this.stopping) {
            break;
          }
          if (Date.now() >= this.accessTokenExpiresAt - 6e4) {
            try {
              await this.authenticate();
            } catch (error) {
              if (this.stopping) {
                break;
              }
              const details = error instanceof Error ? error.message : "Unknown authentication error";
              statusErrors.push(`SAIC re-authentication failed: ${details}`);
              await this.setState("info.connection", false, true);
              break;
            }
          }
          let status;
          try {
            this.log.debug(`Refreshing live status for ${vehicle.vin}`);
            status = await this.client.getVehicleStatus(
              this.loginOptions,
              this.accessToken,
              vehicle.vin,
              this.abortController.signal
            );
          } catch (error) {
            if (this.stopping) {
              break;
            }
            if (error instanceof import_saic_client.SaicHttpError && (error.status === 401 || error.status === 403)) {
              try {
                await this.authenticate();
                status = await this.client.getVehicleStatus(
                  this.loginOptions,
                  this.accessToken,
                  vehicle.vin,
                  this.abortController.signal
                );
              } catch (reauthError) {
                if (this.stopping) {
                  break;
                }
                const details = reauthError instanceof Error ? reauthError.message : "Unknown authentication error";
                statusErrors.push(`SAIC re-authentication failed for ${vehicle.vin}: ${details}`);
                await this.setState("info.connection", false, true);
                continue;
              }
            } else {
              const details = error instanceof Error ? error.message : "Unknown error";
              statusErrors.push(`Vehicle status request failed for ${vehicle.vin}: ${details}`);
              this.log.warn(`Could not retrieve current status for vehicle ${vehicle.vin}: ${details}`);
              let cachedStatus;
              try {
                this.log.debug(`Refreshing cached status as fallback for ${vehicle.vin}`);
                cachedStatus = await this.client.getCachedVehicleStatus(
                  this.loginOptions,
                  this.accessToken,
                  vehicle.vin,
                  this.abortController.signal
                );
              } catch (cacheError) {
                if (this.stopping) {
                  break;
                }
                const cacheDetails = cacheError instanceof Error ? cacheError.message : "Unknown error";
                statusErrors.push(
                  `Cached vehicle status request failed for ${vehicle.vin}: ${cacheDetails}`
                );
                this.log.warn(
                  `Could not retrieve cached status for vehicle ${vehicle.vin}: ${cacheDetails}`
                );
                continue;
              }
              try {
                await this.createVehicleStatusObjects(
                  vehicle.vin,
                  cachedStatus,
                  "cachedStatus",
                  "SAIC cached status"
                );
              } catch (error2) {
                const writeDetails = error2 instanceof Error ? error2.message : "Unknown state write error";
                statusErrors.push(`Could not write cached status for ${vehicle.vin}: ${writeDetails}`);
                this.log.error(`Could not write cached status for ${vehicle.vin}: ${writeDetails}`);
              }
              continue;
            }
          }
          if (this.stopping) {
            break;
          }
          if (!(0, import_saic_client.isVehicleStatusNotOlder)(status.statusTime, this.lastStatusTimes.get(vehicle.vin))) {
            statusErrors.push(`Ignored older live status for ${vehicle.vin}`);
            continue;
          }
          try {
            this.log.debug(
              `Received live status for ${vehicle.vin}: ${Object.keys(status.basicVehicleStatus).length} basic fields, statusTime ${(_a = status.statusTime) != null ? _a : "missing"}`
            );
            await this.createVehicleStatusObjects(vehicle.vin, status);
            if (!this.stopping && status.statusTime !== void 0) {
              this.lastStatusTimes.set(vehicle.vin, status.statusTime);
            }
            this.log.debug(`Created/updated live status objects for ${vehicle.vin}`);
          } catch (error) {
            const details = error instanceof Error ? error.message : "Unknown state write error";
            statusErrors.push(`Could not write live status for ${vehicle.vin}: ${details}`);
            this.log.error(`Could not write live status for ${vehicle.vin}: ${details}`);
          }
        }
        if (this.refreshQueued && followUpUsed) {
          this.refreshQueued = false;
        } else if (this.refreshQueued) {
          followUpUsed = true;
        }
      } while (this.refreshQueued && !this.stopping);
      if (!this.stopping) {
        await this.setState("info.lastError", statusErrors.join("; "), true);
      }
    } finally {
      this.pollInProgress = false;
    }
  }
  onStateChange(id, state) {
    if (!(0, import_refresh_command.isRefreshCommand)(id, this.namespace, state) || this.stopping) {
      return;
    }
    void this.setStateAsync("commands.refresh", { val: false, ack: true }).catch((error) => {
      const details = error instanceof Error ? error.message : "Unknown state error";
      this.log.error(`Could not acknowledge refresh command: ${details}`);
    });
    this.triggerRefresh();
  }
  async createVehicleStatusObjects(vin, status, channel = "status", channelName = "Current status") {
    if (this.stopping) {
      return;
    }
    const statusId = `vehicles.${vin}.${channel}`;
    await this.setObjectNotExistsAsync(statusId, {
      type: "channel",
      common: { name: channelName },
      native: {}
    });
    if (this.stopping) {
      return;
    }
    const values = { ...status.basicVehicleStatus };
    if (status.statusTime !== void 0) {
      values.statusTime = status.statusTime;
    }
    if (status.onlineStatus !== void 0) {
      values.onlineStatus = status.onlineStatus;
    }
    this.log.debug(`Writing ${Object.keys(values).length} values under ${statusId}`);
    for (const [key, value] of Object.entries(values)) {
      if (this.stopping) {
        return;
      }
      const group = (0, import_status_metadata.getVehicleStatusGroup)(key);
      const groupId = `${statusId}.${group}`;
      await this.setObjectNotExistsAsync(groupId, {
        type: "channel",
        common: { name: group },
        native: {}
      });
      if (this.stopping) {
        return;
      }
      const metadata = (0, import_status_metadata.getVehicleStatusMetadata)(key);
      const stateId = `${groupId}.${key}`;
      const common = {
        name: metadata.name,
        type: metadata.type,
        role: metadata.role,
        read: true,
        write: false,
        ...metadata.unit ? { unit: metadata.unit } : {}
      };
      await this.setObjectNotExistsAsync(stateId, {
        type: "state",
        common,
        native: {}
      });
      if (this.stopping) {
        return;
      }
      await this.extendObjectAsync(stateId, {
        type: "state",
        common,
        native: {}
      });
      if (this.stopping) {
        return;
      }
      await this.setStateAsync(stateId, { val: (0, import_status_metadata.normalizeVehicleStatusValue)(key, value), ack: true });
      if (this.stopping) {
        return;
      }
      await this.delObjectAsync(`${statusId}.${key}`);
    }
  }
  async createVehicleObjects(vehicle) {
    if (this.stopping) {
      return;
    }
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
    if (this.stopping) {
      return;
    }
    for (const [key, value] of Object.entries(values)) {
      if (this.stopping) {
        return;
      }
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
      if (this.stopping) {
        return;
      }
      await this.setStateAsync(`${deviceId}.${key}`, { val: value, ack: true });
    }
  }
  onUnload(callback) {
    if (this.unloadCallbackCalled) {
      return;
    }
    this.unloadCallbackCalled = true;
    this.stopping = true;
    this.abortController.abort(new DOMException("Adapter is stopping", "AbortError"));
    this.refreshQueued = false;
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
