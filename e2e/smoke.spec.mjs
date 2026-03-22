import { expect, test } from "@playwright/test";

test("home and login routes render for anonymous user", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
	await expect(page.getByText("Not logged in")).toBeVisible();

	await page.goto("/login");
	await expect(page.getByText("Welcome back")).toBeVisible();
	await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("authenticated user sees profile link and can open profile pages", async ({
	page,
}) => {
	const username = process.env.E2E_USERNAME;
	const password = process.env.E2E_PASSWORD;

	test.skip(
		!username || !password,
		"Set E2E_USERNAME and E2E_PASSWORD to run auth/profile flow.",
	);

	await page.goto("/login");
	await page.getByLabel("Username or Email").fill(username);
	await page.getByLabel("Password").fill(password);
	await page.getByRole("button", { name: "Sign in" }).click();

	await expect(page.getByRole("link", { name: username })).toBeVisible();

	await page.goto(`/u/${encodeURIComponent(username)}`);
	await expect(page.getByRole("heading", { name: /@/ })).toBeVisible();

	await page.goto(`/u/${encodeURIComponent(username)}/posts`);
	await expect(page.getByRole("heading", { name: /@/ })).toBeVisible();
});
