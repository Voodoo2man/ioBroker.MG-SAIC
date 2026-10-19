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
	fuelLevelPrc: '%',
	fuelRange: 'km',
	fuelRangeElec: 'km',
	interiorTemperature: '°C',
	mileage: 'km',
	vehElecRngDsp: 'km',
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
	return booleanStatusFields.has(key) && (value === 0 || value === 1) ? value === 1 : value;
}
