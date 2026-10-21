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
var status_metadata_exports = {};
__export(status_metadata_exports, {
  getChargingFieldMetadata: () => getChargingFieldMetadata,
  getVehicleStatusGroup: () => getVehicleStatusGroup,
  getVehicleStatusMetadata: () => getVehicleStatusMetadata,
  normalizeChargingValue: () => normalizeChargingValue,
  normalizeVehicleStatusValue: () => normalizeVehicleStatusValue,
  shouldDeleteUnavailableStatusValue: () => shouldDeleteUnavailableStatusValue
});
module.exports = __toCommonJS(status_metadata_exports);
function getVehicleStatusGroup(key) {
  if (["currentJourneyDistance", "engineStatus", "handBrake", "mileage", "speed"].includes(key)) {
    return "driving";
  }
  if (/Door|Window|bonnetStatus|bootStatus|lockStatus/.test(key)) {
    return "access";
  }
  if (/Temperature|Climate|SeatHeat|steeringHeat|steeringWheelHeat/.test(key)) {
    return "climate";
  }
  if (/Tyre|wheelTyre/.test(key)) {
    return "tires";
  }
  if (/Beam|Light/.test(key)) {
    return "lighting";
  }
  if (key === "extendedData1" || /battery|Battery|fuel|Fuel|Range|range|Soc|SOC|Charging|charging|ElecRng|elecRng/i.test(key)) {
    return "energy";
  }
  return "general";
}
const statusNames = {
  extendedData1: {
    en: "Battery state of charge",
    de: "Batterie-Ladezustand",
    ru: "\u0423\u0440\u043E\u0432\u0435\u043D\u044C \u0437\u0430\u0440\u044F\u0434\u0430 \u0431\u0430\u0442\u0430\u0440\u0435\u0438",
    pt: "N\xEDvel de carga da bateria",
    nl: "Batterijlading",
    fr: "Niveau de charge de la batterie",
    it: "Livello di carica della batteria",
    es: "Nivel de carga de la bater\xEDa",
    pl: "Poziom na\u0142adowania baterii",
    uk: "\u0420\u0456\u0432\u0435\u043D\u044C \u0437\u0430\u0440\u044F\u0434\u0443 \u0431\u0430\u0442\u0430\u0440\u0435\u0457",
    "zh-cn": "\u7535\u6C60\u7535\u91CF"
  },
  gpsLatitude: {
    en: "GPS latitude",
    de: "GPS-Breitengrad",
    ru: "\u0428\u0438\u0440\u043E\u0442\u0430 GPS",
    pt: "Latitude GPS",
    nl: "GPS-breedtegraad",
    fr: "Latitude GPS",
    it: "Latitudine GPS",
    es: "Latitud GPS",
    pl: "Szeroko\u015B\u0107 geograficzna GPS",
    uk: "\u0428\u0438\u0440\u043E\u0442\u0430 GPS",
    "zh-cn": "GPS \u7EAC\u5EA6"
  },
  gpsLongitude: {
    en: "GPS longitude",
    de: "GPS-L\xE4ngengrad",
    ru: "\u0414\u043E\u043B\u0433\u043E\u0442\u0430 GPS",
    pt: "Longitude GPS",
    nl: "GPS-lengtegraad",
    fr: "Longitude GPS",
    it: "Longitudine GPS",
    es: "Longitud GPS",
    pl: "D\u0142ugo\u015B\u0107 geograficzna GPS",
    uk: "\u0414\u043E\u0432\u0433\u043E\u0442\u0430 GPS",
    "zh-cn": "GPS \u7ECF\u5EA6"
  },
  batteryVoltage: {
    en: "Auxiliary battery voltage",
    de: "Spannung der 12-V-Batterie",
    ru: "\u041D\u0430\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u0435 \u0432\u0441\u043F\u043E\u043C\u043E\u0433\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0439 \u0431\u0430\u0442\u0430\u0440\u0435\u0438",
    pt: "Tens\xE3o da bateria auxiliar",
    nl: "Spanning van de hulpaccu",
    fr: "Tension de la batterie auxiliaire",
    it: "Tensione della batteria ausiliaria",
    es: "Voltaje de la bater\xEDa auxiliar",
    pl: "Napi\u0119cie akumulatora pomocniczego",
    uk: "\u041D\u0430\u043F\u0440\u0443\u0433\u0430 \u0434\u043E\u043F\u043E\u043C\u0456\u0436\u043D\u043E\u0457 \u0431\u0430\u0442\u0430\u0440\u0435\u0457",
    "zh-cn": "\u8F85\u52A9\u7535\u6C60\u7535\u538B"
  },
  bonnetStatus: {
    en: "Bonnet",
    de: "Motorhaube",
    ru: "\u041A\u0430\u043F\u043E\u0442",
    pt: "Cap\xF4",
    nl: "Motorkap",
    fr: "Capot",
    it: "Cofano",
    es: "Cap\xF3",
    pl: "Maska",
    uk: "\u041A\u0430\u043F\u043E\u0442",
    "zh-cn": "\u5F15\u64CE\u76D6"
  },
  bootStatus: {
    en: "Boot",
    de: "Kofferraum",
    ru: "\u0411\u0430\u0433\u0430\u0436\u043D\u0438\u043A",
    pt: "Porta-malas",
    nl: "Kofferbak",
    fr: "Coffre",
    it: "Bagagliaio",
    es: "Maletero",
    pl: "Baga\u017Cnik",
    uk: "\u0411\u0430\u0433\u0430\u0436\u043D\u0438\u043A",
    "zh-cn": "\u540E\u5907\u7BB1"
  },
  canBusActive: {
    en: "CAN bus active",
    de: "CAN-Bus aktiv",
    ru: "\u0428\u0438\u043D\u0430 CAN \u0430\u043A\u0442\u0438\u0432\u043D\u0430",
    pt: "Barramento CAN ativo",
    nl: "CAN-bus actief",
    fr: "Bus CAN actif",
    it: "Bus CAN attivo",
    es: "Bus CAN activo",
    pl: "Magistrala CAN aktywna",
    uk: "\u0428\u0438\u043D\u0430 CAN \u0430\u043A\u0442\u0438\u0432\u043D\u0430",
    "zh-cn": "CAN \u603B\u7EBF\u5DF2\u6FC0\u6D3B"
  },
  Charging_Port_Lock_Set_Off: {
    en: "Charging port lock set off",
    de: "Ladeanschluss entriegelt",
    ru: "\u0411\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043A\u0430 \u0437\u0430\u0440\u044F\u0434\u043D\u043E\u0433\u043E \u043F\u043E\u0440\u0442\u0430 \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0430",
    pt: "Bloqueio da porta de carregamento desativado",
    nl: "Laadpoortvergrendeling uitgeschakeld",
    fr: "Verrouillage du port de recharge d\xE9sactiv\xE9",
    it: "Blocco della presa di ricarica disattivato",
    es: "Bloqueo del puerto de carga desactivado",
    pl: "Blokada portu \u0142adowania wy\u0142\u0105czona",
    uk: "\u0411\u043B\u043E\u043A\u0443\u0432\u0430\u043D\u043D\u044F \u0437\u0430\u0440\u044F\u0434\u043D\u043E\u0433\u043E \u043F\u043E\u0440\u0442\u0443 \u0432\u0438\u043C\u043A\u043D\u0435\u043D\u043E",
    "zh-cn": "\u5145\u7535\u53E3\u9501\u5DF2\u5173\u95ED"
  },
  currentJourneyDistance: {
    en: "Current journey distance",
    de: "Strecke der aktuellen Fahrt",
    ru: "\u0420\u0430\u0441\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043F\u043E\u0435\u0437\u0434\u043A\u0438",
    pt: "Dist\xE2ncia da viagem atual",
    nl: "Afstand van huidige rit",
    fr: "Distance du trajet actuel",
    it: "Distanza del viaggio attuale",
    es: "Distancia del viaje actual",
    pl: "Dystans bie\u017C\u0105cej podr\xF3\u017Cy",
    uk: "\u0412\u0456\u0434\u0441\u0442\u0430\u043D\u044C \u043F\u043E\u0442\u043E\u0447\u043D\u043E\u0457 \u043F\u043E\u0457\u0437\u0434\u043A\u0438",
    "zh-cn": "\u5F53\u524D\u884C\u9A76\u91CC\u7A0B"
  },
  dippedBeamStatus: {
    en: "Dipped beam",
    de: "Abblendlicht",
    ru: "\u0411\u043B\u0438\u0436\u043D\u0438\u0439 \u0441\u0432\u0435\u0442",
    pt: "Farol baixo",
    nl: "Dimlicht",
    fr: "Feux de croisement",
    it: "Anabbaglianti",
    es: "Luces de cruce",
    pl: "\u015Awiat\u0142a mijania",
    uk: "\u0411\u043B\u0438\u0436\u043D\u0454 \u0441\u0432\u0456\u0442\u043B\u043E",
    "zh-cn": "\u8FD1\u5149\u706F"
  },
  driverDoor: {
    en: "Door driver",
    de: "Fahrert\xFCr",
    ru: "\u0414\u0432\u0435\u0440\u044C \u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F",
    pt: "Porta do motorista",
    nl: "Bestuurdersdeur",
    fr: "Porte conducteur",
    it: "Porta del conducente",
    es: "Puerta del conductor",
    pl: "Drzwi kierowcy",
    uk: "\u0414\u0432\u0435\u0440\u0456 \u0432\u043E\u0434\u0456\u044F",
    "zh-cn": "\u9A7E\u9A76\u5458\u8F66\u95E8"
  },
  driverWindow: {
    en: "Window driver",
    de: "Fahrerfenster",
    ru: "\u041E\u043A\u043D\u043E \u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F",
    pt: "Janela do motorista",
    nl: "Bestuurdersraam",
    fr: "Vitre conducteur",
    it: "Finestrino del conducente",
    es: "Ventana del conductor",
    pl: "Szyba kierowcy",
    uk: "\u0412\u0456\u043A\u043D\u043E \u0432\u043E\u0434\u0456\u044F",
    "zh-cn": "\u9A7E\u9A76\u5458\u8F66\u7A97"
  },
  engineStatus: {
    en: "Engine running",
    de: "Motor l\xE4uft",
    ru: "\u0414\u0432\u0438\u0433\u0430\u0442\u0435\u043B\u044C \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442",
    pt: "Motor ligado",
    nl: "Motor draait",
    fr: "Moteur en marche",
    it: "Motore acceso",
    es: "Motor en marcha",
    pl: "Silnik pracuje",
    uk: "\u0414\u0432\u0438\u0433\u0443\u043D \u043F\u0440\u0430\u0446\u044E\u0454",
    "zh-cn": "\u53D1\u52A8\u673A\u8FD0\u884C\u4E2D"
  },
  exteriorTemperature: {
    en: "Exterior temperature",
    de: "Au\xDFentemperatur",
    ru: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0441\u043D\u0430\u0440\u0443\u0436\u0438",
    pt: "Temperatura externa",
    nl: "Buitentemperatuur",
    fr: "Temp\xE9rature ext\xE9rieure",
    it: "Temperatura esterna",
    es: "Temperatura exterior",
    pl: "Temperatura zewn\u0119trzna",
    uk: "\u0417\u043E\u0432\u043D\u0456\u0448\u043D\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430",
    "zh-cn": "\u8F66\u5916\u6E29\u5EA6"
  },
  frontLeftTyrePressure: {
    en: "Tyre pressure front left",
    de: "Reifendruck vorne links",
    ru: "\u0414\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0432 \u0448\u0438\u043D\u0435 \u0441\u043F\u0435\u0440\u0435\u0434\u0438 \u0441\u043B\u0435\u0432\u0430",
    pt: "Press\xE3o do pneu dianteiro esquerdo",
    nl: "Bandenspanning linksvoor",
    fr: "Pression du pneu avant gauche",
    it: "Pressione pneumatico anteriore sinistro",
    es: "Presi\xF3n del neum\xE1tico delantero izquierdo",
    pl: "Ci\u015Bnienie w lewej przedniej oponie",
    uk: "\u0422\u0438\u0441\u043A \u0443 \u0448\u0438\u043D\u0456 \u0441\u043F\u0435\u0440\u0435\u0434\u0443 \u043B\u0456\u0432\u043E\u0440\u0443\u0447",
    "zh-cn": "\u5DE6\u524D\u8F6E\u80CE\u538B"
  },
  frontRightTyrePressure: {
    en: "Tyre pressure front right",
    de: "Reifendruck vorne rechts",
    ru: "\u0414\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0432 \u0448\u0438\u043D\u0435 \u0441\u043F\u0435\u0440\u0435\u0434\u0438 \u0441\u043F\u0440\u0430\u0432\u0430",
    pt: "Press\xE3o do pneu dianteiro direito",
    nl: "Bandenspanning rechtsvoor",
    fr: "Pression du pneu avant droit",
    it: "Pressione pneumatico anteriore destro",
    es: "Presi\xF3n del neum\xE1tico delantero derecho",
    pl: "Ci\u015Bnienie w prawej przedniej oponie",
    uk: "\u0422\u0438\u0441\u043A \u0443 \u0448\u0438\u043D\u0456 \u0441\u043F\u0435\u0440\u0435\u0434\u0443 \u043F\u0440\u0430\u0432\u043E\u0440\u0443\u0447",
    "zh-cn": "\u53F3\u524D\u8F6E\u80CE\u538B"
  },
  fuelLevelPrc: {
    en: "Fossil fuel level",
    de: "Kraftstoffstand",
    ru: "\u0423\u0440\u043E\u0432\u0435\u043D\u044C \u0442\u043E\u043F\u043B\u0438\u0432\u0430",
    pt: "N\xEDvel de combust\xEDvel",
    nl: "Brandstofniveau",
    fr: "Niveau de carburant",
    it: "Livello carburante",
    es: "Nivel de combustible",
    pl: "Poziom paliwa",
    uk: "\u0420\u0456\u0432\u0435\u043D\u044C \u043F\u0430\u043B\u044C\u043D\u043E\u0433\u043E",
    "zh-cn": "\u71C3\u6CB9\u6DB2\u4F4D"
  },
  fuelRange: {
    en: "Fossil fuel range",
    de: "Kraftstoffreichweite",
    ru: "\u0417\u0430\u043F\u0430\u0441 \u0445\u043E\u0434\u0430 \u043D\u0430 \u0442\u043E\u043F\u043B\u0438\u0432\u0435",
    pt: "Autonomia com combust\xEDvel",
    nl: "Actieradius op brandstof",
    fr: "Autonomie au carburant",
    it: "Autonomia a carburante",
    es: "Autonom\xEDa con combustible",
    pl: "Zasi\u0119g na paliwie",
    uk: "\u0417\u0430\u043F\u0430\u0441 \u0445\u043E\u0434\u0443 \u043D\u0430 \u043F\u0430\u043B\u044C\u043D\u043E\u043C\u0443",
    "zh-cn": "\u71C3\u6CB9\u7EED\u822A\u91CC\u7A0B"
  },
  fuelRangeElec: {
    en: "Electric range",
    de: "Elektrische Reichweite",
    ru: "\u0417\u0430\u043F\u0430\u0441 \u0445\u043E\u0434\u0430 \u043D\u0430 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u0442\u044F\u0433\u0435",
    pt: "Autonomia el\xE9trica",
    nl: "Elektrische actieradius",
    fr: "Autonomie \xE9lectrique",
    it: "Autonomia elettrica",
    es: "Autonom\xEDa el\xE9ctrica",
    pl: "Zasi\u0119g elektryczny",
    uk: "\u0417\u0430\u043F\u0430\u0441 \u0445\u043E\u0434\u0443 \u043D\u0430 \u0435\u043B\u0435\u043A\u0442\u0440\u043E\u0442\u044F\u0437\u0456",
    "zh-cn": "\u7EAF\u7535\u7EED\u822A\u91CC\u7A0B"
  },
  handBrake: {
    en: "Handbrake",
    de: "Handbremse",
    ru: "\u0421\u0442\u043E\u044F\u043D\u043E\u0447\u043D\u044B\u0439 \u0442\u043E\u0440\u043C\u043E\u0437",
    pt: "Freio de m\xE3o",
    nl: "Handrem",
    fr: "Frein \xE0 main",
    it: "Freno a mano",
    es: "Freno de mano",
    pl: "Hamulec r\u0119czny",
    uk: "\u0421\u0442\u043E\u044F\u043D\u043A\u043E\u0432\u0435 \u0433\u0430\u043B\u044C\u043C\u043E",
    "zh-cn": "\u624B\u5239"
  },
  interiorTemperature: {
    en: "Interior temperature",
    de: "Innenraumtemperatur",
    ru: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0432 \u0441\u0430\u043B\u043E\u043D\u0435",
    pt: "Temperatura interna",
    nl: "Binnentemperatuur",
    fr: "Temp\xE9rature int\xE9rieure",
    it: "Temperatura interna",
    es: "Temperatura interior",
    pl: "Temperatura wewn\u0105trz",
    uk: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0432 \u0441\u0430\u043B\u043E\u043D\u0456",
    "zh-cn": "\u8F66\u5185\u6E29\u5EA6"
  },
  lockStatus: {
    en: "Doors locked",
    de: "T\xFCren verriegelt",
    ru: "\u0414\u0432\u0435\u0440\u0438 \u0437\u0430\u043F\u0435\u0440\u0442\u044B",
    pt: "Portas trancadas",
    nl: "Deuren vergrendeld",
    fr: "Portes verrouill\xE9es",
    it: "Porte bloccate",
    es: "Puertas bloqueadas",
    pl: "Drzwi zablokowane",
    uk: "\u0414\u0432\u0435\u0440\u0456 \u0437\u0430\u043C\u043A\u043D\u0435\u043D\u0456",
    "zh-cn": "\u8F66\u95E8\u5DF2\u9501"
  },
  mileage: {
    en: "Mileage",
    de: "Kilometerstand",
    ru: "\u041F\u0440\u043E\u0431\u0435\u0433",
    pt: "Quilometragem",
    nl: "Kilometerstand",
    fr: "Kilom\xE9trage",
    it: "Chilometraggio",
    es: "Kilometraje",
    pl: "Przebieg",
    uk: "\u041F\u0440\u043E\u0431\u0456\u0433",
    "zh-cn": "\u91CC\u7A0B"
  },
  onlineStatus: {
    en: "Online status",
    de: "Online-Status",
    ru: "\u0421\u0435\u0442\u0435\u0432\u043E\u0439 \u0441\u0442\u0430\u0442\u0443\u0441",
    pt: "Status online",
    nl: "Onlinestatus",
    fr: "Statut en ligne",
    it: "Stato online",
    es: "Estado en l\xEDnea",
    pl: "Status online",
    uk: "\u041C\u0435\u0440\u0435\u0436\u0435\u0432\u0438\u0439 \u0441\u0442\u0430\u0442\u0443\u0441",
    "zh-cn": "\u5728\u7EBF\u72B6\u6001"
  },
  passengerDoor: {
    en: "Door passenger",
    de: "Beifahrert\xFCr",
    ru: "\u0414\u0432\u0435\u0440\u044C \u043F\u0430\u0441\u0441\u0430\u0436\u0438\u0440\u0430",
    pt: "Porta do passageiro",
    nl: "Passagiersdeur",
    fr: "Porte passager",
    it: "Porta del passeggero",
    es: "Puerta del pasajero",
    pl: "Drzwi pasa\u017Cera",
    uk: "\u0414\u0432\u0435\u0440\u0456 \u043F\u0430\u0441\u0430\u0436\u0438\u0440\u0430",
    "zh-cn": "\u4E58\u5BA2\u8F66\u95E8"
  },
  passengerWindow: {
    en: "Window passenger",
    de: "Beifahrerfenster",
    ru: "\u041E\u043A\u043D\u043E \u043F\u0430\u0441\u0441\u0430\u0436\u0438\u0440\u0430",
    pt: "Janela do passageiro",
    nl: "Passagiersraam",
    fr: "Vitre passager",
    it: "Finestrino del passeggero",
    es: "Ventana del pasajero",
    pl: "Szyba pasa\u017Cera",
    uk: "\u0412\u0456\u043A\u043D\u043E \u043F\u0430\u0441\u0430\u0436\u0438\u0440\u0430",
    "zh-cn": "\u4E58\u5BA2\u8F66\u7A97"
  },
  rearLeftDoor: {
    en: "Door rear left",
    de: "Hintere T\xFCr links",
    ru: "\u0417\u0430\u0434\u043D\u044F\u044F \u043B\u0435\u0432\u0430\u044F \u0434\u0432\u0435\u0440\u044C",
    pt: "Porta traseira esquerda",
    nl: "Linker achterportier",
    fr: "Porte arri\xE8re gauche",
    it: "Porta posteriore sinistra",
    es: "Puerta trasera izquierda",
    pl: "Lewe tylne drzwi",
    uk: "\u0417\u0430\u0434\u043D\u0456 \u043B\u0456\u0432\u0456 \u0434\u0432\u0435\u0440\u0456",
    "zh-cn": "\u5DE6\u540E\u8F66\u95E8"
  },
  rearLeftTyrePressure: {
    en: "Tyre pressure rear left",
    de: "Reifendruck hinten links",
    ru: "\u0414\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0432 \u0448\u0438\u043D\u0435 \u0441\u0437\u0430\u0434\u0438 \u0441\u043B\u0435\u0432\u0430",
    pt: "Press\xE3o do pneu traseiro esquerdo",
    nl: "Bandenspanning linksachter",
    fr: "Pression du pneu arri\xE8re gauche",
    it: "Pressione pneumatico posteriore sinistro",
    es: "Presi\xF3n del neum\xE1tico trasero izquierdo",
    pl: "Ci\u015Bnienie w lewej tylnej oponie",
    uk: "\u0422\u0438\u0441\u043A \u0443 \u0448\u0438\u043D\u0456 \u0437\u0437\u0430\u0434\u0443 \u043B\u0456\u0432\u043E\u0440\u0443\u0447",
    "zh-cn": "\u5DE6\u540E\u8F6E\u80CE\u538B"
  },
  rearLeftWindow: {
    en: "Window rear left",
    de: "Hinteres Fenster links",
    ru: "\u0417\u0430\u0434\u043D\u0435\u0435 \u043B\u0435\u0432\u043E\u0435 \u043E\u043A\u043D\u043E",
    pt: "Janela traseira esquerda",
    nl: "Linker achterraam",
    fr: "Vitre arri\xE8re gauche",
    it: "Finestrino posteriore sinistro",
    es: "Ventana trasera izquierda",
    pl: "Lewa tylna szyba",
    uk: "\u0417\u0430\u0434\u043D\u0454 \u043B\u0456\u0432\u0435 \u0432\u0456\u043A\u043D\u043E",
    "zh-cn": "\u5DE6\u540E\u8F66\u7A97"
  },
  rearRightDoor: {
    en: "Door rear right",
    de: "Hintere T\xFCr rechts",
    ru: "\u0417\u0430\u0434\u043D\u044F\u044F \u043F\u0440\u0430\u0432\u0430\u044F \u0434\u0432\u0435\u0440\u044C",
    pt: "Porta traseira direita",
    nl: "Rechter achterportier",
    fr: "Porte arri\xE8re droite",
    it: "Porta posteriore destra",
    es: "Puerta trasera derecha",
    pl: "Prawe tylne drzwi",
    uk: "\u0417\u0430\u0434\u043D\u0456 \u043F\u0440\u0430\u0432\u0456 \u0434\u0432\u0435\u0440\u0456",
    "zh-cn": "\u53F3\u540E\u8F66\u95E8"
  },
  rearRightTyrePressure: {
    en: "Tyre pressure rear right",
    de: "Reifendruck hinten rechts",
    ru: "\u0414\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0432 \u0448\u0438\u043D\u0435 \u0441\u0437\u0430\u0434\u0438 \u0441\u043F\u0440\u0430\u0432\u0430",
    pt: "Press\xE3o do pneu traseiro direito",
    nl: "Bandenspanning rechtsachter",
    fr: "Pression du pneu arri\xE8re droit",
    it: "Pressione pneumatico posteriore destro",
    es: "Presi\xF3n del neum\xE1tico trasero derecho",
    pl: "Ci\u015Bnienie w prawej tylnej oponie",
    uk: "\u0422\u0438\u0441\u043A \u0443 \u0448\u0438\u043D\u0456 \u0437\u0437\u0430\u0434\u0443 \u043F\u0440\u0430\u0432\u043E\u0440\u0443\u0447",
    "zh-cn": "\u53F3\u540E\u8F6E\u80CE\u538B"
  },
  rearRightWindow: {
    en: "Window rear right",
    de: "Hinteres Fenster rechts",
    ru: "\u0417\u0430\u0434\u043D\u0435\u0435 \u043F\u0440\u0430\u0432\u043E\u0435 \u043E\u043A\u043D\u043E",
    pt: "Janela traseira direita",
    nl: "Rechter achterraam",
    fr: "Vitre arri\xE8re droite",
    it: "Finestrino posteriore destro",
    es: "Ventana trasera derecha",
    pl: "Prawa tylna szyba",
    uk: "\u0417\u0430\u0434\u043D\u0454 \u043F\u0440\u0430\u0432\u0435 \u0432\u0456\u043A\u043D\u043E",
    "zh-cn": "\u53F3\u540E\u8F66\u7A97"
  },
  remoteClimateStatus: {
    en: "Remote climate state",
    de: "Klimatisierung per Fernsteuerung",
    ru: "\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0434\u0438\u0441\u0442\u0430\u043D\u0446\u0438\u043E\u043D\u043D\u043E\u0433\u043E \u043A\u043B\u0438\u043C\u0430\u0442-\u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044F",
    pt: "Estado do climatizador remoto",
    nl: "Status klimaatregeling op afstand",
    fr: "\xC9tat de la climatisation \xE0 distance",
    it: "Stato climatizzazione remota",
    es: "Estado de la climatizaci\xF3n remota",
    pl: "Stan zdalnej klimatyzacji",
    uk: "\u0421\u0442\u0430\u043D \u0434\u0438\u0441\u0442\u0430\u043D\u0446\u0456\u0439\u043D\u043E\u0433\u043E \u043A\u043B\u0456\u043C\u0430\u0442-\u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044E",
    "zh-cn": "\u8FDC\u7A0B\u7A7A\u8C03\u72B6\u6001"
  },
  secondRowLeftSeatHeatLevel: {
    en: "Heated seat rear left",
    de: "Sitzheizung hinten links",
    ru: "\u041E\u0431\u043E\u0433\u0440\u0435\u0432 \u0437\u0430\u0434\u043D\u0435\u0433\u043E \u043B\u0435\u0432\u043E\u0433\u043E \u0441\u0438\u0434\u0435\u043D\u044C\u044F",
    pt: "Aquecimento do banco traseiro esquerdo",
    nl: "Stoelverwarming linksachter",
    fr: "Si\xE8ge arri\xE8re gauche chauffant",
    it: "Riscaldamento sedile posteriore sinistro",
    es: "Calefacci\xF3n del asiento trasero izquierdo",
    pl: "Ogrzewanie lewego tylnego siedzenia",
    uk: "\u041E\u0431\u0456\u0433\u0440\u0456\u0432 \u0437\u0430\u0434\u043D\u044C\u043E\u0433\u043E \u043B\u0456\u0432\u043E\u0433\u043E \u0441\u0438\u0434\u0456\u043D\u043D\u044F",
    "zh-cn": "\u5DE6\u540E\u5EA7\u6905\u52A0\u70ED"
  },
  secondRowRightSeatHeatLevel: {
    en: "Heated seat rear right",
    de: "Sitzheizung hinten rechts",
    ru: "\u041E\u0431\u043E\u0433\u0440\u0435\u0432 \u0437\u0430\u0434\u043D\u0435\u0433\u043E \u043F\u0440\u0430\u0432\u043E\u0433\u043E \u0441\u0438\u0434\u0435\u043D\u044C\u044F",
    pt: "Aquecimento do banco traseiro direito",
    nl: "Stoelverwarming rechtsachter",
    fr: "Si\xE8ge arri\xE8re droit chauffant",
    it: "Riscaldamento sedile posteriore destro",
    es: "Calefacci\xF3n del asiento trasero derecho",
    pl: "Ogrzewanie prawego tylnego siedzenia",
    uk: "\u041E\u0431\u0456\u0433\u0440\u0456\u0432 \u0437\u0430\u0434\u043D\u044C\u043E\u0433\u043E \u043F\u0440\u0430\u0432\u043E\u0433\u043E \u0441\u0438\u0434\u0456\u043D\u043D\u044F",
    "zh-cn": "\u53F3\u540E\u5EA7\u6905\u52A0\u70ED"
  },
  sideLightStatus: {
    en: "Side light",
    de: "Standlicht",
    ru: "\u0413\u0430\u0431\u0430\u0440\u0438\u0442\u043D\u044B\u0435 \u043E\u0433\u043D\u0438",
    pt: "Luz de posi\xE7\xE3o",
    nl: "Stadslicht",
    fr: "Feux de position",
    it: "Luci di posizione",
    es: "Luz de posici\xF3n",
    pl: "\u015Awiat\u0142a pozycyjne",
    uk: "\u0413\u0430\u0431\u0430\u0440\u0438\u0442\u043D\u0456 \u0432\u043E\u0433\u043D\u0456",
    "zh-cn": "\u793A\u5BBD\u706F"
  },
  steeringHeatLevel: {
    en: "Steering wheel heating",
    de: "Lenkradheizung",
    ru: "\u041E\u0431\u043E\u0433\u0440\u0435\u0432 \u0440\u0443\u043B\u0435\u0432\u043E\u0433\u043E \u043A\u043E\u043B\u0435\u0441\u0430",
    pt: "Aquecimento do volante",
    nl: "Stuurwielverwarming",
    fr: "Chauffage du volant",
    it: "Riscaldamento del volante",
    es: "Calefacci\xF3n del volante",
    pl: "Podgrzewanie kierownicy",
    uk: "\u041E\u0431\u0456\u0433\u0440\u0456\u0432 \u043A\u0435\u0440\u043C\u0430",
    "zh-cn": "\u65B9\u5411\u76D8\u52A0\u70ED"
  },
  speed: {
    en: "Speed",
    de: "Geschwindigkeit",
    ru: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C",
    pt: "Velocidade",
    nl: "Snelheid",
    fr: "Vitesse",
    it: "Velocit\xE0",
    es: "Velocidad",
    pl: "Pr\u0119dko\u015B\u0107",
    uk: "\u0428\u0432\u0438\u0434\u043A\u0456\u0441\u0442\u044C",
    "zh-cn": "\u8F66\u901F"
  },
  vehicleAlarmStatus: {
    en: "Vehicle alarm status",
    de: "Fahrzeugalarmstatus",
    ru: "\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0441\u0438\u0433\u043D\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u0438 \u0430\u0432\u0442\u043E\u043C\u043E\u0431\u0438\u043B\u044F",
    pt: "Estado do alarme do ve\xEDculo",
    nl: "Voertuigalarmstatus",
    fr: "\xC9tat de l'alarme du v\xE9hicule",
    it: "Stato dell'allarme del veicolo",
    es: "Estado de la alarma del veh\xEDculo",
    pl: "Stan alarmu pojazdu",
    uk: "\u0421\u0442\u0430\u043D \u0441\u0438\u0433\u043D\u0430\u043B\u0456\u0437\u0430\u0446\u0456\u0457 \u0430\u0432\u0442\u043E\u043C\u043E\u0431\u0456\u043B\u044F",
    "zh-cn": "\u8F66\u8F86\u8B66\u62A5\u72B6\u6001"
  },
  wheelTyreMonitorStatus: {
    en: "Wheel tyre monitor status",
    de: "Reifendruckkontrollsystem",
    ru: "\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044F \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0432 \u0448\u0438\u043D\u0430\u0445",
    pt: "Estado do monitor de pneus",
    nl: "Bandenspanningscontrolesysteem",
    fr: "\xC9tat du contr\xF4le de pression des pneus",
    it: "Stato del monitoraggio pneumatici",
    es: "Estado del monitor de neum\xE1ticos",
    pl: "Stan monitorowania ci\u015Bnienia w oponach",
    uk: "\u0421\u0442\u0430\u043D \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044E \u0442\u0438\u0441\u043A\u0443 \u0432 \u0448\u0438\u043D\u0430\u0445",
    "zh-cn": "\u8F6E\u80CE\u76D1\u6D4B\u72B6\u6001"
  },
  statusTime: {
    en: "Status time",
    de: "Zeitstempel des Status",
    ru: "\u0412\u0440\u0435\u043C\u044F \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u044F \u0441\u0442\u0430\u0442\u0443\u0441\u0430",
    pt: "Hor\xE1rio do status",
    nl: "Statustijd",
    fr: "Heure du statut",
    it: "Orario dello stato",
    es: "Hora del estado",
    pl: "Czas statusu",
    uk: "\u0427\u0430\u0441 \u043E\u0442\u0440\u0438\u043C\u0430\u043D\u043D\u044F \u0441\u0442\u0430\u0442\u0443\u0441\u0443",
    "zh-cn": "\u72B6\u6001\u65F6\u95F4"
  },
  sunroofStatus: {
    en: "Sun roof",
    de: "Schiebedach",
    ru: "\u041B\u044E\u043A",
    pt: "Teto solar",
    nl: "Schuifdak",
    fr: "Toit ouvrant",
    it: "Tetto apribile",
    es: "Techo solar",
    pl: "Szyberdach",
    uk: "\u041B\u044E\u043A",
    "zh-cn": "\u5929\u7A97"
  },
  vehElecRngDsp: {
    en: "Electric range display",
    de: "Anzeige der elektrischen Reichweite",
    ru: "\u041E\u0442\u043E\u0431\u0440\u0430\u0436\u0430\u0435\u043C\u044B\u0439 \u0437\u0430\u043F\u0430\u0441 \u0445\u043E\u0434\u0430 \u043D\u0430 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u0442\u044F\u0433\u0435",
    pt: "Autonomia el\xE9trica exibida",
    nl: "Weergave elektrische actieradius",
    fr: "Autonomie \xE9lectrique affich\xE9e",
    it: "Autonomia elettrica visualizzata",
    es: "Autonom\xEDa el\xE9ctrica mostrada",
    pl: "Wy\u015Bwietlany zasi\u0119g elektryczny",
    uk: "\u0412\u0456\u0434\u043E\u0431\u0440\u0430\u0436\u0443\u0432\u0430\u043D\u0438\u0439 \u0437\u0430\u043F\u0430\u0441 \u0445\u043E\u0434\u0443 \u043D\u0430 \u0435\u043B\u0435\u043A\u0442\u0440\u043E\u0442\u044F\u0437\u0456",
    "zh-cn": "\u663E\u793A\u7684\u7535\u52A8\u7EED\u822A\u91CC\u7A0B"
  },
  clstrDspdFuelLvlSgmt: {
    en: "Displayed fuel level segment",
    de: "Angezeigtes Kraftstoffsegment",
    ru: "\u041E\u0442\u043E\u0431\u0440\u0430\u0436\u0430\u0435\u043C\u044B\u0439 \u0441\u0435\u0433\u043C\u0435\u043D\u0442 \u0443\u0440\u043E\u0432\u043D\u044F \u0442\u043E\u043F\u043B\u0438\u0432\u0430",
    pt: "Segmento exibido do n\xEDvel de combust\xEDvel",
    nl: "Weergegeven brandstofniveausegment",
    fr: "Segment affich\xE9 du niveau de carburant",
    it: "Segmento visualizzato del livello carburante",
    es: "Segmento mostrado del nivel de combustible",
    pl: "Wy\u015Bwietlany segment poziomu paliwa",
    uk: "\u0412\u0456\u0434\u043E\u0431\u0440\u0430\u0436\u0443\u0432\u0430\u043D\u0438\u0439 \u0441\u0435\u0433\u043C\u0435\u043D\u0442 \u0440\u0456\u0432\u043D\u044F \u043F\u0430\u043B\u044C\u043D\u043E\u0433\u043E",
    "zh-cn": "\u663E\u793A\u7684\u71C3\u6CB9\u6DB2\u4F4D\u533A\u6BB5"
  },
  currentJourneyId: {
    en: "Current journey ID",
    de: "ID der aktuellen Fahrt",
    ru: "\u0418\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043F\u043E\u0435\u0437\u0434\u043A\u0438",
    pt: "ID da viagem atual",
    nl: "ID van huidige rit",
    fr: "Identifiant du trajet actuel",
    it: "ID del viaggio attuale",
    es: "ID del viaje actual",
    pl: "Identyfikator bie\u017C\u0105cej podr\xF3\u017Cy",
    uk: "\u0406\u0434\u0435\u043D\u0442\u0438\u0444\u0456\u043A\u0430\u0442\u043E\u0440 \u043F\u043E\u0442\u043E\u0447\u043D\u043E\u0457 \u043F\u043E\u0457\u0437\u0434\u043A\u0438",
    "zh-cn": "\u5F53\u524D\u884C\u7A0B ID"
  },
  extendedData2: {
    en: "Additional status data 2",
    de: "Zus\xE4tzliche Statusdaten 2",
    ru: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F 2",
    pt: "Dados adicionais de status 2",
    nl: "Aanvullende statusgegevens 2",
    fr: "Donn\xE9es de statut suppl\xE9mentaires 2",
    it: "Dati di stato aggiuntivi 2",
    es: "Datos de estado adicionales 2",
    pl: "Dodatkowe dane statusu 2",
    uk: "\u0414\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0456 \u0434\u0430\u043D\u0456 \u0441\u0442\u0430\u043D\u0443 2",
    "zh-cn": "\u9644\u52A0\u72B6\u6001\u6570\u636E 2"
  },
  frontLeftSeatHeatLevel: {
    en: "Heated seat front left",
    de: "Sitzheizung vorne links",
    ru: "\u041E\u0431\u043E\u0433\u0440\u0435\u0432 \u043F\u0435\u0440\u0435\u0434\u043D\u0435\u0433\u043E \u043B\u0435\u0432\u043E\u0433\u043E \u0441\u0438\u0434\u0435\u043D\u044C\u044F",
    pt: "Aquecimento do banco dianteiro esquerdo",
    nl: "Stoelverwarming linksvoor",
    fr: "Si\xE8ge avant gauche chauffant",
    it: "Riscaldamento sedile anteriore sinistro",
    es: "Calefacci\xF3n del asiento delantero izquierdo",
    pl: "Ogrzewanie lewego przedniego siedzenia",
    uk: "\u041E\u0431\u0456\u0433\u0440\u0456\u0432 \u043F\u0435\u0440\u0435\u0434\u043D\u044C\u043E\u0433\u043E \u043B\u0456\u0432\u043E\u0433\u043E \u0441\u0438\u0434\u0456\u043D\u043D\u044F",
    "zh-cn": "\u5DE6\u524D\u5EA7\u6905\u52A0\u70ED"
  },
  frontRightSeatHeatLevel: {
    en: "Heated seat front right",
    de: "Sitzheizung vorne rechts",
    ru: "\u041E\u0431\u043E\u0433\u0440\u0435\u0432 \u043F\u0435\u0440\u0435\u0434\u043D\u0435\u0433\u043E \u043F\u0440\u0430\u0432\u043E\u0433\u043E \u0441\u0438\u0434\u0435\u043D\u044C\u044F",
    pt: "Aquecimento do banco dianteiro direito",
    nl: "Stoelverwarming rechtsvoor",
    fr: "Si\xE8ge avant droit chauffant",
    it: "Riscaldamento sedile anteriore destro",
    es: "Calefacci\xF3n del asiento delantero derecho",
    pl: "Ogrzewanie prawego przedniego siedzenia",
    uk: "\u041E\u0431\u0456\u0433\u0440\u0456\u0432 \u043F\u0435\u0440\u0435\u0434\u043D\u044C\u043E\u0433\u043E \u043F\u0440\u0430\u0432\u043E\u0433\u043E \u0441\u0438\u0434\u0456\u043D\u043D\u044F",
    "zh-cn": "\u53F3\u524D\u5EA7\u6905\u52A0\u70ED"
  },
  gpsAltitude: {
    en: "GPS altitude",
    de: "GPS-H\xF6he",
    ru: "\u0412\u044B\u0441\u043E\u0442\u0430 GPS",
    pt: "Altitude GPS",
    nl: "GPS-hoogte",
    fr: "Altitude GPS",
    it: "Altitudine GPS",
    es: "Altitud GPS",
    pl: "Wysoko\u015B\u0107 GPS",
    uk: "\u0412\u0438\u0441\u043E\u0442\u0430 GPS",
    "zh-cn": "GPS \u6D77\u62D4"
  },
  gpsHdop: {
    en: "GPS horizontal accuracy (HDOP)",
    de: "GPS-Horizontalgenauigkeit (HDOP)",
    ru: "\u0413\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0442\u043E\u0447\u043D\u043E\u0441\u0442\u044C GPS (HDOP)",
    pt: "Precis\xE3o horizontal do GPS (HDOP)",
    nl: "Horizontale GPS-nauwkeurigheid (HDOP)",
    fr: "Pr\xE9cision horizontale GPS (HDOP)",
    it: "Precisione orizzontale GPS (HDOP)",
    es: "Precisi\xF3n horizontal GPS (HDOP)",
    pl: "Dok\u0142adno\u015B\u0107 pozioma GPS (HDOP)",
    uk: "\u0413\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u044C\u043D\u0430 \u0442\u043E\u0447\u043D\u0456\u0441\u0442\u044C GPS (HDOP)",
    "zh-cn": "GPS \u6C34\u5E73\u7CBE\u5EA6 (HDOP)"
  },
  gpsHeading: {
    en: "GPS heading",
    de: "GPS-Kurs",
    ru: "\u041D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 GPS",
    pt: "Dire\xE7\xE3o GPS",
    nl: "GPS-koers",
    fr: "Cap GPS",
    it: "Direzione GPS",
    es: "Rumbo GPS",
    pl: "Kierunek GPS",
    uk: "\u041D\u0430\u043F\u0440\u044F\u043C\u043E\u043A GPS",
    "zh-cn": "GPS \u822A\u5411"
  },
  gpsSatellites: {
    en: "GPS satellites",
    de: "GPS-Satelliten",
    ru: "\u0421\u043F\u0443\u0442\u043D\u0438\u043A\u0438 GPS",
    pt: "Sat\xE9lites GPS",
    nl: "GPS-satellieten",
    fr: "Satellites GPS",
    it: "Satelliti GPS",
    es: "Sat\xE9lites GPS",
    pl: "Satelity GPS",
    uk: "\u0421\u0443\u043F\u0443\u0442\u043D\u0438\u043A\u0438 GPS",
    "zh-cn": "GPS \u536B\u661F\u6570"
  },
  lastKeySeen: {
    en: "Last key detected",
    de: "Zuletzt erkannter Schl\xFCssel",
    ru: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u043E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u043D\u044B\u0439 \u043A\u043B\u044E\u0447",
    pt: "\xDAltima chave detectada",
    nl: "Laatst gedetecteerde sleutel",
    fr: "Derni\xE8re cl\xE9 d\xE9tect\xE9e",
    it: "Ultima chiave rilevata",
    es: "\xDAltima llave detectada",
    pl: "Ostatni wykryty kluczyk",
    uk: "\u041E\u0441\u0442\u0430\u043D\u043D\u0456\u0439 \u0432\u0438\u044F\u0432\u043B\u0435\u043D\u0438\u0439 \u043A\u043B\u044E\u0447",
    "zh-cn": "\u6700\u8FD1\u68C0\u6D4B\u5230\u7684\u94A5\u5319"
  },
  mainBeamStatus: {
    en: "Main beam",
    de: "Fernlicht",
    ru: "\u0414\u0430\u043B\u044C\u043D\u0438\u0439 \u0441\u0432\u0435\u0442",
    pt: "Farol alto",
    nl: "Grootlicht",
    fr: "Feux de route",
    it: "Abbaglianti",
    es: "Luces largas",
    pl: "\u015Awiat\u0142a drogowe",
    uk: "\u0414\u0430\u043B\u044C\u043D\u0454 \u0441\u0432\u0456\u0442\u043B\u043E",
    "zh-cn": "\u8FDC\u5149\u706F"
  },
  powerMode: {
    en: "Power mode",
    de: "Betriebsmodus",
    ru: "\u0420\u0435\u0436\u0438\u043C \u043F\u0438\u0442\u0430\u043D\u0438\u044F",
    pt: "Modo de energia",
    nl: "Vermogensmodus",
    fr: "Mode de puissance",
    it: "Modalit\xE0 di alimentazione",
    es: "Modo de alimentaci\xF3n",
    pl: "Tryb zasilania",
    uk: "\u0420\u0435\u0436\u0438\u043C \u0436\u0438\u0432\u043B\u0435\u043D\u043D\u044F",
    "zh-cn": "\u7535\u6E90\u6A21\u5F0F"
  },
  rmtHtdRrWndSt: {
    en: "Rear window heating",
    de: "Heckscheibenheizung",
    ru: "\u041E\u0431\u043E\u0433\u0440\u0435\u0432 \u0437\u0430\u0434\u043D\u0435\u0433\u043E \u0441\u0442\u0435\u043A\u043B\u0430",
    pt: "Aquecimento do vidro traseiro",
    nl: "Achterruitverwarming",
    fr: "D\xE9givrage de la lunette arri\xE8re",
    it: "Riscaldamento del lunotto posteriore",
    es: "Calefacci\xF3n de la luneta trasera",
    pl: "Ogrzewanie tylnej szyby",
    uk: "\u041E\u0431\u0456\u0433\u0440\u0456\u0432 \u0437\u0430\u0434\u043D\u044C\u043E\u0433\u043E \u0441\u043A\u043B\u0430",
    "zh-cn": "\u540E\u7A97\u52A0\u70ED"
  },
  steeringWheelHeatFailureReason: {
    en: "Steering wheel heating failure reason",
    de: "Fehlergrund der Lenkradheizung",
    ru: "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u0438 \u043E\u0431\u043E\u0433\u0440\u0435\u0432\u0430 \u0440\u0443\u043B\u0435\u0432\u043E\u0433\u043E \u043A\u043E\u043B\u0435\u0441\u0430",
    pt: "Motivo da falha do aquecimento do volante",
    nl: "Reden voor storing in stuurwielverwarming",
    fr: "Cause de panne du chauffage du volant",
    it: "Causa del guasto del riscaldamento del volante",
    es: "Motivo del fallo de la calefacci\xF3n del volante",
    pl: "Przyczyna awarii podgrzewania kierownicy",
    uk: "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043D\u0435\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u0456 \u043E\u0431\u0456\u0433\u0440\u0456\u0432\u0443 \u043A\u0435\u0440\u043C\u0430",
    "zh-cn": "\u65B9\u5411\u76D8\u52A0\u70ED\u6545\u969C\u539F\u56E0"
  }
};
const booleanStatusFields = /* @__PURE__ */ new Set([
  "bonnetStatus",
  "bootStatus",
  "canBusActive",
  "dippedBeamStatus",
  "driverDoor",
  "driverWindow",
  "engineStatus",
  "handBrake",
  "lockStatus",
  "onlineStatus",
  "passengerDoor",
  "passengerWindow",
  "rearLeftDoor",
  "rearLeftWindow",
  "rearRightDoor",
  "rearRightWindow",
  "rmtHtdRrWndSt",
  "sideLightStatus",
  "sunroofStatus"
]);
const statusRoles = {
  batteryVoltage: "value.voltage",
  currentJourneyDistance: "value.distance",
  exteriorTemperature: "value.temperature",
  extendedData1: "value.battery",
  frontLeftTyrePressure: "value.pressure",
  frontRightTyrePressure: "value.pressure",
  fuelRange: "value.distance",
  fuelRangeElec: "value.distance",
  fuelLevelPrc: "value.fill",
  gpsAltitude: "value.gps.elevation",
  gpsLatitude: "value.gps.latitude",
  gpsLongitude: "value.gps.longitude",
  interiorTemperature: "value.temperature",
  mileage: "value.distance",
  rearLeftTyrePressure: "value.pressure",
  rearRightTyrePressure: "value.pressure",
  speed: "value.speed",
  statusTime: "date",
  vehElecRngDsp: "value.distance"
};
const statusUnits = {
  batteryVoltage: "V",
  currentJourneyDistance: "km",
  exteriorTemperature: "\xB0C",
  extendedData1: "%",
  gpsAltitude: "m",
  gpsLatitude: "\xB0",
  gpsLongitude: "\xB0",
  frontLeftTyrePressure: "bar",
  frontRightTyrePressure: "bar",
  fuelLevelPrc: "%",
  fuelRange: "km",
  fuelRangeElec: "km",
  interiorTemperature: "\xB0C",
  mileage: "km",
  rearLeftTyrePressure: "bar",
  rearRightTyrePressure: "bar",
  vehElecRngDsp: "km",
  speed: "km/h"
};
const statusScales = {
  batteryVoltage: { factor: 0.1, precision: 1 },
  currentJourneyDistance: { factor: 0.1, precision: 1 },
  fuelRange: { factor: 0.1, precision: 1 },
  fuelRangeElec: { factor: 0.1, precision: 1 },
  frontLeftTyrePressure: { factor: 0.04, precision: 2 },
  frontRightTyrePressure: { factor: 0.04, precision: 2 },
  mileage: { factor: 0.1, precision: 1 },
  rearLeftTyrePressure: { factor: 0.04, precision: 2 },
  rearRightTyrePressure: { factor: 0.04, precision: 2 },
  speed: { factor: 0.1, precision: 1 }
};
const chargingBooleanFields = /* @__PURE__ */ new Set([
  "ccuEleccLckCtrlDspCmd",
  "ccuOffBdChrgrPlugOn",
  "ccuOnbdChrgrPlugOn",
  "chargingGunState"
]);
const chargingFieldMetadata = {
  bmsPackSOCDsp: { type: "number", role: "value.battery", unit: "%", factor: 0.1, precision: 1 },
  bmsPackCrnt: { type: "number", role: "value.current", unit: "A", factor: -0.05, offset: 1e3, precision: 2 },
  bmsPackVol: { type: "number", role: "value.voltage", unit: "V", factor: 0.25, precision: 1 },
  bmsEstdElecRng: { type: "number", role: "value.distance", unit: "km" },
  bmsOnBdChrgTrgtSOCDspCmd: { type: "number", role: "value.battery", unit: "%" },
  chrgngAddedElecRng: { type: "number", role: "value.distance", unit: "km" },
  chrgngRmnngTime: { type: "number", role: "value.interval" },
  clstrElecRngToEPT: { type: "number", role: "value.distance", unit: "km" },
  disChrgngRmnngTime: { type: "number", role: "value.interval" },
  imcuChrgngEstdElecRng: { type: "number", role: "value.distance", unit: "km" },
  imcuDschrgngEstdElecRng: { type: "number", role: "value.distance", unit: "km" },
  imcuVehElecRng: { type: "number", role: "value.distance", unit: "km" },
  onBdChrgrAltrCrntInptCrnt: { type: "number", role: "value.current" },
  onBdChrgrAltrCrntInptVol: { type: "number", role: "value.voltage" },
  chargingDuration: { type: "number", role: "value.interval", unit: "min", factor: 1 / 60, precision: 1 },
  endTime: { type: "number", role: "date", factor: 1e3 },
  fuelRangeElec: { type: "number", role: "value.distance", unit: "km", factor: 0.1, precision: 1 },
  mileage: { type: "number", role: "value.distance", unit: "km", factor: 0.1, precision: 1 },
  mileageOfDay: { type: "number", role: "value.distance", unit: "km", factor: 0.1, precision: 1 },
  mileageSinceLastCharge: { type: "number", role: "value.distance", unit: "km", factor: 0.1, precision: 1 },
  powerUsageOfDay: { type: "number", role: "value.energy", unit: "kWh", factor: 0.1, precision: 1 },
  powerUsageSinceLastCharge: { type: "number", role: "value.energy", unit: "kWh", factor: 0.1, precision: 1 },
  startTime: { type: "number", role: "date", factor: 1e3 },
  totalBatteryCapacity: { type: "number", role: "value.energy", unit: "kWh", factor: 0.1, precision: 1 },
  workingCurrent: { type: "number", role: "value.current" },
  workingVoltage: { type: "number", role: "value.voltage" }
};
function getChargingFieldMetadata(key) {
  var _a;
  if (chargingBooleanFields.has(key)) {
    return { type: "boolean", role: key === "ccuEleccLckCtrlDspCmd" ? "indicator" : "sensor" };
  }
  return (_a = chargingFieldMetadata[key]) != null ? _a : { type: "number", role: "value" };
}
function normalizeChargingValue(key, value) {
  var _a;
  const metadata = getChargingFieldMetadata(key);
  if (metadata.type === "boolean") {
    return value === 1 || value === "1";
  }
  if (key === "bmsOnBdChrgTrgtSOCDspCmd" && typeof value === "number") {
    return value >= 1 && value <= 7 ? (value + 3) * 10 : value;
  }
  if (typeof value !== "number" || value === -128 || metadata.factor === void 0) {
    return value;
  }
  const normalized = value * metadata.factor + ((_a = metadata.offset) != null ? _a : 0);
  return metadata.precision === void 0 ? normalized : Number(normalized.toFixed(metadata.precision));
}
function getVehicleStatusMetadata(key) {
  var _a, _b;
  const name = (_a = statusNames[key]) != null ? _a : Object.fromEntries(
    ["en", "de", "ru", "pt", "nl", "fr", "it", "es", "pl", "uk", "zh-cn"].map((language) => [
      language,
      key
    ])
  );
  if (key === "statusTime") {
    return { type: "number", role: "date", name };
  }
  if (booleanStatusFields.has(key)) {
    return {
      type: "boolean",
      role: key.endsWith("Door") ? "sensor.door" : key.endsWith("Window") ? "sensor.window" : "indicator",
      name
    };
  }
  return {
    type: "number",
    role: (_b = statusRoles[key]) != null ? _b : "value",
    name,
    ...statusUnits[key] ? { unit: statusUnits[key] } : {}
  };
}
function normalizeVehicleStatusValue(key, value) {
  if (key === "statusTime") {
    return value * 1e3;
  }
  if (booleanStatusFields.has(key) && (value === 0 || value === 1)) {
    return value === 1;
  }
  const scale = statusScales[key];
  return scale ? Number((value * scale.factor).toFixed(scale.precision)) : value;
}
function shouldDeleteUnavailableStatusValue(key) {
  return key !== "mileage";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getChargingFieldMetadata,
  getVehicleStatusGroup,
  getVehicleStatusMetadata,
  normalizeChargingValue,
  normalizeVehicleStatusValue,
  shouldDeleteUnavailableStatusValue
});
//# sourceMappingURL=status-metadata.js.map
