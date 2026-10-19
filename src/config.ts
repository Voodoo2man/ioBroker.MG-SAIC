import { isIndiaRegion, resolveSaicRegion } from './regions';

/** Settings entered for one iSmart account and backend. */
export interface MgSaicConfig {
	/** Backend region code. */
	region?: string;
	/** Whether the account identifier is an email address or phone number. */
	accountType?: string;
	/** Email address or phone number used to sign in. */
	accountIdentifier?: string;
	/** International calling code when using a phone account. */
	phoneCountryCode?: string;
	/** Account password, decrypted by ioBroker for the adapter process. */
	password?: string;
}

/**
 * Returns configuration problems without logging any credential values.
 *
 * @param config The instance's native configuration.
 */
export function validateConfig(config: MgSaicConfig): string[] {
	const errors: string[] = [];
	if (!config.region?.trim()) {
		errors.push('Region/backend code is required');
	} else if (isIndiaRegion(config.region)) {
		errors.push('India TAP connectivity is not implemented yet');
	} else if (!resolveSaicRegion(config.region)) {
		errors.push('Unsupported SAIC region');
	}
	if (config.accountType !== 'email' && config.accountType !== 'phone') {
		errors.push('Login type must be email or phone');
	}
	if (!config.accountIdentifier?.trim()) {
		errors.push('Email address or phone number is required');
	}
	if (config.accountType === 'phone' && !config.phoneCountryCode?.trim()) {
		errors.push('Phone country calling code is required');
	}
	if (!config.password) {
		errors.push('Password is required');
	}
	return errors;
}
