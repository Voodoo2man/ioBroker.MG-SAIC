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
  "sunroofStatus",
  "vehElecRngDsp"
];
class SaicApiClient {
  fetchFunction;
  now;
  /**
   * @param fetchFunction HTTP transport, injectable for tests.
   * @param now Clock function returning milliseconds since epoch.
   */
  constructor(fetchFunction = fetch, now = Date.now) {
    this.fetchFunction = fetchFunction;
    this.now = now;
  }
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
    var _a;
    const timestamp = String(this.now());
    const requestPath = "/vehicle/status";
    const contentType = "application/json";
    const query = new URLSearchParams({
      vin: (0, import_node_crypto.createHash)("sha256").update(vin, "utf8").digest("hex"),
      vehStatusReqType: "2"
    });
    const headers = {
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
      "blade-auth": accessToken,
      "event-id": "0"
    };
    let response;
    try {
      const baseUrl = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;
      const requestUrl = new URL(`${requestPath.replace(/^\/+/, "")}?${query.toString()}`, baseUrl);
      response = await this.fetchFunction(requestUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(15e3)
      });
    } catch (error) {
      const details = error instanceof Error ? error.message : "Unknown network error";
      throw new Error(`SAIC vehicle status request failed before a response was received: ${details}`);
    }
    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`SAIC vehicle status failed with HTTP status ${response.status}`);
    }
    const responseTimestamp = response.headers.get("APP-SEND-DATE");
    const responseContentType = response.headers.get("ORIGINAL-CONTENT-TYPE");
    const decodedBody = responseTimestamp && responseContentType ? (0, import_saic_crypto.decryptSaicResponseBody)(responseText, responseTimestamp, responseContentType) : responseText;
    let envelope;
    try {
      envelope = JSON.parse(decodedBody);
    } catch {
      throw new Error("SAIC vehicle status returned an invalid response");
    }
    if (Number(envelope.code) !== 0) {
      throw new Error(envelope.message || "SAIC vehicle status request was rejected");
    }
    if (!((_a = envelope.data) == null ? void 0 : _a.basicVehicleStatus) || typeof envelope.data.basicVehicleStatus !== "object" || Array.isArray(envelope.data.basicVehicleStatus)) {
      throw new Error("SAIC vehicle status response did not contain basic status data");
    }
    const rawStatus = envelope.data.basicVehicleStatus;
    const basicVehicleStatus = {};
    for (const field of vehicleStatusFields) {
      const value = rawStatus[field];
      if (typeof value === "number" && Number.isFinite(value) && value !== -128) {
        basicVehicleStatus[field] = value;
      }
    }
    return {
      basicVehicleStatus,
      ...typeof envelope.data.statusTime === "number" && Number.isFinite(envelope.data.statusTime) ? { statusTime: envelope.data.statusTime } : {}
    };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SaicApiClient
});
//# sourceMappingURL=saic-client.js.map
