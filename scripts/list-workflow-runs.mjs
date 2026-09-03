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

const args = parseArgs(process.argv.slice(2));
const limit = Number.parseInt(args.limit ?? '10', 10);
const status = args.status;
const workflow = args.workflow;
const search = args.search;

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const envFileValues = parseDotEnv(path.join(projectRoot, '.env'));
const apiKey = process.env.MISTRAL_API_KEY ?? envFileValues.MISTRAL_API_KEY;

if (!apiKey) {
	console.error('MISTRAL_API_KEY is missing. Add it to .env or pass it via the environment.');
	process.exit(1);
}

const query = new URLSearchParams({
	order: 'desc',
	page_size: String(Number.isNaN(limit) ? 10 : Math.min(Math.max(limit, 1), 50))
});

if (status) {
	query.set('status', status);
}

if (workflow) {
	query.set('workflow_identifier', workflow);
}

if (search) {
	query.set('search', search);
}

const response = await fetch(`https://api.mistral.ai/v1/workflows/runs?${query.toString()}`, {
	headers: {
		Authorization: `Bearer ${apiKey}`,
		Accept: 'application/json'
	}
});

const responseText = await response.text();

if (!response.ok) {
	console.error(`Status: ${response.status}`);
	if (responseText.trim()) {
		console.error(responseText);
	}
	process.exit(1);
}

const payload = JSON.parse(responseText);
const executions = Array.isArray(payload.executions) ? payload.executions : [];

if (executions.length === 0) {
	console.log('No workflow runs found for the current query.');
	process.exit(0);
}

for (const execution of executions) {
	console.log(
		[
			execution.execution_id ?? 'unknown-execution',
			execution.status ?? 'unknown-status',
			execution.workflow_name ?? execution.workflow_id ?? 'unknown-workflow',
			execution.start_time ?? 'unknown-start'
		].join(' | ')
	);
}
