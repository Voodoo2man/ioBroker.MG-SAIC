/** ioBroker metadata for one vehicle status value. */
export interface VehicleStatusMetadata {
	/** State value type. */
	type: 'number' | 'boolean';
	/** Semantic ioBroker state role. */
	role: string;
	/** Physical unit, when known. */
	unit?: string;
}

const booleanStatusFields = new Set([
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
	'remoteClimateStatus',
	'sideLightStatus',
	'sunroofStatus',
]);

const statusUnits: Record<string, string> = {
	batteryVoltage: 'V',
	currentJourneyDistance: 'km',
	exteriorTemperature: '°C',
	frontLeftTyrePressure: 'bar',
	frontRightTyrePressure: 'bar',
	fuelLevelPrc: '%',
	fuelRange: 'km',
	fuelRangeElec: 'km',
	interiorTemperature: '°C',
	mileage: 'km',
	rearLeftTyrePressure: 'bar',
	rearRightTyrePressure: 'bar',
	vehElecRngDsp: 'km',
};

const statusScales: Record<string, { factor: number; precision: number }> = {
	batteryVoltage: { factor: 0.1, precision: 1 },
	currentJourneyDistance: { factor: 0.1, precision: 1 },
	fuelRange: { factor: 0.1, precision: 1 },
	fuelRangeElec: { factor: 0.1, precision: 1 },
	frontLeftTyrePressure: { factor: 0.04, precision: 2 },
	frontRightTyrePressure: { factor: 0.04, precision: 2 },
	mileage: { factor: 0.1, precision: 1 },
	rearLeftTyrePressure: { factor: 0.04, precision: 2 },
	rearRightTyrePressure: { factor: 0.04, precision: 2 },
};

/**
 * Returns the ioBroker metadata for a vehicle status field.
 *
 * @param key SAIC status field name.
 */
export function getVehicleStatusMetadata(key: string): VehicleStatusMetadata {
	if (booleanStatusFields.has(key)) {
		return { type: 'boolean', role: 'indicator' };
	}
	return {
		type: 'number',
		role: 'value',
		...(statusUnits[key] ? { unit: statusUnits[key] } : {}),
	};
}

/**
 * Converts binary numeric codes to booleans for known indicator fields.
 *
 * @param key SAIC status field name.
 * @param value Numeric value returned by the API.
 */
export function normalizeVehicleStatusValue(key: string, value: number): number | boolean {
	if (booleanStatusFields.has(key) && (value === 0 || value === 1)) {
		return value === 1;
	}
	const scale = statusScales[key];
	return scale ? Number((value * scale.factor).toFixed(scale.precision)) : value;
}
