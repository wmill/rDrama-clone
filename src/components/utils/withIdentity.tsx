import type React from "react";

export function withIdentity<P>(
	Wrapped: React.ComponentType<P>,
	selectKey: (props: P) => React.Key,
) {
	function WithIdentity(props: P) {
		return (
			<div>
				<Wrapped key={selectKey(props)} {...props} />
			</div>
		);
	}

	WithIdentity.displayName = `withKeyedReset(${
		Wrapped.displayName || Wrapped.name || "Component"
	})`;

	return WithIdentity;
}
