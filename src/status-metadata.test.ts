import { expect } from 'chai';
import {
	getVehicleStatusGroup,
	getVehicleStatusMetadata,
	normalizeVehicleStatusValue,
	shouldDeleteUnavailableStatusValue,
} from './status-metadata';

describe('getVehicleStatusMetadata', () => {
	it('groups status datapoints by vehicle function', () => {
		expect(getVehicleStatusGroup('speed')).to.equal('driving');
		expect(getVehicleStatusGroup('driverWindow')).to.equal('access');
		expect(getVehicleStatusGroup('interiorTemperature')).to.equal('climate');
		expect(getVehicleStatusGroup('frontLeftTyrePressure')).to.equal('tires');
		expect(getVehicleStatusGroup('sideLightStatus')).to.equal('lighting');
		expect(getVehicleStatusGroup('batteryVoltage')).to.equal('energy');
		expect(getVehicleStatusGroup('extendedData1')).to.equal('energy');
		expect(getVehicleStatusGroup('gpsLatitude')).to.equal('general');
		expect(getVehicleStatusGroup('wheelTyreMonitorStatus')).to.equal('tires');
		expect(getVehicleStatusGroup('statusTime')).to.equal('general');
	});

	it('marks binary vehicle states as boolean indicators', () => {
		const booleanFields = [
			'bonnetStatus',
			'bootStatus',
			'canBusActive',
			'dippedBeamStatus',
			'driverDoor',
			'driverWindow',
			'engineStatus',
			'handBrake',
			'lockStatus',
			'onlineStatus',
			'passengerDoor',
			'passengerWindow',
			'rearLeftDoor',
			'rearLeftWindow',
			'rearRightDoor',
			'rearRightWindow',
			'rmtHtdRrWndSt',
			'sideLightStatus',
			'sunroofStatus',
		];
		for (const key of booleanFields) {
			const metadata = getVehicleStatusMetadata(key);
			expect(metadata.type).to.equal('boolean');
			expect(metadata.name.en).to.be.a('string').and.not.empty;
			expect(metadata.name.de).to.be.a('string').and.not.empty;
			expect(normalizeVehicleStatusValue(key, 0)).to.equal(false);
			expect(normalizeVehicleStatusValue(key, 1)).to.equal(true);
		}
		expect(getVehicleStatusMetadata('driverDoor').role).to.equal('sensor.door');
		expect(getVehicleStatusMetadata('driverWindow').role).to.equal('sensor.window');
		expect(getVehicleStatusMetadata('remoteClimateStatus')).to.include({ type: 'number', role: 'value' });
	});

	it('assigns units to known measurements', () => {
		expect(getVehicleStatusMetadata('batteryVoltage')).to.include({
			type: 'number',
			role: 'value.voltage',
			unit: 'V',
		});
		expect(getVehicleStatusMetadata('extendedData1')).to.include({
			type: 'number',
			role: 'value.battery',
			unit: '%',
		});
		expect(getVehicleStatusMetadata('gpsAltitude')).to.include({
			type: 'number',
			role: 'value.gps.elevation',
			unit: 'm',
		});
		expect(getVehicleStatusMetadata('gpsLatitude')).to.include({
			type: 'number',
			role: 'value.gps.latitude',
			unit: '°',
		});
		expect(getVehicleStatusMetadata('fuelLevelPrc').unit).to.equal('%');
		expect(getVehicleStatusMetadata('interiorTemperature').unit).to.equal('°C');
		expect(getVehicleStatusMetadata('fuelRange').unit).to.equal('km');
		expect(getVehicleStatusMetadata('frontLeftTyrePressure').unit).to.equal('bar');
		expect(getVehicleStatusMetadata('speed').unit).to.equal('km/h');
		expect(getVehicleStatusMetadata('statusTime')).to.include({ type: 'number', role: 'date' });
		expect(getVehicleStatusMetadata('interiorTemperature').role).to.equal('value.temperature');
		expect(getVehicleStatusMetadata('gpsLatitude').role).to.equal('value.gps.latitude');
		expect(getVehicleStatusMetadata('frontLeftTyrePressure').role).to.equal('value.pressure');
		expect(getVehicleStatusMetadata('batteryVoltage').role).to.equal('value.voltage');
		expect(getVehicleStatusMetadata('mileage').role).to.equal('value.distance');
	});

	it('converts binary numeric status values to booleans', () => {
		expect(normalizeVehicleStatusValue('lockStatus', 0)).to.equal(false);
		expect(normalizeVehicleStatusValue('lockStatus', 1)).to.equal(true);
		expect(normalizeVehicleStatusValue('mileage', 40001)).to.equal(4000.1);
		expect(normalizeVehicleStatusValue('batteryVoltage', 142)).to.equal(14.2);
		expect(normalizeVehicleStatusValue('extendedData1', 63)).to.equal(63);
		expect(normalizeVehicleStatusValue('fuelRangeElec', 3240)).to.equal(324);
		expect(normalizeVehicleStatusValue('currentJourneyDistance', 125)).to.equal(12.5);
		expect(normalizeVehicleStatusValue('frontLeftTyrePressure', 62)).to.equal(2.48);
		expect(normalizeVehicleStatusValue('interiorTemperature', 21)).to.equal(21);
		expect(normalizeVehicleStatusValue('statusTime', 1_792_442_089)).to.equal(1_792_442_089_000);
		expect(normalizeVehicleStatusValue('speed', 425)).to.equal(42.5);
		expect(normalizeVehicleStatusValue('remoteClimateStatus', 2)).to.equal(2);
	});

	it('leaves unknown measurements unchanged', () => {
		expect(getVehicleStatusMetadata('frontLeftTyrePressure')).to.include({
			type: 'number',
			role: 'value.pressure',
			unit: 'bar',
		});
		expect(normalizeVehicleStatusValue('unscaledField', 42)).to.equal(42);
	});

	it('retains the last known odometer when SAIC omits its value', () => {
		expect(shouldDeleteUnavailableStatusValue('mileage')).to.equal(false);
		expect(shouldDeleteUnavailableStatusValue('speed')).to.equal(true);
	});

	it('localizes the charging port lock status without changing its raw numeric code', () => {
		const metadata = getVehicleStatusMetadata('Charging_Port_Lock_Set_Off');
		expect(metadata.name.en).to.equal('Charging port lock set off');
		expect(metadata.name.de).to.equal('Ladeanschluss entriegelt');
		expect(metadata.type).to.equal('number');
		expect(normalizeVehicleStatusValue('Charging_Port_Lock_Set_Off', 2)).to.equal(2);
	});

	it('provides localized Home Assistant-style state names', () => {
		const names = getVehicleStatusMetadata('batteryVoltage').name;
		expect(names.en).to.equal('Auxiliary battery voltage');
		expect(names.de).to.equal('Spannung der 12-V-Batterie');
		for (const language of ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'] as const) {
			expect(names[language]).to.be.a('string').and.not.empty;
		}
		expect(getVehicleStatusMetadata('fuelRange').name.en).to.equal('Fossil fuel range');
		expect(getVehicleStatusMetadata('speed').name.en).to.equal('Speed');
		expect(getVehicleStatusMetadata('wheelTyreMonitorStatus').name.en).to.equal('Wheel tyre monitor status');
	});

	it('localizes every status field present in the exported vehicle data', () => {
		const exportedFields = [
			'clstrDspdFuelLvlSgmt',
			'currentJourneyId',
			'extendedData1',
			'extendedData2',
			'frontLeftSeatHeatLevel',
			'frontRightSeatHeatLevel',
			'gpsAltitude',
			'gpsHdop',
			'gpsHeading',
			'gpsLatitude',
			'gpsLongitude',
			'gpsSatellites',
			'lastKeySeen',
			'mainBeamStatus',
			'powerMode',
			'rmtHtdRrWndSt',
			'steeringWheelHeatFailureReason',
			'statusTime',
		];
		const languages = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'] as const;

		for (const key of exportedFields) {
			const name = getVehicleStatusMetadata(key).name;
			for (const language of languages) {
				expect(name[language], `${key} (${language})`).to.be.a('string').and.not.empty;
				expect(name[language], `${key} (${language})`).not.to.equal(key);
			}
		}
		for (const language of languages) {
			expect(getVehicleStatusMetadata('unknownFutureField').name[language]).to.equal('unknownFutureField');
		}
	});
});
