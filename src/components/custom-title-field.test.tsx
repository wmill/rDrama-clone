import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CustomTitleField } from "@/routes/me";

describe("CustomTitleField", () => {
	it("explains moderator locks and prevents editing", () => {
		const onChange = vi.fn();
		render(
			// biome-ignore lint/correctness/useUniqueElementIds: isolated test DOM
			<CustomTitleField
				id="custom-title"
				value="Assigned title"
				locked
				onChange={onChange}
			/>,
		);

		const input = screen.getByLabelText("Custom title");
		expect(input).toHaveProperty("disabled", true);
		expect(screen.getByText(/moderator has locked this title/i)).not.toBeNull();
		expect(onChange).not.toHaveBeenCalled();
	});

	it("restores title editing when unlocked", () => {
		const onChange = vi.fn();
		render(
			// biome-ignore lint/correctness/useUniqueElementIds: isolated test DOM
			<CustomTitleField
				id="custom-title"
				value="Current title"
				locked={false}
				onChange={onChange}
			/>,
		);

		fireEvent.change(screen.getByLabelText("Custom title"), {
			target: { value: "Replacement" },
		});
		expect(onChange).toHaveBeenCalledWith("Replacement");
		expect(screen.queryByText(/moderator has locked this title/i)).toBeNull();
	});
});
