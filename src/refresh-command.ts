/**
 * Return whether an event requests a refresh on this adapter instance.
 *
 * @param id Fully qualified state ID from ioBroker.
 * @param namespace Adapter instance namespace.
 * @param state State value supplied by ioBroker.
 */
export function isRefreshCommand(id: string, namespace: string, state: ioBroker.State | null | undefined): boolean {
	return (
		id === `${namespace}.commands.refresh` &&
		state !== null &&
		state !== undefined &&
		!state.ack &&
		state.val === true
	);
}
