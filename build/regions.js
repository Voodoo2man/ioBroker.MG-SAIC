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
var regions_exports = {};
__export(regions_exports, {
  isIndiaRegion: () => isIndiaRegion,
  resolveSaicRegion: () => resolveSaicRegion
});
module.exports = __toCommonJS(regions_exports);
const regions = {
  EU: {
    baseUrl: "https://gateway-mg-eu.soimt.com/api.app/v1/",
    regionCode: "eu",
    tenantId: "459771"
  },
  China: {
    baseUrl: "https://tap-cn.soimt.com/api.app/v1/",
    regionCode: "cn",
    tenantId: "459771"
  },
  Australia: {
    baseUrl: "https://gateway-mg-au.soimt.com/api.app/v1/",
    regionCode: "au",
    tenantId: "459771"
  },
  Brazil: {
    baseUrl: "https://gateway-mg-br.soimt.com/api.app/v1/",
    regionCode: "br",
    tenantId: "459771"
  },
  Israel: {
    baseUrl: "https://gateway-mg-il.soimt.com/api.app/v1/",
    regionCode: "il",
    tenantId: "459771"
  },
  Turkey: {
    baseUrl: "https://gateway-mg-tr.soimt.com/api.app/v1/",
    regionCode: "tr",
    tenantId: "459771"
  },
  Thailand: {
    baseUrl: "https://gateway-mg-th.soimt.com/api.app/v1/",
    regionCode: "th",
    tenantId: "459771"
  },
  "Rest of World": {
    baseUrl: "https://gateway-mg-eu.soimt.com/api.app/v1/",
    regionCode: "eu",
    tenantId: "459771"
  }
};
function resolveSaicRegion(region) {
  return regions[region.trim()];
}
function isIndiaRegion(region) {
  return region.trim().toLowerCase() === "india";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  isIndiaRegion,
  resolveSaicRegion
});
//# sourceMappingURL=regions.js.map
