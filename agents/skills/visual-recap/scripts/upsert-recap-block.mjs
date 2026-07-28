#!/usr/bin/env node
// Upsert a system-recap block into a PR description without touching any
// text outside the markers. Usage:
//   node upsert-recap-block.mjs <pr-number> <block-file>
// The block file must start with the start marker and end with the end
// marker. Requires the `gh` CLI to be authenticated.
//
// Vendored from kentcdodds/kcd-skills (MIT, (c) 2026 Kent C. Dodds):
// https://github.com/kentcdodds/kcd-skills/tree/main/skills/visual-recap
// One fix on top of upstream: the re-run path leaked a trailing newline per
// invocation (see the comment on nextBody below). Verified against a live PR —
// upstream grew the description by one blank line on every upsert.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const startMarker = '<!-- system-recap:start -->'
const endMarker = '<!-- system-recap:end -->'

const [prNumber, blockFile] = process.argv.slice(2)
if (!prNumber || !blockFile) {
	console.error('usage: upsert-recap-block.mjs <pr-number> <block-file>')
	process.exit(1)
}

const block = readFileSync(blockFile, 'utf8').trim()
if (!block.startsWith(startMarker) || !block.endsWith(endMarker)) {
	console.error(
		`block file must start with "${startMarker}" and end with "${endMarker}"`,
	)
	process.exit(1)
}

const body = execFileSync(
	'gh',
	['pr', 'view', prNumber, '--json', 'body', '--jq', '.body'],
	{ encoding: 'utf8' },
)

const startIndex = body.indexOf(startMarker)
const endIndex = body.indexOf(endMarker)
const hasExistingBlock =
	startIndex !== -1 && endIndex !== -1 && endIndex > startIndex

// `gh --jq .body` appends a trailing newline of its own, and the replace path
// preserves everything after the end marker verbatim — so without the final
// trimEnd() that newline compounds by one on every re-run, slowly padding the
// description with blank lines. Normalising to exactly one trailing newline
// makes repeated upserts idempotent. Only trailing whitespace at the very end
// of the description is affected; text outside the markers is untouched.
const nextBody =
	(hasExistingBlock
		? body.slice(0, startIndex) + block + body.slice(endIndex + endMarker.length)
		: `${body.trimEnd()}\n\n${block}`
	).trimEnd() + '\n'

execFileSync('gh', ['pr', 'edit', prNumber, '--body-file', '-'], {
	input: nextBody,
})

console.log(
	hasExistingBlock
		? `updated system-recap block on PR #${prNumber}`
		: `added system-recap block to PR #${prNumber}`,
)
