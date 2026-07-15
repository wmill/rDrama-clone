import type { CssNode, Rule, Selector } from "css-tree";
import { generate, parse, walk } from "css-tree";

const ALLOWED_PROPERTIES = new Set([
	"background-color",
	"border",
	"border-bottom",
	"border-bottom-color",
	"border-bottom-style",
	"border-bottom-width",
	"border-color",
	"border-left",
	"border-left-color",
	"border-left-style",
	"border-left-width",
	"border-radius",
	"border-right",
	"border-right-color",
	"border-right-style",
	"border-right-width",
	"border-style",
	"border-top",
	"border-top-color",
	"border-top-style",
	"border-top-width",
	"border-width",
	"box-shadow",
	"color",
	"font-family",
	"font-size",
	"font-style",
	"font-weight",
	"letter-spacing",
	"line-height",
	"opacity",
	"outline",
	"outline-color",
	"outline-style",
	"outline-width",
	"text-align",
	"text-decoration",
	"text-decoration-color",
	"text-decoration-line",
	"text-decoration-style",
	"text-shadow",
	"text-transform",
	"word-spacing",
]);

const ALLOWED_PSEUDO_CLASSES = new Set([
	"active",
	"checked",
	"disabled",
	"empty",
	"enabled",
	"first-child",
	"first-of-type",
	"focus",
	"focus-visible",
	"focus-within",
	"hover",
	"last-child",
	"last-of-type",
	"link",
	"nth-child",
	"nth-of-type",
	"only-child",
	"only-of-type",
	"target",
	"visited",
]);

export class ProfileCssError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ProfileCssError";
	}
}

function reject(message: string): never {
	throw new ProfileCssError(message);
}

function validateSelector(selector: Selector) {
	walk(selector, (node) => {
		if (node.type === "TypeSelector") {
			const name = node.name.toLowerCase();
			if (name === "html" || name === "body" || name === "head") {
				reject("Global selectors are not allowed");
			}
		}
		if (node.type === "PseudoElementSelector") {
			reject("Pseudo-elements are not allowed");
		}
		if (node.type === "PseudoClassSelector") {
			if (!ALLOWED_PSEUDO_CLASSES.has(node.name.toLowerCase())) {
				reject(`Pseudo-class :${node.name} is not allowed`);
			}
		}
		if (node.type === "NestingSelector") {
			reject("CSS nesting is not allowed");
		}
	});
}

function validateRule(rule: Rule) {
	if (rule.prelude?.type !== "SelectorList") {
		reject("Only selector rules are allowed");
	}
	for (const selector of rule.prelude.children) {
		validateSelector(selector as Selector);
	}

	for (const item of rule.block.children) {
		if (item.type !== "Declaration") reject("Nested rules are not allowed");
		const property = item.property.toLowerCase();
		if (property.startsWith("--")) reject("Custom properties are not allowed");
		if (!ALLOWED_PROPERTIES.has(property)) {
			reject(`Property ${property} is not allowed`);
		}
		if (item.important) reject("!important is not allowed");
		walk(item.value, (node) => {
			if (node.type === "Url") reject("Remote resources are not allowed");
			if (
				node.type === "Function" &&
				["url", "var", "env", "attr"].includes(node.name.toLowerCase())
			) {
				reject(`Function ${node.name}() is not allowed`);
			}
		});
	}
}

export function profileCssContainerClass(userId: number): string {
	if (!Number.isSafeInteger(userId) || userId <= 0) {
		throw new Error("A valid profile owner ID is required");
	}
	return `profile-owner-${userId}`;
}

export function sanitizeProfileCss(input: string, userId: number): string {
	if (!input.trim()) return "";
	let ast: CssNode;
	try {
		let parseError = false;
		ast = parse(input, {
			context: "stylesheet",
			positions: true,
			onParseError: () => {
				parseError = true;
			},
		});
		if (parseError) return reject("Malformed CSS");
	} catch {
		return reject("Malformed CSS");
	}
	if (ast.type !== "StyleSheet") return reject("Malformed CSS");

	const prefix = `.${profileCssContainerClass(userId)}`;
	const output: string[] = [];
	for (const node of ast.children) {
		if (node.type === "Atrule") reject("At-rules are not allowed");
		if (node.type !== "Rule") reject("Only style rules are allowed");
		validateRule(node);
		if (node.prelude?.type !== "SelectorList") continue;
		const selectors = [...node.prelude.children].map(
			(selector) => `${prefix} ${generate(selector)}`,
		);
		output.push(`${selectors.join(",")}{${generate(node.block).slice(1, -1)}}`);
	}
	return output.join("");
}
