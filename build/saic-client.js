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
  SaicApiClient: () => SaicApiClient
});
module.exports = __toCommonJS(saic_client_exports);
var import_node_crypto = require("node:crypto");
var import_saic_crypto = require("./saic-crypto");
class RetryableVehicleStatusError extends Error {
}
const vehicleStatusFields = [
  "batteryVoltage",
  "bonnetStatus",
  "bootStatus",
  "canBusActive",
  "currentJourneyDistance",
  "dippedBeamStatus",
  "driverDoor",
  "driverWindow",
  "engineStatus",
  "exteriorTemperature",
  "frontLeftTyrePressure",
  "frontRightTyrePressure",
  "fuelLevelPrc",
  "fuelRange",
  "fuelRangeElec",
  "handBrake",
  "interiorTemperature",
  "lockStatus",
  "mileage",
  "passengerDoor",
  "passengerWindow",
  "rearLeftDoor",
  "rearLeftTyrePressure",
  "rearLeftWindow",
  "rearRightDoor",
  "rearRightTyrePressure",
  "rearRightWindow",
  "remoteClimateStatus",
  "secondRowLeftSeatHeatLevel",
  "secondRowRightSeatHeatLevel",
  "sideLightStatus",
  "steeringHeatLevel",
  "steeringWheelHeatFailureReason",
  "sunroofStatus",
  "vehElecRngDsp",
  "vehicleAlarmStatus",
  "wheelTyreMonitorStatus"
];
class SaicApiClient {
  fetchFunction;
  now;
  wait;
  /**
   * @param fetchFunction HTTP transport, injectable for tests.
   * @param now Clock function returning milliseconds since epoch.
   * @param wait Delay function used between retry attempts.
   * @param debug Optional debug logger that receives status diagnostics without response values.
   */
  constructor(fetchFunction = fetch, now = Date.now, wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)), debug = () => void 0) {
    this.fetchFunction = fetchFunction;
    this.now = now;
    this.wait = wait;
    this.debug = debug;
  }
  debug;
  /**
   * Sign in and return a validated access token.
   *
   * @param options Account and regional API settings.
   */
  async login(options) {
    var _a, _b;
    const requestTime = this.now();
    const timestamp = String(requestTime);
    const contentType = "application/x-www-form-urlencoded";
    const form = new URLSearchParams({
      grant_type: "password",
      username: options.accountIdentifier,
      password: (0, import_saic_crypto.sha1PasswordDigest)(options.password),
      scope: "all",
      deviceId: `simulator*********************************************${Math.floor(requestTime / 1e3)}`,
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
    let response;
    try {
      const baseUrl = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;
      const requestUrl = new URL(requestPath.replace(/^\/+/, ""), baseUrl);
      response = await this.fetchFunction(requestUrl, {
        method: "POST",
        headers,
        body: encryptedBody,
        signal: AbortSignal.timeout(15e3)
      });
    } catch {
      throw new Error("SAIC login request failed before a response was received");
    }
    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`SAIC login failed with HTTP status ${response.status}`);
    }
    const responseTimestamp = response.headers.get("APP-SEND-DATE");
    const responseContentType = response.headers.get("ORIGINAL-CONTENT-TYPE");
    const decodedBody = responseTimestamp && responseContentType ? (0, import_saic_crypto.decryptSaicResponseBody)(responseText, responseTimestamp, responseContentType) : responseText;
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
   */
  async listVehicles(options, accessToken) {
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
    let response;
    try {
      const baseUrl = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;
      const requestUrl = new URL(requestPath.replace(/^\/+/, ""), baseUrl);
      response = await this.fetchFunction(requestUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(15e3)
      });
    } catch {
      throw new Error("SAIC vehicle list request failed before a response was received");
    }
    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`SAIC vehicle list failed with HTTP status ${response.status}`);
    }
    const responseTimestamp = response.headers.get("APP-SEND-DATE");
    const responseContentType = response.headers.get("ORIGINAL-CONTENT-TYPE");
    const decodedBody = responseTimestamp && responseContentType ? (0, import_saic_crypto.decryptSaicResponseBody)(responseText, responseTimestamp, responseContentType) : responseText;
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
   */
  async getVehicleStatus(options, accessToken, vin) {
    let lastError;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        this.debug(`Live status request for ${vin}: attempt ${attempt}/5`);
        return await this.requestVehicleStatus(options, accessToken, vin, "/vehicle/status", true);
      } catch (error) {
        lastError = error;
        this.debug(
          `Live status request for ${vin} failed on attempt ${attempt}/5: ${this.errorMessage(error)}`
        );
        if (attempt < 5) {
          this.debug(`Retrying live status request for ${vin} in 15 seconds`);
          await this.wait(15e3);
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
   */
  async getCachedVehicleStatus(options, accessToken, vin) {
    this.debug(`Cached status request for ${vin}`);
    return this.requestVehicleStatus(options, accessToken, vin, "/vehicle/status/cache", false);
  }
  errorMessage(error) {
    return error instanceof Error ? error.message : "Unknown error";
  }
  /**
   * Send a status request and normalize its response.
   *
   * @param options Account region and tenant settings.
   * @param accessToken Token returned by {@link login}.
   * @param vin Vehicle identification number.
   * @param requestPath SAIC status endpoint path.
   * @param useEventId Whether this request asks the vehicle for a live response.
   */
  async requestVehicleStatus(options, accessToken, vin, requestPath, useEventId) {
    var _a, _b;
    const timestamp = String(this.now());
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
      "APP-SEND-DATE": timestamp,
      "APP-CONTENT-ENCRYPTED": "1",
      "APP-LANGUAGE-TYPE": "en",
      "APP-VERIFICATION-STRING": (0, import_saic_crypto.createSaicRequestSignature)(
        `${requestPath}?${query.toString()}`,
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
      "blade-auth": accessToken
    };
    const baseUrl = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;
    const requestUrl = new URL(`${requestPath.replace(/^\/+/, "")}?${query.toString()}`, baseUrl);
    const deadline = this.now() + (useEventId ? 3e4 : 15e3);
    let eventId = "0";
    let requestCount = 0;
    let envelope;
    let responseHeaders;
    while (true) {
      const headers = { ...baseHeaders };
      if (useEventId) {
        headers["event-id"] = eventId;
      }
      let response;
      let requestStartedAt = this.now();
      try {
        requestCount++;
        const requestTimeoutMs = useEventId ? 5e3 : Math.max(1, Math.min(15e3, deadline - this.now()));
        requestStartedAt = this.now();
        this.debug(
          `GET ${requestPath} for ${vin}, request ${requestCount}, timeout ${requestTimeoutMs}ms, event-id ${useEventId ? eventId : "none"}`
        );
        response = await this.fetchFunction(requestUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(requestTimeoutMs)
        });
        this.debug(
          `GET ${requestPath} for ${vin} received response headers after ${this.now() - requestStartedAt}ms`
        );
      } catch (error) {
        const details = error instanceof Error ? error.message : "Unknown network error";
        this.debug(
          `GET ${requestPath} for ${vin} failed after ${this.now() - requestStartedAt}ms before response: ${details}`
        );
        throw new RetryableVehicleStatusError(
          `SAIC vehicle status request failed before a response was received: ${details}`
        );
      }
      let responseText;
      try {
        responseText = await response.text();
      } catch (error) {
        const details = error instanceof Error ? error.message : "Unknown network error";
        this.debug(`GET ${requestPath} for ${vin} response body read failed: ${details}`);
        throw new RetryableVehicleStatusError(`SAIC vehicle status response could not be read: ${details}`);
      }
      this.debug(
        `GET ${requestPath} for ${vin} returned HTTP ${response.status}, ${responseText.length} response characters`
      );
      if (!response.ok) {
        const ErrorType = response.status === 429 || response.status >= 500 ? RetryableVehicleStatusError : Error;
        throw new ErrorType(`SAIC vehicle status failed with HTTP status ${response.status}`);
      }
      const responseTimestamp = response.headers.get("APP-SEND-DATE");
      const responseContentType = response.headers.get("ORIGINAL-CONTENT-TYPE");
      const decodedBody = responseTimestamp && responseContentType ? (0, import_saic_crypto.decryptSaicResponseBody)(responseText, responseTimestamp, responseContentType) : responseText;
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
      if (useEventId && ![2, 3, 7].includes(returnCode) && (Boolean(nextEventId) && envelope.data === void 0 || returnCode !== 0 && eventId !== "0")) {
        if (this.now() >= deadline) {
          throw new RetryableVehicleStatusError(
            envelope.message || "SAIC vehicle status timed out while waiting for vehicle data"
          );
        }
        await this.wait(3e3);
        if (nextEventId) {
          eventId = nextEventId;
        }
        continue;
      }
      if (useEventId && returnCode === 0 && envelope.data === void 0 && this.now() >= deadline) {
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
    const rawStatus = envelope.data.basicVehicleStatus;
    const basicVehicleStatus = {};
    const acceptedFields = [];
    const ignoredFields = [];
    for (const field of vehicleStatusFields) {
      const value = rawStatus[field];
      if (typeof value === "number" && Number.isFinite(value) && value !== -128) {
        basicVehicleStatus[field] = value;
        acceptedFields.push(field);
      } else if (value !== void 0) {
        ignoredFields.push(field);
      }
    }
    const unknownFields = Object.keys(rawStatus).filter(
      (field) => !vehicleStatusFields.includes(field)
    );
    const gpsPosition = envelope.data.gpsPosition;
    if (gpsPosition && typeof gpsPosition === "object" && !Array.isArray(gpsPosition)) {
      const wayPoint = gpsPosition.wayPoint;
      if (wayPoint && typeof wayPoint === "object" && !Array.isArray(wayPoint)) {
        const speed = wayPoint.speed;
        if (typeof speed === "number" && Number.isFinite(speed) && speed !== -128) {
          basicVehicleStatus.speed = speed;
          acceptedFields.push("speed");
        }
      }
    }
    this.debug(
      `GET ${requestPath} for ${vin} parsed ${acceptedFields.length} status fields [${acceptedFields.join(", ")}]; ignored fields [${ignoredFields.join(", ") || "none"}]; unknown fields [${unknownFields.join(", ") || "none"}]`
    );
    return {
      basicVehicleStatus,
      ...typeof envelope.data.statusTime === "number" && Number.isFinite(envelope.data.statusTime) ? { statusTime: envelope.data.statusTime } : {},
      ...typeof envelope.data.onlineStatus === "number" && Number.isFinite(envelope.data.onlineStatus) ? { onlineStatus: envelope.data.onlineStatus } : {}
    };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SaicApiClient
});
//# sourceMappingURL=saic-client.js.map
