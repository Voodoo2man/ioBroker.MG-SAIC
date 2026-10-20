import { expect } from 'chai';
import { getRuntimeName, supportedLanguages } from './runtime-translations';

describe('runtime command translations', () => {
	it('provides localized labels for every exposed command and action', () => {
		const commandIds = [
			'refresh',
			'commands',
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
