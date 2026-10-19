import * as utils from '@iobroker/adapter-core';
import { validateConfig, type MgSaicConfig } from './config';
import { SaicApiClient } from './saic-client';
import { resolveSaicRegion } from './regions';

class MgSaic extends utils.Adapter {
	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: 'mg-saic',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	private async onReady(): Promise<void> {
		const config = this.config as unknown as MgSaicConfig;
		await this.setState('info.connection', false, true);
		await this.setState('info.backend', config.region?.trim() || 'not configured', true);
		const errors = validateConfig(config);
		await this.setState('info.lastError', errors.join('; '), true);
		if (errors.length) {
			this.log.warn(`Configuration is incomplete: ${errors.join('; ')}`);
			return;
		}

		const region = resolveSaicRegion(config.region ?? '');
		if (!region) {
			return;
		}

		try {
			await new SaicApiClient().login({
				...region,
				accountType: config.accountType as 'email' | 'phone',
				accountIdentifier: config.accountIdentifier ?? '',
				phoneCountryCode: config.phoneCountryCode,
				password: config.password ?? '',
			});
			await this.setState('info.connection', true, true);
			await this.setState('info.lastError', '', true);
			this.log.info('SAIC account authenticated. Vehicle discovery is not implemented yet.');
		} catch {
			const error = 'SAIC login failed; check the selected region, account credentials, or connectivity';
			await this.setState('info.connection', false, true);
			await this.setState('info.lastError', error, true);
			this.log.warn(error);
		}
	}

	private onUnload(callback: () => void): void {
		callback();
	}
}
if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new MgSaic(options);
} else {
	// otherwise start the instance directly
	(() => new MgSaic())();
}
