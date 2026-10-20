import { expect } from 'chai';
import { getRuntimeName, supportedLanguages } from './runtime-translations';

describe('runtime command translations', () => {
	it('provides localized labels for every exposed command and action', () => {
		const commandIds = [
			'refresh',
			'commands',
			'commandGroup_access',
			'commandGroup_climate',
			'commandGroup_heating',
			'commandGroup_charging',
			'commandGroup_schedules',
			'commandGroup_vehicle',
			'currentStatus',
			'liveStatus',
			'cachedStatus',
			'statusSource',
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

	it('rejects missing translation keys instead of showing an unrelated label', () => {
		expect(() => getRuntimeName('unknownCommand')).to.throw('Missing runtime translation: unknownCommand');
	});
});
