import net from "node:net";

import "@/lib/env.server";

type SendMailOptions = {
	to: string;
	subject: string;
	html: string;
	text?: string;
};

function getEnvelopeAddress(value: string): string {
	const match = value.match(/<([^>]+)>/);
	return match?.[1]?.trim() || value.trim();
}

function getRequiredEnv(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`${name} is not set`);
	}
	return value;
}

function formatSmtpLines(value: string): string {
	return value
		.replace(/\r?\n/g, "\r\n")
		.split("\r\n")
		.map((line) => (line.startsWith(".") ? `.${line}` : line))
		.join("\r\n");
}

function stripHtml(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(p|div|h1|h2|h3|li)>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function isCompleteSmtpResponse(buffer: string): boolean {
	if (!buffer.endsWith("\r\n")) {
		return false;
	}

	const lines = buffer.split("\r\n").filter(Boolean);
	if (lines.length === 0) {
		return false;
	}

	const lastLine = lines[lines.length - 1];
	return /^\d{3} /.test(lastLine);
}

async function readSmtpResponse(socket: net.Socket): Promise<string> {
	return new Promise((resolve, reject) => {
		let buffer = "";

		const cleanup = () => {
			socket.off("data", onData);
			socket.off("error", onError);
			socket.off("close", onClose);
		};

		const onData = (chunk: Buffer) => {
			buffer += chunk.toString("utf8");
			if (isCompleteSmtpResponse(buffer)) {
				cleanup();
				resolve(buffer);
			}
		};

		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};

		const onClose = () => {
			cleanup();
			reject(new Error("SMTP connection closed unexpectedly"));
		};

		socket.on("data", onData);
		socket.on("error", onError);
		socket.on("close", onClose);
	});
}

async function sendSmtpCommand(
	socket: net.Socket,
	command: string,
	expectedCode: number,
): Promise<void> {
	socket.write(`${command}\r\n`);
	const response = await readSmtpResponse(socket);

	if (!response.startsWith(String(expectedCode))) {
		throw new Error(
			`SMTP command failed (${command}): ${response.replace(/\r\n/g, " ").trim()}`,
		);
	}
}

export async function sendMail({
	to,
	subject,
	html,
	text,
}: SendMailOptions): Promise<void> {
	const host = getRequiredEnv("SMTP_HOST");
	const port = Number.parseInt(getRequiredEnv("SMTP_PORT"), 10);
	const from = getRequiredEnv("SMTP_FROM");
	const envelopeFrom = getEnvelopeAddress(from);

	if (Number.isNaN(port)) {
		throw new Error("SMTP_PORT must be a valid integer");
	}

	const messageText = formatSmtpLines(text ?? stripHtml(html));
	const messageHtml = formatSmtpLines(html);

	const socket = net.createConnection({ host, port });

	await new Promise<void>((resolve, reject) => {
		socket.once("connect", () => resolve());
		socket.once("error", reject);
	});

	try {
		const greeting = await readSmtpResponse(socket);
		if (!greeting.startsWith("220")) {
			throw new Error(
				`SMTP greeting failed: ${greeting.replace(/\r\n/g, " ").trim()}`,
			);
		}

		await sendSmtpCommand(socket, "EHLO localhost", 250);
		await sendSmtpCommand(socket, `MAIL FROM:<${envelopeFrom}>`, 250);
		await sendSmtpCommand(socket, `RCPT TO:<${to}>`, 250);
		await sendSmtpCommand(socket, "DATA", 354);

		const boundary = `codex-${Date.now().toString(16)}`;
		const message = [
			`From: ${from}`,
			`To: ${to}`,
			`Subject: ${subject}`,
			"MIME-Version: 1.0",
			`Content-Type: multipart/alternative; boundary="${boundary}"`,
			"",
			`--${boundary}`,
			'Content-Type: text/plain; charset="UTF-8"',
			"",
			messageText,
			"",
			`--${boundary}`,
			'Content-Type: text/html; charset="UTF-8"',
			"",
			messageHtml,
			"",
			`--${boundary}--`,
			"",
			".",
			"",
		].join("\r\n");

		socket.write(message);
		const queuedResponse = await readSmtpResponse(socket);
		if (!queuedResponse.startsWith("250")) {
			throw new Error(
				`SMTP DATA failed: ${queuedResponse.replace(/\r\n/g, " ").trim()}`,
			);
		}

		await sendSmtpCommand(socket, "QUIT", 221);
	} finally {
		socket.end();
	}
}
