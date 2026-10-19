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
var saic_crypto_exports = {};
__export(saic_crypto_exports, {
  createSaicRequestSignature: () => createSaicRequestSignature,
  decryptSaicResponseBody: () => decryptSaicResponseBody,
  encryptSaicRequestBody: () => encryptSaicRequestBody,
  sha1PasswordDigest: () => sha1PasswordDigest
});
module.exports = __toCommonJS(saic_crypto_exports);
var import_node_crypto = require("node:crypto");
function md5Hex(value) {
  return (0, import_node_crypto.createHash)("md5").update(value, "utf8").digest("hex");
}
function sha1PasswordDigest(password) {
  return (0, import_node_crypto.createHash)("sha1").update(password, "utf8").digest("hex");
}
function encryptSaicRequestBody(requestPath, tenantId, userToken, timestamp, contentType, requestBody) {
  if (!requestBody) {
    return "";
  }
  const origin = `${requestPath}${tenantId}${userToken}app`;
  const key = md5Hex(`${md5Hex(origin)}${timestamp}1${contentType}`);
  const iv = md5Hex(timestamp);
  const cipher = (0, import_node_crypto.createCipheriv)("aes-128-cbc", Buffer.from(key, "hex"), Buffer.from(iv, "hex"));
  return Buffer.concat([cipher.update(requestBody, "utf8"), cipher.final()]).toString("hex");
}
function createSaicRequestSignature(requestPath, tenantId, userToken, timestamp, contentType, encryptedBody) {
  const origin = `${requestPath}${tenantId}${userToken}app`;
  const key = md5Hex(`${md5Hex(origin)}${timestamp}1${contentType}`);
  const signingKey = md5Hex(`${key}${timestamp}`);
  const signedContent = `${requestPath}${tenantId}${userToken}app${timestamp}1${contentType}${encryptedBody}`;
  return (0, import_node_crypto.createHmac)("sha256", signingKey).update(signedContent, "utf8").digest("hex");
}
function decryptSaicResponseBody(responseBody, timestamp, contentType) {
  if (!responseBody) {
    return "";
  }
  const key = md5Hex(`${timestamp}1${contentType}`);
  const iv = md5Hex(timestamp);
  const decipher = (0, import_node_crypto.createDecipheriv)("aes-128-cbc", Buffer.from(key, "hex"), Buffer.from(iv, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(responseBody.trim(), "hex")), decipher.final()]).toString("utf8");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createSaicRequestSignature,
  decryptSaicResponseBody,
  encryptSaicRequestBody,
  sha1PasswordDigest
});
//# sourceMappingURL=saic-crypto.js.map
