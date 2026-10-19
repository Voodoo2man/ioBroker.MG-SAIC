import { expect } from 'chai';
import { getVehicleStatusMetadata, normalizeVehicleStatusValue } from './status-metadata';

describe('getVehicleStatusMetadata', () => {
	it('marks binary vehicle states as boolean indicators', () => {
		for (const key of ['driverDoor', 'lockStatus', 'engineStatus', 'onlineStatus']) {
			const metadata = getVehicleStatusMetadata(key);
			expect(metadata).to.include({ type: 'boolean', role: 'indicator' });
			expect(metadata.name.en).to.be.a('string').and.not.empty;
			expect(metadata.name.de).to.be.a('string').and.not.empty;
		}
	});

	it('assigns units to known measurements', () => {
		expect(getVehicleStatusMetadata('batteryVoltage')).to.include({ type: 'number', role: 'value', unit: 'V' });
		expect(getVehicleStatusMetadata('fuelLevelPrc').unit).to.equal('%');
		expect(getVehicleStatusMetadata('interiorTemperature').unit).to.equal('°C');
		expect(getVehicleStatusMetadata('fuelRange').unit).to.equal('km');
		expect(getVehicleStatusMetadata('frontLeftTyrePressure').unit).to.equal('bar');
	});

	it('converts binary numeric status values to booleans', () => {
		expect(normalizeVehicleStatusValue('lockStatus', 0)).to.equal(false);
		expect(normalizeVehicleStatusValue('lockStatus', 1)).to.equal(true);
		expect(normalizeVehicleStatusValue('mileage', 40001)).to.equal(4000.1);
		expect(normalizeVehicleStatusValue('batteryVoltage', 142)).to.equal(14.2);
		expect(normalizeVehicleStatusValue('fuelRangeElec', 3240)).to.equal(324);
		expect(normalizeVehicleStatusValue('currentJourneyDistance', 125)).to.equal(12.5);
		expect(normalizeVehicleStatusValue('frontLeftTyrePressure', 62)).to.equal(2.48);
		expect(normalizeVehicleStatusValue('interiorTemperature', 21)).to.equal(21);
	});

	it('leaves unknown measurements unchanged', () => {
		expect(getVehicleStatusMetadata('frontLeftTyrePressure')).to.include({
			type: 'number',
			role: 'value',
			unit: 'bar',
		});
		expect(normalizeVehicleStatusValue('unscaledField', 42)).to.equal(42);
	});

	it('provides localized Home Assistant-style state names', () => {
		const names = getVehicleStatusMetadata('batteryVoltage').name;
		expect(names.en).to.equal('Auxiliary battery voltage');
		expect(names.de).to.equal('Spannung der 12-V-Batterie');
		for (const language of ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'] as const) {
			expect(names[language]).to.be.a('string').and.not.empty;
		}
		expect(getVehicleStatusMetadata('fuelRange').name.en).to.equal('Fossil fuel range');
	});
});
