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
var saic_client_exports = {};
__export(saic_client_exports, {
  SaicApiClient: () => SaicApiClient,
  SaicHttpError: () => SaicHttpError,
  SaicRemoteInstructionError: () => SaicRemoteInstructionError,
  climateTemperatureToIndex: () => climateTemperatureToIndex,
  getClimateTemperatureRange: () => getClimateTemperatureRange,
  isVehicleStatusNotOlder: () => isVehicleStatusNotOlder,
  isVehicleStatusTimestampValid: () => isVehicleStatusTimestampValid,
  targetSocPercentToCode: () => targetSocPercentToCode
});
module.exports = __toCommonJS(saic_client_exports);
var import_node_crypto = require("node:crypto");
var import_node_timers = require("node:timers");
var import_saic_crypto = require("./saic-crypto");
function getClimateTemperatureRange(series) {
  if (series == null ? void 0 : series.startsWith("EH32")) {
    return { min: 17, max: 31 };
  }
  if (series == null ? void 0 : series.startsWith("MZS3E")) {
    return { min: 16, max: 31 };
  }
  return { min: 16, max: 28 };
}
function climateTemperatureToIndex(temperature, series) {
  const { min, max } = getClimateTemperatureRange(series);
  if (!Number.isInteger(temperature) || temperature < min || temperature > max) {
    throw new Error(`Climate temperature must be an integer from ${min} to ${max} C`);
  }
  return ((series == null ? void 0 : series.startsWith("EH32")) ? 3 : 2) + temperature - min;
}
function targetSocPercentToCode(percentage) {
  if (!Number.isInteger(percentage) || percentage < 40 || percentage > 100 || percentage % 10 !== 0) {
    throw new Error("Charge target must be 40 to 100 percent in 10 percent steps");
  }
  return percentage / 10 - 3;
}
const defaultTimerFunctions = {
  setTimeout: (callback, milliseconds) => {
    const timer = (0, import_node_timers.setTimeout)(callback, milliseconds);
    return () => (0, import_node_timers.clearTimeout)(timer);
  }
};
class RetryableVehicleStatusError extends Error {
}
class SaicBodyReadError extends Error {
}
class SaicRemoteInstructionError extends Error {
}
class SaicHttpError extends Error {
  /**
   * @param message Bounded request error message.
   * @param status HTTP status code.
   */
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
function isVehicleStatusTimestampValid(statusTime, now) {
  if (statusTime === void 0) {
    return true;
  }
  const timestampMs = statusTime * 1e3;
  return Number.isFinite(timestampMs) && timestampMs <= now + 5 * 6e4 && timestampMs >= now - 24 * 60 * 6e4;
}
function isVehicleStatusNotOlder(statusTime, previousStatusTime) {
  return statusTime === void 0 || previousStatusTime === void 0 || statusTime >= previousStatusTime;
}
class SaicApiClient {
  fetchFunction;
  now;
  monotonicNow;
  wait;
  timerFunctions;
  /**
   * @param fetchFunction HTTP transport, injectable for tests.
   * @param now Clock function returning milliseconds since epoch.
   * @param wait Delay function used between retry attempts.
   * @param debug Optional debug logger that receives status diagnostics without response values.
   * @param monotonicNow Monotonic clock used to bound live event polling.
   * @param timerFunctions Optional timer functions used for HTTP request timeouts.
   */
  constructor(fetchFunction = fetch, now = Date.now, wait = void 0, debug = () => void 0, monotonicNow = () => performance.now(), timerFunctions = defaultTimerFunctions) {
    this.fetchFunction = fetchFunction;
    this.now = now;
    this.wait = wait != null ? wait : ((milliseconds, signal) => new Promise((resolve, reject) => {
      if (signal == null ? void 0 : signal.aborted) {
        reject(signal.reason instanceof Error ? signal.reason : new Error("Request was aborted"));
        return;
      }
      const timerHandle = {};
      const onAbort = () => {
        var _a;
        (_a = timerHandle.cancel) == null ? void 0 : _a.call(timerHandle);
        reject((signal == null ? void 0 : signal.reason) instanceof Error ? signal.reason : new Error("Request was aborted"));
      };
      timerHandle.cancel = this.timerFunctions.setTimeout(() => {
        signal == null ? void 0 : signal.removeEventListener("abort", onAbort);
        resolve();
      }, milliseconds);
      signal == null ? void 0 : signal.addEventListener("abort", onAbort, { once: true });
    }));
    this.monotonicNow = monotonicNow;
    this.timerFunctions = timerFunctions;
    this.debug = debug;
  }
  debug;
  /**
   * Sign in and return a validated access token.
   *
   * @param options Account and regional API settings.
   * @param signal Optional caller cancellation signal.
   */
  async login(options, signal) {
    var _a, _b;
    const requestTime = this.now();
    const timestamp = String(requestTime);
    const contentType = "application/x-www-form-urlencoded";
    const form = new URLSearchParams({
      grant_type: "password",
      username: options.accountIdentifier,
      password: (0, import_saic_crypto.sha1PasswordDigest)(options.password),
      scope: "all",
      deviceId: `simulator*********************************************${Math.floor(requestTime / 1e3)}###com.saicmotor.europecar`,
      deviceType: "0",
      language: "EN",
      loginType: options.accountType === "email" ? "2" : "1"
    });
    if (options.accountType === "phone") {
      if (!options.phoneCountryCode) {
        throw new Error("Phone country calling code is required");
      }
      form.set("countryCode", options.phoneCountryCode);
    }
    const requestPath = "/oauth/token";
    const requestBody = form.toString();
    const encryptedBody = (0, import_saic_crypto.encryptSaicRequestBody)(
      requestPath,
      options.tenantId,
      "",
      timestamp,
      contentType,
      requestBody
    );
    const headers = {
      Authorization: "Basic c3dvcmQ6c3dvcmRfc2VjcmV0",
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "Content-Type": `${contentType};charset=utf-8`,
      "ORIGINAL-CONTENT-TYPE": contentType,
      "APP-SEND-DATE": timestamp,
      "APP-CONTENT-ENCRYPTED": "1",
      "APP-LANGUAGE-TYPE": "en",
      "APP-VERIFICATION-STRING": (0, import_saic_crypto.createSaicRequestSignature)(
        requestPath,
        options.tenantId,
        "",
        timestamp,
        contentType,
        encryptedBody
      ),
      REGION: options.regionCode,
      "tenant-id": options.tenantId,
      "User-Type": "app",
      "User-Agent": "Europe/2.1.0 (iPad; iOS 18.5; Scale/2.00)"
    };
    let result;
    try {
      const baseUrl = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;
      const requestUrl = new URL(requestPath.replace(/^\/+/, ""), baseUrl);
      result = await this.fetchResponse(
        requestUrl,
        { method: "POST", headers, body: encryptedBody },
        15e3,
        signal
      );
    } catch (error) {
      if (signal == null ? void 0 : signal.aborted) {
        throw signal.reason;
      }
      if (error instanceof SaicBodyReadError) {
        throw new Error(`SAIC login response body could not be read: ${error.message}`);
      }
      throw new Error(`SAIC login request failed before a response was received: ${this.errorMessage(error)}`);
    }
    const { response, body: responseText } = result;
    if (!response.ok) {
      throw new Error(`SAIC login failed with HTTP status ${response.status}`);
    }
    const decodedBody = this.decodeResponseBody(response, responseText, "login");
    let envelope;
    try {
      envelope = JSON.parse(decodedBody);
    } catch {
      throw new Error("SAIC login returned an invalid response");
    }
    if (Number(envelope.code) !== 0) {
      throw new Error(envelope.message || "SAIC login was rejected");
    }
    const accessToken = (_a = envelope.data) == null ? void 0 : _a.access_token;
    const expiresIn = (_b = envelope.data) == null ? void 0 : _b.expires_in;
    if (!accessToken || !Number.isFinite(expiresIn) || !expiresIn) {
      throw new Error("SAIC login response did not contain a valid access token");
    }
    return { accessToken, expiresIn };
  }
  /**
   * Retrieve vehicles linked to the authenticated account.
   *
   * @param options Account region and tenant settings.
   * @param accessToken Token returned by {@link login}.
   * @param signal Optional caller cancellation signal.
   */
  async listVehicles(options, accessToken, signal) {
    var _a;
    const timestamp = String(this.now());
    const requestPath = "/vehicle/list";
    const contentType = "application/json";
    const encryptedBody = "";
    const headers = {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "Content-Type": `${contentType};charset=utf-8`,
      "ORIGINAL-CONTENT-TYPE": contentType,
      "APP-SEND-DATE": timestamp,
      "APP-CONTENT-ENCRYPTED": "1",
      "APP-LANGUAGE-TYPE": "en",
      "APP-VERIFICATION-STRING": (0, import_saic_crypto.createSaicRequestSignature)(
        requestPath,
        options.tenantId,
        accessToken,
        timestamp,
        contentType,
        encryptedBody
      ),
      REGION: options.regionCode,
      "tenant-id": options.tenantId,
      "User-Type": "app",
      "User-Agent": "Europe/2.1.0 (iPad; iOS 18.5; Scale/2.00)",
      "blade-auth": accessToken
    };
    let result;
    try {
      const baseUrl = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;
      const requestUrl = new URL(requestPath.replace(/^\/+/, ""), baseUrl);
      result = await this.fetchResponse(requestUrl, { method: "GET", headers }, 15e3, signal);
    } catch (error) {
      if (signal == null ? void 0 : signal.aborted) {
        throw signal.reason;
      }
      if (error instanceof SaicBodyReadError) {
        throw new Error(`SAIC vehicle list response body could not be read: ${error.message}`);
      }
      throw new Error(
        `SAIC vehicle list request failed before a response was received: ${this.errorMessage(error)}`
      );
    }
    const { response, body: responseText } = result;
    if (!response.ok) {
      throw new Error(`SAIC vehicle list failed with HTTP status ${response.status}`);
    }
    const decodedBody = this.decodeResponseBody(response, responseText, "vehicle list");
    let envelope;
    try {
      envelope = JSON.parse(decodedBody);
    } catch {
      throw new Error("SAIC vehicle list returned an invalid response");
    }
    if (Number(envelope.code) !== 0) {
      throw new Error(envelope.message || "SAIC vehicle list request was rejected");
    }
    if (!Array.isArray((_a = envelope.data) == null ? void 0 : _a.vinList)) {
      throw new Error("SAIC vehicle list response did not contain a vehicle list");
    }
    return envelope.data.vinList.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return [];
      }
      const record = item;
      if (typeof record.vin !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(record.vin)) {
        return [];
      }
      const vehicle = { vin: record.vin };
      for (const key of ["name", "brandName", "modelName", "series", "modelYear", "colorName"]) {
        if (typeof record[key] === "string") {
          vehicle[key] = record[key];
        }
      }
      for (const key of ["isCurrentVehicle", "isSubaccount"]) {
        if (typeof record[key] === "boolean") {
          vehicle[key] = record[key];
        }
      }
      return [vehicle];
    });
  }
  /**
   * Retrieve the latest reported status for one vehicle.
   *
   * @param options Account region and tenant settings.
   * @param accessToken Token returned by {@link login}.
   * @param vin Vehicle identification number.
   * @param signal Optional caller cancellation signal.
   */
  async getVehicleStatus(options, accessToken, vin, signal) {
    let lastError;
    for (let attempt = 1; attempt <= 5; attempt++) {
      if (signal == null ? void 0 : signal.aborted) {
        throw signal.reason;
      }
      try {
        this.debug(`Live status request for ${vin}: attempt ${attempt}/5`);
        return await this.requestVehicleStatus(options, accessToken, vin, "/vehicle/status", true, signal);
      } catch (error) {
        if (signal == null ? void 0 : signal.aborted) {
          throw signal.reason;
        }
        if (!(error instanceof RetryableVehicleStatusError)) {
          throw error;
        }
        lastError = error;
        this.debug(
          `Live status request for ${vin} failed on attempt ${attempt}/5: ${this.errorMessage(error)}`
        );
        if (attempt < 5) {
          this.debug(`Retrying live status request for ${vin} in 15 seconds`);
          await this.wait(15e3, signal);
        }
      }
    }
    throw lastError;
  }
  /**
   * Retrieve the last status stored by SAIC without requesting a live vehicle response.
   *
   * @param options Account region and tenant settings.
   * @param accessToken Token returned by {@link login}.
   * @param vin Vehicle identification number.
   * @param signal Optional caller cancellation signal.
   */
  async getCachedVehicleStatus(options, accessToken, vin, signal) {
    this.debug(`Cached status request for ${vin}`);
    return this.requestVehicleStatus(options, accessToken, vin, "/vehicle/status/cache", false, signal);
  }
  /**
   * Retrieve charging-management values reported by SAIC.
   *
   * @param options Account region and tenant settings.
   * @param accessToken Token returned by {@link login}.
   * @param vin Vehicle identification number.
   * @param signal Optional caller cancellation signal.
   */
  async getVehicleChargingStatus(options, accessToken, vin, signal) {
    var _a;
    const requestPath = "/vehicle/charging/mgmtData";
    const query = new URLSearchParams({ vin: (0, import_node_crypto.createHash)("sha256").update(vin, "utf8").digest("hex") });
    const pathAndQuery = `${requestPath}?${query.toString()}`;
    const contentType = "application/json";
    const baseUrl = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;
    const requestUrl = new URL(`${requestPath.slice(1)}?${query.toString()}`, baseUrl);
    const deadline = this.monotonicNow() + 3e4;
    let eventId = "0";
    for (let requestCount = 0; requestCount < 11; requestCount++) {
      if (signal == null ? void 0 : signal.aborted) {
        throw signal.reason;
      }
      if (this.monotonicNow() >= deadline) {
        throw new Error("SAIC charging status timed out while waiting for vehicle data");
      }
      const timestamp = String(this.now());
      const headers = {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "Content-Type": `${contentType};charset=utf-8`,
        "ORIGINAL-CONTENT-TYPE": contentType,
        "APP-CONTENT-ENCRYPTED": "1",
        "APP-LANGUAGE-TYPE": "en",
        "APP-SEND-DATE": timestamp,
        "APP-VERIFICATION-STRING": (0, import_saic_crypto.createSaicRequestSignature)(
          pathAndQuery,
          options.tenantId,
          accessToken,
          timestamp,
          contentType,
          ""
        ),
        REGION: options.regionCode,
        "tenant-id": options.tenantId,
        "User-Type": "app",
        "User-Agent": "Europe/2.1.0 (iPad; iOS 18.5; Scale/2.00)",
        "blade-auth": accessToken,
        "event-id": eventId
      };
      const result = await this.fetchResponse(
        requestUrl,
        { method: "GET", headers },
        Math.max(1, Math.min(5e3, deadline - this.monotonicNow())),
        signal
      );
      if (!result.response.ok) {
        throw new SaicHttpError(
          `SAIC charging status failed with HTTP status ${result.response.status}`,
          result.response.status
        );
      }
      const decodedBody = this.decodeResponseBody(result.response, result.body, "charging status");
      let envelope;
      try {
        envelope = JSON.parse(decodedBody);
      } catch {
        throw new Error("SAIC charging status returned an invalid response");
      }
      const returnCode = Number(envelope.code);
      const nextEventId = result.response.headers.get("event-id");
      this.debug(
        `GET ${requestPath} for ${vin} returned SAIC code ${String(envelope.code)}, data keys: ${Object.keys((_a = envelope.data) != null ? _a : {}).join(", ") || "none"}, next event-id: ${nextEventId != null ? nextEventId : "none"}`
      );
      if (returnCode === 401 || returnCode === 403) {
        throw new SaicHttpError(`SAIC rejected charging status with code ${returnCode}`, returnCode);
      }
      if (![2, 3, 7].includes(returnCode) && (Boolean(nextEventId) && envelope.data === void 0 || returnCode !== 0 && eventId !== "0")) {
        if (this.monotonicNow() >= deadline) {
          throw new Error(
            envelope.message || "SAIC charging status timed out while waiting for vehicle data"
          );
        }
        await this.wait(Math.min(3e3, Math.max(0, deadline - this.monotonicNow())), signal);
        if (nextEventId) {
          eventId = nextEventId;
        }
        continue;
      }
      if (returnCode !== 0) {
        throw new Error(envelope.message || `SAIC charging status failed with code ${returnCode}`);
      }
      const chargingData = envelope.data;
      if (!chargingData || typeof chargingData !== "object" || Array.isArray(chargingData)) {
        throw new Error(
          `SAIC charging status response did not contain data (code: ${String(envelope.code)}, event-id: ${nextEventId != null ? nextEventId : "none"})`
        );
      }
      const parseFields = (value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return {};
        }
        return Object.fromEntries(
          Object.entries(value).map(([field, raw]) => [
            field,
            typeof raw === "number" && Number.isFinite(raw) && raw !== -128 ? raw : typeof raw === "string" && raw.length > 0 ? raw : void 0
          ])
        );
      };
      const chrgMgmtData = parseFields(chargingData.chrgMgmtData);
      const rvsChargeStatus = parseFields(chargingData.rvsChargeStatus);
      if (Object.keys(chrgMgmtData).length === 0 && Object.keys(rvsChargeStatus).length === 0) {
        throw new Error("SAIC charging status response contained no charging fields");
      }
      return { chrgMgmtData, rvsChargeStatus };
    }
    throw new Error("SAIC charging status event polling exceeded its request limit");
  }
  /**
   * Execute a verified SAIC vehicle-control action.
   *
   * @param options Account region and tenant settings.
   * @param accessToken Token returned by {@link login}.
   * @param vin Vehicle identification number.
   * @param command Action to execute.
   * @param signal Optional caller cancellation signal.
   */
  async sendVehicleCommand(options, accessToken, vin, command, signal) {
    const commandRequest = this.vehicleCommandRequest(command, vin);
    await this.sendSignedVehiclePost(options, accessToken, vin, commandRequest, signal);
  }
  /**
   * Set a seat-heating level using SAIC's vehicle-control parameters.
   *
   * @param options Account region and tenant settings.
   * @param accessToken Token returned by {@link login}.
   * @param vin Vehicle identification number.
   * @param seat Seat to control.
   * @param level Heating level from 0 (off) to 3 (high).
   * @param signal Optional caller cancellation signal.
   */
  async sendVehicleSeatHeating(options, accessToken, vin, seat, level, signal) {
    if (!Number.isInteger(level) || level < 0 || level > 3) {
      throw new Error("Seat heating level must be an integer from 0 to 3");
    }
    const param = (paramId, value) => ({
      paramId,
      paramValue: Buffer.from([value]).toString("base64")
    });
    const hashedVin = (0, import_node_crypto.createHash)("sha256").update(vin, "utf8").digest("hex");
    await this.sendSignedVehiclePost(
      options,
      accessToken,
      vin,
      {
        path: "/vehicle/control",
        body: {
          rvcReqType: "5",
          rvcParams: [
            param(17, seat === "driver" ? level : 0),
            param(18, seat === "passenger" ? level : 0),
            { paramId: 255, paramValue: Buffer.from([0, 0, 0, 0]).toString("base64") }
          ],
          vin: hashedVin
        }
      },
      signal
    );
  }
  /**
   * Apply a supported vehicle setting using the documented SAIC request format.
   *
   * @param options Account region and tenant settings.
   * @param accessToken Token returned by {@link login}.
   * @param vin Vehicle identification number.
   * @param setting Setting values to apply.
   * @param signal Optional caller cancellation signal.
   */
  async sendVehicleSetting(options, accessToken, vin, setting, signal) {
    const request = this.vehicleSettingRequest(setting, vin);
    await this.sendSignedVehiclePost(options, accessToken, vin, request, signal);
  }
  async sendSignedVehiclePost(options, accessToken, vin, commandRequest, signal) {
    const body = JSON.stringify(commandRequest.body);
    const requestPath = commandRequest.path;
    const eventPolling = commandRequest.eventPolling !== false;
    const contentType = "application/json";
    const baseUrl = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;
    const requestUrl = new URL(requestPath.replace(/^\/+/, ""), baseUrl);
    const deadline = this.monotonicNow() + 3e4;
    let eventId = "0";
    for (let requestCount = 0; requestCount < (eventPolling ? 11 : 1); requestCount++) {
      if (signal == null ? void 0 : signal.aborted) {
        throw signal.reason;
      }
      if (this.monotonicNow() >= deadline) {
        throw new Error("SAIC vehicle command timed out while waiting for confirmation");
      }
      const timestamp = String(this.now());
      const encryptedBody = (0, import_saic_crypto.encryptSaicRequestBody)(
        requestPath,
        options.tenantId,
        accessToken,
        timestamp,
        contentType,
        body
      );
      const headers = {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "Content-Type": `${contentType};charset=utf-8`,
        "ORIGINAL-CONTENT-TYPE": contentType,
        "APP-CONTENT-ENCRYPTED": "1",
        "APP-LANGUAGE-TYPE": "en",
        "APP-SEND-DATE": timestamp,
        "APP-VERIFICATION-STRING": (0, import_saic_crypto.createSaicRequestSignature)(
          requestPath,
          options.tenantId,
          accessToken,
          timestamp,
          contentType,
          encryptedBody
        ),
        REGION: options.regionCode,
        "tenant-id": options.tenantId,
        "User-Type": "app",
        "User-Agent": "Europe/2.1.0 (iPad; iOS 18.5; Scale/2.00)",
        "blade-auth": accessToken,
        ...eventPolling ? { "event-id": eventId } : {}
      };
      const { response, body: responseText } = await this.fetchResponse(
        requestUrl,
        { method: "POST", headers, body: encryptedBody },
        Math.max(1, Math.min(5e3, deadline - this.monotonicNow())),
        signal
      );
      if (!response.ok) {
        throw new SaicHttpError(
          `SAIC vehicle command failed with HTTP status ${response.status}`,
          response.status
        );
      }
      if (!eventPolling) {
        return;
      }
      const decodedBody = this.decodeResponseBody(response, responseText, "vehicle command");
      let envelope;
      try {
        envelope = JSON.parse(decodedBody);
      } catch {
        throw new Error("SAIC vehicle command returned an invalid response");
      }
      const returnCode = Number(envelope.code);
      const nextEventId = response.headers.get("event-id");
      if (returnCode === 401 || returnCode === 403) {
        throw new SaicHttpError(`SAIC rejected vehicle command with code ${returnCode}`, returnCode);
      }
      if ([2, 3, 7].includes(returnCode)) {
        throw new Error(envelope.message || `SAIC rejected vehicle command with code ${returnCode}`);
      }
      if (nextEventId && envelope.data === void 0) {
        eventId = nextEventId;
      } else if (returnCode !== 0 && eventId !== "0") {
        eventId = nextEventId != null ? nextEventId : eventId;
      } else if (returnCode !== 0) {
        throw new Error(envelope.message || `SAIC rejected vehicle command with code ${returnCode}`);
      } else if (envelope.data !== void 0) {
        return;
      } else if (!nextEventId) {
        throw new Error("SAIC vehicle command response contained neither data nor an event id");
      }
      await this.wait(Math.min(1e3, Math.max(0, deadline - this.monotonicNow())), signal);
    }
    throw new Error("SAIC vehicle command exceeded its event polling limit");
  }
  vehicleSettingRequest(setting, vin) {
    const hashedVin = (0, import_node_crypto.createHash)("sha256").update(vin, "utf8").digest("hex");
    if (setting.type === "climateTemperature") {
      if (!Number.isInteger(setting.value) || setting.value < 0 || setting.value > 255) {
        throw new Error("Climate temperature index must be an integer from 0 to 255");
      }
      return {
        path: "/vehicle/control",
        body: {
          rvcParams: [
            { paramId: 19, paramValue: Buffer.from([2]).toString("base64") },
            { paramId: 20, paramValue: Buffer.from([setting.value]).toString("base64") },
            { paramId: 255, paramValue: Buffer.from([0, 0, 0, 0]).toString("base64") }
          ],
          rvcReqType: "6",
          vin: hashedVin
        }
      };
    }
    if (setting.type === "chargingSettings") {
      if (!Number.isInteger(setting.targetSoc) || setting.targetSoc < 1 || setting.targetSoc > 7) {
        throw new Error("Charge target code must be an integer from 1 to 7");
      }
      if (!Number.isInteger(setting.currentLimit) || setting.currentLimit < 1 || setting.currentLimit > 4) {
        throw new Error("Charge current limit code must be an integer from 1 to 4");
      }
      return {
        path: "/vehicle/charging/setting",
        body: {
          onBdChrgTrgtSOCReq: setting.targetSoc,
          altngChrgCrntReq: setting.currentLimit,
          tboxV2XSpSOCReq: 0,
          vin: hashedVin
        }
      };
    }
    if (setting.type === "chargingSchedule") {
      const start = this.parseTime(setting.start);
      const end = this.parseTime(setting.end);
      if (![1, 2, 3].includes(setting.mode)) {
        throw new Error("Charging schedule mode must be 1, 2, or 3");
      }
      return {
        path: "/vehicle/charging/reservation",
        body: {
          rsvanStHour: start.hour,
          rsvanStMintue: start.minute,
          rsvanSpHour: end.hour,
          rsvanSpMintue: end.minute,
          tboxAdpPubChrgSttnReq: 1,
          tboxReserCtrlReq: setting.mode,
          vin: hashedVin
        }
      };
    }
    const parsedStart = this.parseTime(setting.start);
    const currentTime = this.now();
    const now = new Date(currentTime);
    now.setHours(parsedStart.hour, parsedStart.minute, 0, 0);
    if (now.getTime() < currentTime) {
      now.setDate(now.getDate() + 1);
    }
    return {
      path: "/charging/batteryHeating",
      eventPolling: false,
      body: {
        startTime: setting.enabled ? now.getTime() : 0,
        status: setting.enabled ? 1 : 0,
        vin: hashedVin
      }
    };
  }
  parseTime(value) {
    const match = /^(?:([01]?[0-9]|2[0-3]):([0-5][0-9]))$/.exec(value);
    if (!match) {
      throw new Error(`Invalid time value: ${value}`);
    }
    return { hour: Number(match[1]), minute: Number(match[2]) };
  }
  vehicleCommandRequest(command, vin) {
    const hashedVin = (0, import_node_crypto.createHash)("sha256").update(vin, "utf8").digest("hex");
    if (command === "batteryHeatStart" || command === "batteryHeatStop") {
      return {
        path: "/vehicle/charging/ptcHeat",
        body: { ptcHeatReq: command === "batteryHeatStart" ? 1 : 2, vin: hashedVin }
      };
    }
    if (command === "chargingStart" || command === "chargingStop") {
      return {
        path: "/vehicle/charging/control",
        body: {
          chrgCtrlReq: command === "chargingStart" ? 1 : 2,
          tboxV2XReq: 0,
          tboxEleccLckCtrlReq: 0,
          vin: hashedVin
        }
      };
    }
    if (command === "chargingPortLock" || command === "chargingPortUnlock") {
      return {
        path: "/vehicle/charging/control",
        body: {
          chrgCtrlReq: 0,
          tboxV2XReq: 0,
          tboxEleccLckCtrlReq: command === "chargingPortUnlock" ? 2 : 1,
          vin: hashedVin
        }
      };
    }
    const rvcReqType = command === "lock" ? "1" : command === "unlock" || command === "openBoot" ? "2" : command.startsWith("driverSeatHeat") || command.startsWith("passengerSeatHeat") ? "5" : command === "rearWindowHeatStart" || command === "rearWindowHeatStop" ? "32" : command === "findMyCar" ? "0" : "6";
    return {
      path: "/vehicle/control",
      body: { rvcParams: this.vehicleCommandParams(command), rvcReqType, vin: hashedVin }
    };
  }
  vehicleCommandParams(command) {
    const param = (paramId, value) => ({
      paramId,
      paramValue: Buffer.from(Array.isArray(value) ? value : [value]).toString("base64")
    });
    if (command === "lock") {
      return null;
    }
    if (command === "unlock" || command === "openBoot") {
      return [
        param(4, 0),
        param(5, 0),
        param(6, 0),
        param(7, command === "openBoot" ? 2 : 3),
        param(255, [0, 0, 0, 0])
      ];
    }
    if (command === "climateStart") {
      return [param(19, 2), param(20, 8), param(255, [0, 0, 0, 0])];
    }
    if (command === "climateStop") {
      return [param(19, 0), param(22, 0), param(255, [0, 0, 0, 0])];
    }
    if (command === "frontDefrost") {
      return [param(19, 5), param(20, 8), param(22, 1), param(255, [0, 0, 0, 0])];
    }
    if (command === "rearWindowHeatStart" || command === "rearWindowHeatStop") {
      return [param(23, command === "rearWindowHeatStart" ? 1 : 0), param(255, [0, 0, 0, 0])];
    }
    if (command.startsWith("driverSeatHeat") || command.startsWith("passengerSeatHeat")) {
      const driver = command.startsWith("driver");
      const level = command.endsWith("Low") ? 1 : command.endsWith("Medium") ? 2 : command.endsWith("High") ? 3 : 0;
      return [param(17, driver ? level : 0), param(18, driver ? 0 : level), param(255, [0, 0, 0, 0])];
    }
    if (command === "findMyCar") {
      return [param(1, 1), param(2, 1), param(3, 1), param(255, [0, 0, 0, 0])];
    }
    return [];
  }
  async fetchResponse(url, init, timeoutMs, signal) {
    const controller = new AbortController();
    const clearTimer = this.timerFunctions.setTimeout(
      () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
      timeoutMs
    );
    const abort = () => controller.abort(signal == null ? void 0 : signal.reason);
    if (signal == null ? void 0 : signal.aborted) {
      abort();
    } else if (signal) {
      signal.addEventListener("abort", abort, { once: true });
    }
    try {
      const response = await this.fetchFunction(url, { ...init, signal: controller.signal });
      try {
        return { response, body: await response.text() };
      } catch (error) {
        throw new SaicBodyReadError(this.errorMessage(error));
      }
    } finally {
      clearTimer();
      signal == null ? void 0 : signal.removeEventListener("abort", abort);
    }
  }
  errorMessage(error) {
    return error instanceof Error ? error.message : "Unknown error";
  }
  decodeResponseBody(response, responseText, context) {
    const responseTimestamp = response.headers.get("APP-SEND-DATE");
    const responseContentType = response.headers.get("ORIGINAL-CONTENT-TYPE");
    if (!responseTimestamp || !responseContentType) {
      return responseText;
    }
    try {
      return (0, import_saic_crypto.decryptSaicResponseBody)(responseText, responseTimestamp, responseContentType);
    } catch (error) {
      throw new Error(`SAIC ${context} response could not be decrypted: ${this.errorMessage(error)}`);
    }
  }
  /**
   * Send a status request and normalize its response.
   *
   * @param options Account region and tenant settings.
   * @param accessToken Token returned by {@link login}.
   * @param vin Vehicle identification number.
   * @param requestPath SAIC status endpoint path.
   * @param useEventId Whether this request asks the vehicle for a live response.
   * @param signal Optional caller cancellation signal.
   */
  async requestVehicleStatus(options, accessToken, vin, requestPath, useEventId, signal) {
    var _a, _b;
    const contentType = "application/json";
    const query = new URLSearchParams({
      vin: (0, import_node_crypto.createHash)("sha256").update(vin, "utf8").digest("hex"),
      vehStatusReqType: "2"
    });
    const baseHeaders = {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "Content-Type": `${contentType};charset=utf-8`,
      "ORIGINAL-CONTENT-TYPE": contentType,
      "APP-CONTENT-ENCRYPTED": "1",
      "APP-LANGUAGE-TYPE": "en",
      REGION: options.regionCode,
      "tenant-id": options.tenantId,
      "User-Type": "app",
      "User-Agent": "Europe/2.1.0 (iPad; iOS 18.5; Scale/2.00)",
      "blade-auth": accessToken
    };
    const baseUrl = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;
    const requestUrl = new URL(`${requestPath.replace(/^\/+/, "")}?${query.toString()}`, baseUrl);
    const deadline = this.monotonicNow() + (useEventId ? 3e4 : 15e3);
    let eventId = "0";
    let requestCount = 0;
    let envelope;
    let responseHeaders;
    while (true) {
      if (signal == null ? void 0 : signal.aborted) {
        throw signal.reason;
      }
      if (useEventId && this.monotonicNow() >= deadline) {
        throw new RetryableVehicleStatusError("SAIC vehicle status timed out while waiting for vehicle data");
      }
      if (requestCount >= 11) {
        throw new RetryableVehicleStatusError("SAIC vehicle status event polling exceeded its request limit");
      }
      const timestamp = String(this.now());
      const headers = { ...baseHeaders };
      headers["APP-SEND-DATE"] = timestamp;
      headers["APP-VERIFICATION-STRING"] = (0, import_saic_crypto.createSaicRequestSignature)(
        `${requestPath}?${query.toString()}`,
        options.tenantId,
        accessToken,
        timestamp,
        contentType,
        ""
      );
      if (useEventId) {
        headers["event-id"] = eventId;
      }
      let result;
      let requestStartedAt = this.now();
      try {
        requestCount++;
        const requestTimeoutMs = Math.ceil(
          Math.max(1, Math.min(useEventId ? 5e3 : 15e3, deadline - this.monotonicNow()))
        );
        requestStartedAt = this.now();
        this.debug(
          `GET ${requestPath} for ${vin}, request ${requestCount}, timeout ${requestTimeoutMs}ms, event-id ${useEventId ? eventId : "none"}`
        );
        result = await this.fetchResponse(requestUrl, { method: "GET", headers }, requestTimeoutMs, signal);
        this.debug(
          `GET ${requestPath} for ${vin} received response and body after ${this.now() - requestStartedAt}ms`
        );
      } catch (error) {
        if (signal == null ? void 0 : signal.aborted) {
          throw signal.reason;
        }
        if (error instanceof SaicBodyReadError) {
          throw new RetryableVehicleStatusError(
            `SAIC vehicle status response could not be read: ${error.message}`
          );
        }
        const details = error instanceof Error ? error.message : "Unknown network error";
        this.debug(
          `GET ${requestPath} for ${vin} failed after ${this.now() - requestStartedAt}ms before response: ${details}`
        );
        throw new RetryableVehicleStatusError(
          `SAIC vehicle status request failed before a response was received: ${details}`
        );
      }
      const { response, body: responseText } = result;
      this.debug(
        `GET ${requestPath} for ${vin} returned HTTP ${response.status}, ${responseText.length} response characters`
      );
      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          throw new RetryableVehicleStatusError(
            `SAIC vehicle status failed with HTTP status ${response.status}`
          );
        }
        throw new SaicHttpError(
          `SAIC vehicle status failed with HTTP status ${response.status}`,
          response.status
        );
      }
      const decodedBody = this.decodeResponseBody(response, responseText, "vehicle status");
      try {
        envelope = JSON.parse(decodedBody);
      } catch {
        this.debug(`GET ${requestPath} for ${vin} returned invalid JSON`);
        throw new Error("SAIC vehicle status returned an invalid response");
      }
      responseHeaders = response.headers;
      const nextEventId = response.headers.get("event-id");
      const responseMessage = typeof envelope.message === "string" ? envelope.message.replace(/[\r\n\t]/g, " ").slice(0, 200) : "none";
      this.debug(
        `GET ${requestPath} for ${vin} returned SAIC code ${String(envelope.code)}, message: ${responseMessage}, data keys: ${Object.keys((_a = envelope.data) != null ? _a : {}).join(", ") || "none"}, next event-id: ${nextEventId != null ? nextEventId : "none"}`
      );
      const returnCode = Number(envelope.code);
      if (returnCode === 401 || returnCode === 403) {
        throw new SaicHttpError(`SAIC rejected vehicle status with code ${returnCode}`, returnCode);
      }
      if (useEventId && ![2, 3, 7].includes(returnCode) && (Boolean(nextEventId) && envelope.data === void 0 || returnCode !== 0 && eventId !== "0")) {
        if (this.monotonicNow() >= deadline) {
          throw new RetryableVehicleStatusError(
            envelope.message || "SAIC vehicle status timed out while waiting for vehicle data"
          );
        }
        await this.wait(Math.min(3e3, Math.max(0, deadline - this.monotonicNow())), signal);
        if (nextEventId) {
          eventId = nextEventId;
        }
        continue;
      }
      if (returnCode === 4) {
        throw new SaicRemoteInstructionError(
          envelope.message || "SAIC could not execute the remote vehicle request"
        );
      }
      if (useEventId && returnCode === 0 && envelope.data === void 0 && this.monotonicNow() >= deadline) {
        throw new RetryableVehicleStatusError("SAIC vehicle status timed out while waiting for vehicle data");
      }
      break;
    }
    if (Number(envelope.code) !== 0) {
      throw new Error(envelope.message || "SAIC vehicle status request was rejected");
    }
    if (!((_b = envelope.data) == null ? void 0 : _b.basicVehicleStatus) || typeof envelope.data.basicVehicleStatus !== "object" || Array.isArray(envelope.data.basicVehicleStatus)) {
      const responseKeys = Object.keys(envelope).join(", ") || "none";
      const responseEventId = useEventId ? responseHeaders.get("event-id") : null;
      const dataType = envelope.data === null ? "null" : Array.isArray(envelope.data) ? "array" : typeof envelope.data;
      const dataKeys = envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data) ? Object.keys(envelope.data).join(", ") || "none" : "unavailable";
      this.debug(
        `GET ${requestPath} for ${vin} status shape invalid: code ${String(envelope.code)}, data type ${dataType}, data keys ${dataKeys}`
      );
      throw new Error(
        `SAIC vehicle status response did not contain basic status data (code: ${String(envelope.code)}, response keys: ${responseKeys}, data type: ${dataType}, data keys: ${dataKeys}${responseEventId ? `, event-id: ${responseEventId}` : ""})`
      );
    }
    if (envelope.data.statusTime !== void 0 && envelope.data.statusTime !== null && (typeof envelope.data.statusTime !== "number" || !isVehicleStatusTimestampValid(envelope.data.statusTime, this.now()))) {
      throw new Error("SAIC vehicle status timestamp is outside the trusted freshness window");
    }
    const rawStatus = envelope.data.basicVehicleStatus;
    const basicVehicleStatus = {};
    const acceptedFields = [];
    const ignoredFields = [];
    for (const [field, value] of Object.entries(rawStatus)) {
      if (typeof value === "number" && Number.isFinite(value) && value !== -128) {
        basicVehicleStatus[field] = value;
        acceptedFields.push(field);
      } else {
        basicVehicleStatus[field] = void 0;
        ignoredFields.push(field);
      }
    }
    const gpsPosition = envelope.data.gpsPosition;
    if (gpsPosition && typeof gpsPosition === "object" && !Array.isArray(gpsPosition)) {
      const wayPoint = gpsPosition.wayPoint;
      if (wayPoint && typeof wayPoint === "object" && !Array.isArray(wayPoint)) {
        const wayPointRecord = wayPoint;
        for (const [field, value] of Object.entries(wayPointRecord)) {
          if (field === "position" && value && typeof value === "object" && !Array.isArray(value)) {
            for (const [positionField, positionValue] of Object.entries(value)) {
              const statusField = `gps${positionField[0].toUpperCase()}${positionField.slice(1)}`;
              if (typeof positionValue === "number" && Number.isFinite(positionValue) && positionValue !== -128) {
                basicVehicleStatus[statusField] = positionValue;
                acceptedFields.push(statusField);
              } else {
                basicVehicleStatus[statusField] = void 0;
                ignoredFields.push(`gpsPosition.wayPoint.position.${positionField}`);
              }
            }
            continue;
          }
          if (typeof value === "number" && Number.isFinite(value) && value !== -128) {
            const statusField = field === "speed" ? "speed" : `gps${field[0].toUpperCase()}${field.slice(1)}`;
            basicVehicleStatus[statusField] = value;
            acceptedFields.push(statusField);
          } else {
            const statusField = field === "speed" ? "speed" : `gps${field[0].toUpperCase()}${field.slice(1)}`;
            basicVehicleStatus[statusField] = void 0;
            ignoredFields.push(`gpsPosition.wayPoint.${field}`);
          }
        }
      }
    }
    this.debug(
      `GET ${requestPath} for ${vin} parsed ${acceptedFields.length} status fields [${acceptedFields.join(", ")}]; ignored fields [${ignoredFields.join(", ") || "none"}]`
    );
    if (acceptedFields.length === 0) {
      throw new Error("SAIC vehicle status response contained no usable vehicle fields");
    }
    return {
      basicVehicleStatus,
      ...typeof envelope.data.statusTime === "number" && Number.isFinite(envelope.data.statusTime) ? { statusTime: envelope.data.statusTime } : {},
      ...typeof envelope.data.onlineStatus === "number" && Number.isFinite(envelope.data.onlineStatus) ? { onlineStatus: envelope.data.onlineStatus } : {}
    };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SaicApiClient,
  SaicHttpError,
  SaicRemoteInstructionError,
  climateTemperatureToIndex,
  getClimateTemperatureRange,
  isVehicleStatusNotOlder,
  isVehicleStatusTimestampValid,
  targetSocPercentToCode
});
//# sourceMappingURL=saic-client.js.map
