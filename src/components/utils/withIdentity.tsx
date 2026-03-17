import type React from "react";

/*
** Helper function, makes the component remount when the identity result changes
** Prevents the developer from needed to reset things to defaults when the target changes
*/

export function withIdentity<P>(
	Wrapped: React.ComponentType<P>,
	selectKey: (props: P) => React.Key,
) {
	function WithIdentity(props: P) {
		return <Wrapped key={selectKey(props)} {...props} />
	}

	WithIdentity.displayName = `withKeyedReset(${
		Wrapped.displayName || Wrapped.name || "Component"
	})`;

	return WithIdentity;
}
