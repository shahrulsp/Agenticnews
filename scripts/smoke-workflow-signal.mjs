import fs from 'node:fs';
import path from 'node:path';

function parseDotEnv(filePath) {
	if (!fs.existsSync(filePath)) {
		return {};
	}

	const content = fs.readFileSync(filePath, 'utf8');
	const values = {};

	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();

		if (!line || line.startsWith('#')) {
			continue;
		}

		const separatorIndex = line.indexOf('=');

		if (separatorIndex === -1) {
			continue;
		}

		const key = line.slice(0, separatorIndex).trim();
		let value = line.slice(separatorIndex + 1).trim();

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		value = value.replace(/\\\$/g, '$');
		values[key] = value;
	}

	return values;
}

function parseArgs(argv) {
	const options = {};

	for (let index = 0; index < argv.length; index += 1) {
		const entry = argv[index];

		if (!entry.startsWith('--')) {
			continue;
		}

		const key = entry.slice(2);
		const value = argv[index + 1];

		if (!value || value.startsWith('--')) {
			options[key] = 'true';
			continue;
		}

		options[key] = value;
		index += 1;
	}

	return options;
}

function printUsage() {
	console.log(`Usage:
  npm run smoke:workflow -- --execution-id <id> --slug <slug> --status <approved|rejected> [--reason <text>]

Examples:
  npm run smoke:workflow -- --execution-id wf-execution-live-smoke-001 --slug live-mistral-smoke-test --status approved
  npm run smoke:workflow -- --execution-id wf-execution-live-smoke-001 --slug live-mistral-smoke-test --status rejected --reason "Needs manual follow-up"
`);
}

const args = parseArgs(process.argv.slice(2));
const executionId = args['execution-id'];
const articleSlug = args.slug;
const status = args.status;
const reason = args.reason;

if (!executionId || !articleSlug || (status !== 'approved' && status !== 'rejected')) {
	printUsage();
	process.exit(1);
}

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const envFileValues = parseDotEnv(path.join(projectRoot, '.env'));
const apiKey = process.env.MISTRAL_API_KEY ?? envFileValues.MISTRAL_API_KEY;
const signalName =
	process.env.MISTRAL_SIGNAL_NAME ?? envFileValues.MISTRAL_SIGNAL_NAME ?? 'human_approval';

if (!apiKey) {
	console.error('MISTRAL_API_KEY is missing. Add it to .env or pass it via the environment.');
	process.exit(1);
}

const response = await fetch(
	`https://api.mistral.ai/v1/workflows/executions/${executionId}/signals`,
	{
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			Accept: 'application/json',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			name: signalName,
			input: {
				article_slug: articleSlug,
				status,
				...(reason ? { reason } : {})
			}
		})
	}
);

const responseText = await response.text();

console.log(`Signal: ${signalName}`);
console.log(`Execution: ${executionId}`);
console.log(`Status: ${response.status}`);

if (responseText.trim()) {
	console.log(responseText);
}

if (!response.ok) {
	process.exit(1);
}
