/** Global SAIC API route configuration for supported account regions. */
export interface SaicRegionConfig {
	/** Regional API base URL. */
	baseUrl: string;
	/** Region code sent in request headers. */
	regionCode: string;
	/** Tenant identifier used to sign requests. */
	tenantId: string;
}

const regions: Record<string, SaicRegionConfig> = {
	EU: {
		baseUrl: 'https://gateway-mg-eu.soimt.com/api.app/v1/',
		regionCode: 'eu',
		tenantId: '459771',
	},
	China: {
		baseUrl: 'https://tap-cn.soimt.com/api.app/v1/',
		regionCode: 'cn',
		tenantId: '459771',
	},
	Australia: {
		baseUrl: 'https://gateway-mg-au.soimt.com/api.app/v1/',
		regionCode: 'au',
		tenantId: '459771',
	},
	Brazil: {
		baseUrl: 'https://gateway-mg-br.soimt.com/api.app/v1/',
		regionCode: 'br',
		tenantId: '459771',
	},
	Israel: {
		baseUrl: 'https://gateway-mg-il.soimt.com/api.app/v1/',
		regionCode: 'il',
		tenantId: '459771',
	},
	Turkey: {
		baseUrl: 'https://gateway-mg-tr.soimt.com/api.app/v1/',
		regionCode: 'tr',
		tenantId: '459771',
	},
	Thailand: {
		baseUrl: 'https://gateway-mg-th.soimt.com/api.app/v1/',
		regionCode: 'th',
		tenantId: '459771',
	},
	'Rest of World': {
		baseUrl: 'https://gateway-mg-eu.soimt.com/api.app/v1/',
		regionCode: 'eu',
		tenantId: '459771',
	},
};

/**
 * Resolve a configured region to its global SAIC API route, if supported.
 *
 * @param region User-configured region name.
 */
export function resolveSaicRegion(region: string): SaicRegionConfig | undefined {
	return regions[region.trim()];
}

/**
 * Determine whether the configured region requires India's separate TAP backend.
 *
 * @param region User-configured region name.
 */
export function isIndiaRegion(region: string): boolean {
	return region.trim().toLowerCase() === 'india';
}
