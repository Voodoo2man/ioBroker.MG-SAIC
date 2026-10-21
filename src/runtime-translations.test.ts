import { expect } from 'chai';
import { getChargingFieldName, getRuntimeName, supportedLanguages } from './runtime-translations';
import type { VehicleStatusGroup } from './status-metadata';

describe('runtime command translations', () => {
	it('provides separate translation keys for status and command groups', () => {
		const statusGroups: VehicleStatusGroup[] = [
			'driving',
			'access',
			'climate',
			'tires',
			'lighting',
			'energy',
			'general',
		];
		const commandGroups = ['access', 'climate', 'heating', 'charging', 'schedules', 'vehicle'];

		for (const group of statusGroups) {
			expect(getRuntimeName(group), `status group ${group}`).to.be.an('object');
		}
		for (const group of commandGroups) {
			expect(getRuntimeName(`commandGroup_${group}`), `command group ${group}`).to.be.an('object');
		}
	});

	it('provides localized labels for every exposed command and action', () => {
		const commandIds = [
			'info',
			'backend',
			'connection',
			'lastError',
			'refresh',
			'commands',
			'commandGroup_access',
			'commandGroup_climate',
			'commandGroup_heating',
			'commandGroup_charging',
			'chargingManagement',
			'chargeStatus',
			'commandGroup_schedules',
			'commandGroup_vehicle',
			'currentStatus',
			'liveStatus',
			'cachedStatus',
			'statusSource',
			'statusSourceTimestamp',
			'driving',
			'access',
			'climate',
			'tires',
			'lighting',
			'energy',
			'general',
			'name',
			'brandName',
			'modelName',
			'series',
			'modelYear',
			'colorName',
			'isCurrentVehicle',
			'isSubaccount',
			'vin',
			'climateTemperature',
			'chargeTargetSoc',
			'chargingCurrentLimit',
			'chargingScheduleStart',
			'chargingScheduleEnd',
			'chargingScheduleMode',
			'batteryHeatingScheduleEnabled',
			'batteryHeatingScheduleStart',
			'driverSeatHeatLevel',
			'passengerSeatHeatLevel',
			'lock',
			'unlock',
			'openBoot',
			'climateStart',
			'climateStop',
			'frontDefrost',
			'rearWindowHeatStart',
			'rearWindowHeatStop',
			'batteryHeatStart',
			'batteryHeatStop',
			'chargingStart',
			'chargingStop',
			'chargingPortLock',
			'chargingPortUnlock',
			'findMyCar',
			'climateTemperatureApply',
			'chargingSettingsApply',
			'chargingScheduleApply',
			'batteryHeatingScheduleApply',
		];

		for (const id of commandIds) {
			const name = getRuntimeName(id);
			for (const language of supportedLanguages) {
				expect(name[language], `${id} (${language})`).to.be.a('string').and.not.empty;
				expect(name[language], `${id} (${language})`).not.to.equal(id);
			}
		}
	});

	it('provides display names for charging API datapoints', () => {
		const fields = [
			'bmsAdpPubChrgSttnDspCmd',
			'bmsAltngChrgCrntDspCmd',
			'bmsChrgCtrlDspCmd',
			'bmsChrgOtptCrntReq',
			'bmsChrgOtptCrntReqV',
			'bmsChrgSpRsn',
			'bmsChrgSts',
			'bmsDsChrgSpRsn',
			'bmsEstdElecRng',
			'bmsOnBdChrgTrgtSOCDspCmd',
			'bmsPTCHeatReqDspCmd',
			'bmsPTCHeatResp',
			'bmsPackCrnt',
			'bmsPackCrntV',
			'bmsPackSOCDsp',
			'bmsPackVol',
			'bmsReserCtrlDspCmd',
			'bmsReserSpHourDspCmd',
			'bmsReserSpMintueDspCmd',
			'bmsReserStHourDspCmd',
			'bmsReserStMintueDspCmd',
			'ccuEleccLckCtrlDspCmd',
			'ccuOffBdChrgrPlugOn',
			'ccuOnbdChrgrPlugOn',
			'chrgngAddedElecRng',
			'chrgngAddedElecRngV',
			'chrgngDoorOpenCnd',
			'chrgngDoorPosSts',
			'chrgngRmnngTime',
			'chrgngRmnngTimeV',
			'chrgngSpdngTime',
			'chrgngSpdngTimeV',
			'clstrElecRngToEPT',
			'disChrgngRmnngTime',
			'disChrgngRmnngTimeV',
			'imcuChrgngEstdElecRng',
			'imcuChrgngEstdElecRngV',
			'imcuDschrgngEstdElecRng',
			'imcuDschrgngEstdElecRngV',
			'imcuVehElecRng',
			'imcuVehElecRngV',
			'onBdChrgrAltrCrntInptCrnt',
			'onBdChrgrAltrCrntInptVol',
			'chargingDuration',
			'chargingGunState',
			'chargingType',
			'endTime',
			'fuelRangeElec',
			'mileage',
			'mileageOfDay',
			'mileageSinceLastCharge',
			'powerUsageOfDay',
			'powerUsageSinceLastCharge',
			'realtimePower',
			'startTime',
			'totalBatteryCapacity',
			'workingCurrent',
			'workingVoltage',
		];
		for (const field of fields) {
			const name = getChargingFieldName(field);
			for (const language of supportedLanguages) {
				expect(name[language], `${field} (${language})`).to.be.a('string').and.not.empty;
				expect(name[language], `${field} (${language})`).not.to.equal(field);
			}
		}
	});

	it('rejects missing translation keys instead of showing an unrelated label', () => {
		expect(() => getRuntimeName('unknownCommand')).to.throw('Missing runtime translation: unknownCommand');
	});
});
