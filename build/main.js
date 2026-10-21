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
var import_runtime_translations = require("./runtime-translations");
const vehicleCommands = [
  { id: "lock" },
  { id: "unlock" },
  { id: "openBoot" },
  { id: "climateStart" },
  { id: "climateStop" },
  { id: "frontDefrost" },
  { id: "rearWindowHeatStart" },
  { id: "rearWindowHeatStop" },
  { id: "batteryHeatStart" },
  { id: "batteryHeatStop" },
  { id: "chargingStart" },
  { id: "chargingStop" },
  { id: "chargingPortLock" },
  { id: "chargingPortUnlock" },
  { id: "findMyCar" }
];
const commandGroups = {
  lock: "access",
  unlock: "access",
  openBoot: "access",
  climateStart: "climate",
  climateStop: "climate",
  frontDefrost: "climate",
  rearWindowHeatStart: "heating",
  rearWindowHeatStop: "heating",
  batteryHeatStart: "heating",
  batteryHeatStop: "heating",
  chargingStart: "charging",
  chargingStop: "charging",
  chargingPortLock: "charging",
  chargingPortUnlock: "charging",
  findMyCar: "vehicle"
};
const settingGroups = {
  driverSeatHeatLevel: "heating",
  passengerSeatHeatLevel: "heating",
  climateTemperature: "climate",
  chargeTargetSoc: "charging",
  chargingCurrentLimit: "charging",
  chargingScheduleStart: "charging",
  chargingScheduleEnd: "charging",
  chargingScheduleMode: "charging",
  batteryHeatingScheduleEnabled: "schedules",
  batteryHeatingScheduleStart: "schedules"
};
const actionGroups = {
  climateTemperatureApply: "climate",
  chargingSettingsApply: "charging",
  chargingScheduleApply: "charging",
  batteryHeatingScheduleApply: "schedules"
};
function vehicleCommandPath(vin, id) {
  const group = id in commandGroups ? commandGroups[id] : id in settingGroups ? settingGroups[id] : actionGroups[id];
  if (!group) {
    throw new Error(`Missing command group for ${id}`);
  }
  return `vehicles.${vin}.commands.${group}.${id}`;
}
const settingActions = [
  { id: "climateTemperatureApply" },
  { id: "chargingSettingsApply" },
  { id: "chargingScheduleApply" },
  { id: "batteryHeatingScheduleApply" }
];
const EXPOSE_SOURCE_STATUS_DATAPOINTS = false;
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
  lastCanonicalStatusTimes = /* @__PURE__ */ new Map();
  vehicleCommandsInProgress = /* @__PURE__ */ new Set();
  async onReady() {
    var _a, _b, _c, _d, _e;
    if (this.stopping) {
      return;
    }
    const config = this.config;
    await this.extendObjectAsync("info", { common: { name: (0, import_runtime_translations.getRuntimeName)("info") } });
    await this.extendObjectAsync("info.backend", { common: { name: (0, import_runtime_translations.getRuntimeName)("backend") } });
    await this.extendObjectAsync("info.connection", { common: { name: (0, import_runtime_translations.getRuntimeName)("connection") } });
    await this.extendObjectAsync("info.lastError", { common: { name: (0, import_runtime_translations.getRuntimeName)("lastError") } });
    await this.setObjectNotExistsAsync("commands", {
      type: "channel",
      common: { name: (0, import_runtime_translations.getRuntimeName)("commands") },
      native: {}
    });
    await this.setObjectNotExistsAsync("vehicles", {
      type: "channel",
      common: { name: "Vehicles" },
      native: {}
    });
    await this.setObjectNotExistsAsync("commands.refresh", {
      type: "state",
      common: {
        name: (0, import_runtime_translations.getRuntimeName)("refresh"),
        type: "boolean",
        role: "button",
        read: false,
        write: true
      },
      native: {}
    });
    await this.extendObjectAsync("commands.refresh", { common: { name: (0, import_runtime_translations.getRuntimeName)("refresh") } });
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
      this.client = new import_saic_client.SaicApiClient(
        void 0,
        Date.now,
        void 0,
        (message) => this.log.debug(message),
        void 0,
        {
          setTimeout: (callback, milliseconds) => {
            const timer = this.setTimeout(callback, milliseconds);
            return () => {
              if (timer !== void 0) {
                this.clearTimeout(timer);
              }
            };
          }
        }
      );
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
        if (!EXPOSE_SOURCE_STATUS_DATAPOINTS) {
          await this.delObjectAsync(`vehicles.${vehicle.vin}.cachedStatus`, { recursive: true });
        }
        await this.delObjectAsync(`vehicles.${vehicle.vin}.canonicalStatus`, { recursive: true });
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
          try {
            const charging = await this.client.getVehicleChargingStatus(
              this.loginOptions,
              this.accessToken,
              vehicle.vin,
              this.abortController.signal
            );
            await this.createVehicleChargingObjects(vehicle.vin, charging);
          } catch (error) {
            if (this.stopping) {
              break;
            }
            const details = error instanceof Error ? error.message : "Unknown charging data error";
            statusErrors.push(`Charging data request failed for ${vehicle.vin}: ${details}`);
            this.log.warn(`Could not retrieve charging data for vehicle ${vehicle.vin}: ${details}`);
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
              const diagnostic = error instanceof import_saic_client.SaicRemoteInstructionError ? `SAIC/MG returned remote instruction code 4 for ${vehicle.vin}; this is a response from the MG/SAIC service or vehicle, not an adapter parsing/processing error. SAIC message: ${details}` : details;
              statusErrors.push(`Vehicle status request failed for ${vehicle.vin}: ${diagnostic}`);
              this.log.warn(
                `Could not retrieve current status for vehicle ${vehicle.vin}: ${diagnostic}`
              );
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
                if (EXPOSE_SOURCE_STATUS_DATAPOINTS) {
                  await this.createVehicleStatusObjects(
                    vehicle.vin,
                    cachedStatus,
                    "cachedStatus",
                    "cachedStatus"
                  );
                }
                await this.createCanonicalVehicleStatusObjects(vehicle.vin, cachedStatus, "cached");
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
            if (EXPOSE_SOURCE_STATUS_DATAPOINTS) {
              await this.createVehicleStatusObjects(vehicle.vin, status, "liveStatus", "liveStatus");
            }
            await this.createCanonicalVehicleStatusObjects(vehicle.vin, status, "live");
            if (!this.stopping && status.statusTime !== void 0) {
              this.lastStatusTimes.set(vehicle.vin, status.statusTime);
              if ((0, import_saic_client.isVehicleStatusNotOlder)(
                status.statusTime,
                this.lastCanonicalStatusTimes.get(vehicle.vin)
              )) {
                this.lastCanonicalStatusTimes.set(vehicle.vin, status.statusTime);
              }
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
    if (this.stopping) {
      return;
    }
    if ((0, import_refresh_command.isRefreshCommand)(id, this.namespace, state)) {
      void this.setStateAsync("commands.refresh", { val: false, ack: true }).catch((error) => {
        const details = error instanceof Error ? error.message : "Unknown state error";
        this.log.error(`Could not acknowledge refresh command: ${details}`);
      });
      this.triggerRefresh();
      return;
    }
    if (!state || state.ack) {
      return;
    }
    const settingAction = settingActions.find(
      ({ id: actionId }) => this.vehicles.some(({ vin }) => id === `${this.namespace}.${vehicleCommandPath(vin, actionId)}`)
    );
    const settingVehicle = this.vehicles.find(
      ({ vin }) => settingAction && id === `${this.namespace}.${vehicleCommandPath(vin, settingAction.id)}`
    );
    if (settingAction && settingVehicle) {
      void this.executeVehicleSetting(settingVehicle.vin, settingAction.id);
      return;
    }
    const settingInput = this.vehicles.flatMap(
      ({ vin }) => Object.keys(settingGroups).filter((stateId) => stateId !== "driverSeatHeatLevel" && stateId !== "passengerSeatHeatLevel").map((stateId) => ({ vin, stateId }))
    ).find(({ vin, stateId }) => id === `${this.namespace}.${vehicleCommandPath(vin, stateId)}`);
    if (settingInput) {
      void this.setStateAsync(vehicleCommandPath(settingInput.vin, settingInput.stateId), {
        val: state.val,
        ack: true
      });
      return;
    }
    const seatHeating = this.vehicles.flatMap(
      ({ vin }) => ["driverSeatHeatLevel", "passengerSeatHeatLevel"].map((stateId) => ({ vin, stateId }))
    ).find(({ vin, stateId }) => id === `${this.namespace}.${vehicleCommandPath(vin, stateId)}`);
    if (seatHeating) {
      const seat = seatHeating.stateId === "driverSeatHeatLevel" ? "driver" : "passenger";
      void this.executeSeatHeating(seatHeating.vin, seat, state.val);
      return;
    }
    if (state.val !== true) {
      return;
    }
    const commandEntry = vehicleCommands.find(
      ({ id: commandId }) => this.vehicles.some(({ vin }) => id === `${this.namespace}.${vehicleCommandPath(vin, commandId)}`)
    );
    const vehicle = this.vehicles.find(
      ({ vin }) => commandEntry && id === `${this.namespace}.${vehicleCommandPath(vin, commandEntry.id)}`
    );
    if (!commandEntry || !vehicle) {
      return;
    }
    void this.executeVehicleCommand(vehicle.vin, commandEntry.id);
  }
  async executeSeatHeating(vin, seat, value) {
    const stateId = vehicleCommandPath(vin, `${seat}SeatHeatLevel`);
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 3) {
      await this.setStateAsync(stateId, { ack: true });
      this.log.warn(`Ignored ${seat} seat heating level for ${vin}: expected an integer from 0 to 3`);
      return;
    }
    if (this.vehicleCommandsInProgress.has(vin)) {
      await this.setStateAsync(stateId, { ack: true });
      this.log.warn(`Ignored ${seat} seat heating for ${vin}: another vehicle command is still running`);
      return;
    }
    this.vehicleCommandsInProgress.add(vin);
    try {
      if (!this.client || !this.loginOptions) {
        throw new Error("SAIC client is not initialized");
      }
      if (!this.accessToken || this.accessTokenExpiresAt <= Date.now() + 3e4) {
        await this.authenticate();
      }
      await this.client.sendVehicleSeatHeating(
        this.loginOptions,
        this.accessToken,
        vin,
        seat,
        value,
        this.abortController.signal
      );
      await this.setStateAsync(stateId, { val: value, ack: true });
      this.log.info(`SAIC ${seat} seat heating level ${value} completed for ${vin}`);
    } catch (error) {
      if (!this.stopping) {
        await this.setStateAsync(stateId, { val: value, ack: true });
        const details = error instanceof Error ? error.message : "Unknown command error";
        this.log.warn(`SAIC ${seat} seat heating failed for ${vin}: ${details}`);
      }
    } finally {
      this.vehicleCommandsInProgress.delete(vin);
    }
  }
  async executeVehicleSetting(vin, action) {
    const stateId = vehicleCommandPath(vin, action);
    if (this.vehicleCommandsInProgress.has(vin)) {
      await this.setStateAsync(stateId, { val: false, ack: true });
      this.log.warn(`Ignored ${action} for ${vin}: another vehicle command is still running`);
      return;
    }
    this.vehicleCommandsInProgress.add(vin);
    try {
      await this.setStateAsync(stateId, { val: false, ack: true });
      if (!this.client || !this.loginOptions) {
        throw new Error("SAIC client is not initialized");
      }
      const setting = await this.readVehicleSetting(vin, action);
      if (!this.accessToken || this.accessTokenExpiresAt <= Date.now() + 3e4) {
        await this.authenticate();
      }
      await this.client.sendVehicleSetting(
        this.loginOptions,
        this.accessToken,
        vin,
        setting,
        this.abortController.signal
      );
      this.log.info(`SAIC ${action} completed for ${vin}`);
    } catch (error) {
      if (!this.stopping) {
        const details = error instanceof Error ? error.message : "Unknown settings error";
        this.log.warn(`SAIC ${action} failed for ${vin}: ${details}`);
      }
    } finally {
      this.vehicleCommandsInProgress.delete(vin);
    }
  }
  async readVehicleSetting(vin, action) {
    const readNumber = async (id) => {
      const state = await this.getStateAsync(vehicleCommandPath(vin, id));
      if (!state || typeof state.val !== "number" || !Number.isFinite(state.val)) {
        throw new Error(`Setting ${id} must contain a finite number`);
      }
      return state.val;
    };
    const readString = async (id) => {
      const state = await this.getStateAsync(vehicleCommandPath(vin, id));
      if (!state || typeof state.val !== "string") {
        throw new Error(`Setting ${id} must contain a time in HH:MM format`);
      }
      return state.val;
    };
    if (action === "climateTemperatureApply") {
      const vehicle = this.vehicles.find((item) => item.vin === vin);
      return {
        type: "climateTemperature",
        value: (0, import_saic_client.climateTemperatureToIndex)(await readNumber("climateTemperature"), vehicle == null ? void 0 : vehicle.series)
      };
    }
    if (action === "chargingSettingsApply") {
      return {
        type: "chargingSettings",
        targetSoc: (0, import_saic_client.targetSocPercentToCode)(await readNumber("chargeTargetSoc")),
        currentLimit: await readNumber("chargingCurrentLimit")
      };
    }
    if (action === "chargingScheduleApply") {
      return {
        type: "chargingSchedule",
        start: await readString("chargingScheduleStart"),
        end: await readString("chargingScheduleEnd"),
        mode: await readNumber("chargingScheduleMode")
      };
    }
    const enabled = await this.getStateAsync(vehicleCommandPath(vin, "batteryHeatingScheduleEnabled"));
    if (!enabled || typeof enabled.val !== "boolean") {
      throw new Error("Battery heating schedule enabled must be boolean");
    }
    return {
      type: "batteryHeatingSchedule",
      enabled: enabled.val,
      start: await readString("batteryHeatingScheduleStart")
    };
  }
  async executeVehicleCommand(vin, command) {
    const stateId = vehicleCommandPath(vin, command);
    if (this.vehicleCommandsInProgress.has(vin)) {
      await this.setStateAsync(stateId, { val: false, ack: true });
      this.log.warn(`Ignored ${command} command for ${vin}: another vehicle command is still running`);
      return;
    }
    this.vehicleCommandsInProgress.add(vin);
    try {
      await this.setStateAsync(stateId, { val: false, ack: true });
      if (!this.client || !this.loginOptions) {
        throw new Error("SAIC client is not initialized");
      }
      if (!this.accessToken || this.accessTokenExpiresAt <= Date.now() + 3e4) {
        await this.authenticate();
      }
      await this.client.sendVehicleCommand(
        this.loginOptions,
        this.accessToken,
        vin,
        command,
        this.abortController.signal
      );
      this.log.info(`SAIC ${command} command completed for ${vin}`);
    } catch (error) {
      if (!this.stopping) {
        const details = error instanceof Error ? error.message : "Unknown command error";
        this.log.warn(`SAIC ${command} command failed for ${vin}: ${details}`);
      }
    } finally {
      this.vehicleCommandsInProgress.delete(vin);
    }
  }
  async createVehicleStatusObjects(vin, status, channel = "status", channelName = "currentStatus") {
    if (this.stopping) {
      return;
    }
    if (!EXPOSE_SOURCE_STATUS_DATAPOINTS && (channel === "liveStatus" || channel === "cachedStatus")) {
      return;
    }
    const statusId = `vehicles.${vin}.${channel}`;
    await this.setObjectNotExistsAsync(statusId, {
      type: "channel",
      common: { name: (0, import_runtime_translations.getRuntimeName)(channelName) },
      native: {}
    });
    await this.extendObjectAsync(statusId, { common: { name: (0, import_runtime_translations.getRuntimeName)(channelName) } });
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
      const stateId = `${groupId}.${key}`;
      if (value === void 0) {
        if ((0, import_status_metadata.shouldDeleteUnavailableStatusValue)(key)) {
          await this.delObjectAsync(stateId);
        }
        continue;
      }
      await this.setObjectNotExistsAsync(groupId, {
        type: "channel",
        common: { name: (0, import_runtime_translations.getRuntimeName)(group) },
        native: {}
      });
      await this.extendObjectAsync(groupId, { common: { name: (0, import_runtime_translations.getRuntimeName)(group) } });
      if (this.stopping) {
        return;
      }
      const metadata = (0, import_status_metadata.getVehicleStatusMetadata)(key);
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
  async createVehicleChargingObjects(vin, charging) {
    const statusId = `vehicles.${vin}.status`;
    const rootId = `${statusId}.charging`;
    await this.setObjectNotExistsAsync(statusId, {
      type: "channel",
      common: { name: (0, import_runtime_translations.getRuntimeName)("currentStatus") },
      native: {}
    });
    await this.setObjectNotExistsAsync(rootId, {
      type: "channel",
      common: { name: (0, import_runtime_translations.getRuntimeName)("commandGroup_charging") },
      native: {}
    });
    for (const group of ["chrgMgmtData", "rvsChargeStatus"]) {
      const groupId = `${rootId}.${group}`;
      const groupName = (0, import_runtime_translations.getRuntimeName)(group === "chrgMgmtData" ? "chargingManagement" : "chargeStatus");
      await this.setObjectNotExistsAsync(groupId, {
        type: "channel",
        common: { name: groupName },
        native: {}
      });
      await this.extendObjectAsync(groupId, { common: { name: groupName } });
      for (const [field, value] of Object.entries(charging[group])) {
        if (this.stopping) {
          return;
        }
        const stateId = `${groupId}.${field}`;
        if (value === void 0) {
          await this.delObjectAsync(stateId);
          continue;
        }
        const metadata = (0, import_status_metadata.getChargingFieldMetadata)(field);
        const common = {
          name: (0, import_runtime_translations.getChargingFieldName)(field),
          type: metadata.type === "boolean" ? "boolean" : typeof value === "string" ? "string" : "number",
          role: typeof value === "string" ? "text" : metadata.role,
          read: true,
          write: false
        };
        if (metadata.unit) {
          common.unit = metadata.unit;
        }
        await this.setObjectNotExistsAsync(stateId, { type: "state", common, native: {} });
        await this.extendObjectAsync(stateId, { common });
        await this.setStateAsync(stateId, {
          val: (0, import_status_metadata.normalizeChargingValue)(field, value),
          ack: true
        });
      }
    }
    await this.delObjectAsync(`vehicles.${vin}.charging`, { recursive: true });
  }
  async createCanonicalVehicleStatusObjects(vin, status, source) {
    if (this.stopping || !(0, import_saic_client.isVehicleStatusNotOlder)(status.statusTime, this.lastCanonicalStatusTimes.get(vin))) {
      return;
    }
    await this.createVehicleStatusObjects(vin, status);
    if (this.stopping) {
      return;
    }
    const sourceId = `vehicles.${vin}.status.source`;
    await this.setObjectNotExistsAsync(sourceId, {
      type: "state",
      common: { name: (0, import_runtime_translations.getRuntimeName)("statusSource"), type: "string", role: "text", read: true, write: false },
      native: {}
    });
    await this.extendObjectAsync(sourceId, { common: { name: (0, import_runtime_translations.getRuntimeName)("statusSource") } });
    if (this.stopping) {
      return;
    }
    await this.setStateAsync(sourceId, { val: source, ack: true });
    if (status.statusTime !== void 0) {
      const sourceTimestampId = `vehicles.${vin}.status.sourceTimestamp`;
      await this.setObjectNotExistsAsync(sourceTimestampId, {
        type: "state",
        common: {
          name: (0, import_runtime_translations.getRuntimeName)("statusSourceTimestamp"),
          type: "number",
          role: "date",
          read: true,
          write: false
        },
        native: {}
      });
      await this.extendObjectAsync(sourceTimestampId, {
        common: { name: (0, import_runtime_translations.getRuntimeName)("statusSourceTimestamp") }
      });
      await this.setStateAsync(sourceTimestampId, { val: status.statusTime * 1e3, ack: true });
      this.lastCanonicalStatusTimes.set(vin, status.statusTime);
    }
  }
  async createVehicleObjects(vehicle) {
    var _a, _b;
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
    const commandsId = `${deviceId}.commands`;
    await this.setObjectNotExistsAsync(commandsId, {
      type: "channel",
      common: { name: (0, import_runtime_translations.getRuntimeName)("commands") },
      native: {}
    });
    await this.extendObjectAsync(commandsId, { common: { name: (0, import_runtime_translations.getRuntimeName)("commands") } });
    for (const group of ["access", "climate", "heating", "charging", "schedules", "vehicle"]) {
      const groupId = `${commandsId}.${group}`;
      const groupName = (0, import_runtime_translations.getRuntimeName)(`commandGroup_${group}`);
      await this.setObjectNotExistsAsync(groupId, {
        type: "channel",
        common: { name: groupName },
        native: {}
      });
      await this.extendObjectAsync(groupId, { common: { name: groupName } });
    }
    for (const command of vehicleCommands) {
      const commandId = vehicleCommandPath(vehicle.vin, command.id);
      await this.setObjectNotExistsAsync(commandId, {
        type: "state",
        common: {
          name: (0, import_runtime_translations.getRuntimeName)(command.id),
          type: "boolean",
          role: "button",
          read: false,
          write: true
        },
        native: {}
      });
      await this.extendObjectAsync(commandId, {
        common: { name: (0, import_runtime_translations.getRuntimeName)(command.id) }
      });
      await this.setStateAsync(commandId, { val: false, ack: true });
    }
    const settingStates = [
      {
        id: "driverSeatHeatLevel",
        type: "number",
        role: "level",
        def: 0,
        min: 0,
        max: 3,
        states: { 0: "Off", 1: "Low", 2: "Medium", 3: "High" }
      },
      {
        id: "passengerSeatHeatLevel",
        type: "number",
        role: "level",
        def: 0,
        min: 0,
        max: 3,
        states: { 0: "Off", 1: "Low", 2: "Medium", 3: "High" }
      },
      {
        id: "climateTemperature",
        type: "number",
        role: "level.temperature",
        def: 22,
        min: (0, import_saic_client.getClimateTemperatureRange)(vehicle.series).min,
        max: (0, import_saic_client.getClimateTemperatureRange)(vehicle.series).max,
        unit: "\xB0C"
      },
      {
        id: "chargeTargetSoc",
        type: "number",
        role: "level",
        def: 80,
        min: 40,
        max: 100,
        step: 10,
        unit: "%",
        states: { 40: "40%", 50: "50%", 60: "60%", 70: "70%", 80: "80%", 90: "90%", 100: "100%" }
      },
      {
        id: "chargingCurrentLimit",
        type: "number",
        role: "level",
        def: 4,
        min: 1,
        max: 4,
        states: { 1: "6 A", 2: "8 A", 3: "16 A", 4: "Maximum" }
      },
      {
        id: "chargingScheduleStart",
        type: "string",
        role: "text",
        def: "00:00"
      },
      {
        id: "chargingScheduleEnd",
        type: "string",
        role: "text",
        def: "06:00"
      },
      {
        id: "chargingScheduleMode",
        type: "number",
        role: "level",
        def: 2,
        min: 1,
        max: 3,
        states: { 1: "Until configured time", 2: "Disabled", 3: "Until configured SOC" }
      },
      {
        id: "batteryHeatingScheduleEnabled",
        type: "boolean",
        role: "switch",
        def: false
      },
      {
        id: "batteryHeatingScheduleStart",
        type: "string",
        role: "text",
        def: "00:00"
      }
    ];
    for (const setting of settingStates) {
      const stateId = vehicleCommandPath(vehicle.vin, setting.id);
      const legacyStateId = `${commandsId}.${setting.id}`;
      const stateObject = await this.getObjectAsync(stateId);
      const legacyState = await this.getStateAsync(legacyStateId);
      const previousScheduleState = setting.id.startsWith("chargingSchedule") ? await this.getStateAsync(`${commandsId}.schedules.${setting.id}`) : null;
      await this.setObjectNotExistsAsync(stateId, {
        type: "state",
        common: {
          name: (0, import_runtime_translations.getRuntimeName)(setting.id),
          type: setting.type,
          role: setting.role,
          read: true,
          write: true,
          def: setting.def,
          ...setting.min === void 0 ? {} : { min: setting.min },
          ...setting.max === void 0 ? {} : { max: setting.max },
          ...setting.step === void 0 ? {} : { step: setting.step },
          ...setting.unit === void 0 ? {} : { unit: setting.unit },
          ...setting.states ? { states: setting.states } : {}
        },
        native: {}
      });
      const currentState = await this.getStateAsync(stateId);
      if (!currentState || currentState.val === null) {
        await this.setStateAsync(stateId, {
          val: (_b = (_a = legacyState == null ? void 0 : legacyState.val) != null ? _a : previousScheduleState == null ? void 0 : previousScheduleState.val) != null ? _b : setting.def,
          ack: true
        });
      } else if (typeof currentState.val === "number" && (stateObject == null ? void 0 : stateObject.common.unit) !== setting.unit) {
        if (setting.id === "chargeTargetSoc" && currentState.val >= 1 && currentState.val <= 7) {
          await this.setStateAsync(stateId, { val: (currentState.val + 3) * 10, ack: true });
        }
      }
      await this.extendObjectAsync(stateId, {
        common: {
          name: (0, import_runtime_translations.getRuntimeName)(setting.id),
          type: setting.type,
          role: setting.role,
          read: true,
          write: true,
          def: setting.def,
          ...setting.min === void 0 ? {} : { min: setting.min },
          ...setting.max === void 0 ? {} : { max: setting.max },
          ...setting.step === void 0 ? {} : { step: setting.step },
          ...setting.unit === void 0 ? {} : { unit: setting.unit },
          ...setting.states ? { states: setting.states } : {}
        }
      });
      await this.delObjectAsync(legacyStateId);
    }
    for (const action of settingActions) {
      const actionId = vehicleCommandPath(vehicle.vin, action.id);
      await this.setObjectNotExistsAsync(actionId, {
        type: "state",
        common: { name: (0, import_runtime_translations.getRuntimeName)(action.id), type: "boolean", role: "button", read: false, write: true },
        native: {}
      });
      await this.extendObjectAsync(actionId, {
        common: { name: (0, import_runtime_translations.getRuntimeName)(action.id) }
      });
      await this.setStateAsync(actionId, { val: false, ack: true });
      await this.delObjectAsync(`${commandsId}.${action.id}`);
    }
    for (const id of [
      "chargingScheduleStart",
      "chargingScheduleEnd",
      "chargingScheduleMode",
      "chargingScheduleApply"
    ]) {
      await this.delObjectAsync(`${commandsId}.schedules.${id}`);
    }
    for (const command of vehicleCommands) {
      await this.delObjectAsync(`${commandsId}.${command.id}`);
    }
    this.subscribeStates(`${commandsId}.*`);
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
      const name = (0, import_runtime_translations.getRuntimeName)(key);
      await this.setObjectNotExistsAsync(`${deviceId}.${key}`, {
        type: "state",
        common: {
          name,
          type: isBoolean ? "boolean" : "string",
          role: isBoolean ? "indicator" : key === "vin" ? "text" : "info.name",
          read: true,
          write: false
        },
        native: {}
      });
      await this.extendObjectAsync(`${deviceId}.${key}`, { common: { name } });
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
