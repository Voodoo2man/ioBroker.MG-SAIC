import { expect } from 'chai';
import { getVehicleStatusMetadata, normalizeVehicleStatusValue } from './status-metadata';

describe('getVehicleStatusMetadata', () => {
	it('marks binary vehicle states as boolean indicators', () => {
		for (const key of ['driverDoor', 'lockStatus', 'engineStatus', 'onlineStatus']) {
			expect(getVehicleStatusMetadata(key)).to.deep.equal({ type: 'boolean', role: 'indicator' });
		}
	});

	it('assigns units to known measurements', () => {
		expect(getVehicleStatusMetadata('batteryVoltage')).to.deep.equal({
			type: 'number',
			role: 'value',
			unit: 'V',
		});
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
		expect(getVehicleStatusMetadata('frontLeftTyrePressure')).to.deep.equal({
			type: 'number',
			role: 'value',
			unit: 'bar',
		});
		expect(normalizeVehicleStatusValue('unscaledField', 42)).to.equal(42);
	});
});
