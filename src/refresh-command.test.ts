import { expect } from 'chai';
import { isRefreshCommand } from './refresh-command';

describe('isRefreshCommand', () => {
	const namespace = 'mg-saic.0';

	it('accepts only the unacknowledged true state on this adapter instance', () => {
		expect(
			isRefreshCommand(`${namespace}.commands.refresh`, namespace, { val: true, ack: false } as ioBroker.State),
		).to.equal(true);
		expect(
			isRefreshCommand('mg-saic.1.commands.refresh', namespace, { val: true, ack: false } as ioBroker.State),
		).to.equal(false);
		expect(
			isRefreshCommand(`${namespace}.commands.refresh`, namespace, { val: true, ack: true } as ioBroker.State),
		).to.equal(false);
		expect(
			isRefreshCommand(`${namespace}.commands.refresh`, namespace, { val: false, ack: false } as ioBroker.State),
		).to.equal(false);
		expect(isRefreshCommand(`${namespace}.commands.refresh`, namespace, null)).to.equal(false);
	});
});
