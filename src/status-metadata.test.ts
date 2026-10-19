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
	});

	it('converts binary numeric status values to booleans', () => {
		expect(normalizeVehicleStatusValue('lockStatus', 0)).to.equal(false);
		expect(normalizeVehicleStatusValue('lockStatus', 1)).to.equal(true);
		expect(normalizeVehicleStatusValue('mileage', 1)).to.equal(1);
	});

	it('leaves unknown units unspecified', () => {
		expect(getVehicleStatusMetadata('frontLeftTyrePressure')).to.deep.equal({
			type: 'number',
			role: 'value',
		});
	});
});
