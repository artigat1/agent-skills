#!/usr/bin/env node
// Upsert a system-recap block into a PR description without touching any
// text outside the markers. Usage:
//   node upsert-recap-block.mjs <pr-number> <block-file>
// The block file must start with the start marker and end with the end
// marker. Requires the `gh` CLI to be authenticated.
//
// Vendored from kentcdodds/kcd-skills (MIT, (c) 2026 Kent C. Dodds):
// https://github.com/kentcdodds/kcd-skills/tree/main/skills/visual-recap
// Two fixes on top of upstream:
// 1. The re-run path leaked a trailing newline per invocation (see the
//    comment on nextBody below). Verified against a live PR — upstream grew
//    the description by one blank line on every upsert.
// 2. The block now goes at the TOP of the description (and an existing block
//    is moved there on update), not appended at the end. Appending displaced
//    any trailing git trailer paragraph (e.g. the aggregated `Agent-usage:`
//    trailer), whose tooling strips stale copies with `git interpret-trailers`
//    — which only reads the FINAL paragraph. Every squash commit whose PR body
//    carried an appended recap block landed with duplicated trailers (18/18 on
//    the repo where this was diagnosed). Prepending keeps the trailer last and
//    puts the recap where it is read first. (Steve, 10 Aug 2026.)
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

// The block always ends up as the FIRST paragraph: on update the old block is
// sliced out (stitching its neighbours back with one blank line) and the new
// block is prepended, so a block that predates this fix migrates to the top.
// Text outside the markers is preserved verbatim apart from that stitch.
//
// `gh --jq .body` appends a trailing newline of its own — without the final
// trimEnd() it compounds by one on every re-run, slowly padding the
// description with blank lines. Normalising to exactly one trailing newline
// makes repeated upserts idempotent.
const rest = hasExistingBlock
	? (
			body.slice(0, startIndex).trimEnd() +
			'\n\n' +
			body.slice(endIndex + endMarker.length).trimStart()
		).trim()
	: body.trim()
const nextBody = (rest ? `${block}\n\n${rest}` : block).trimEnd() + '\n'

execFileSync('gh', ['pr', 'edit', prNumber, '--body-file', '-'], {
	input: nextBody,
})

console.log(
	hasExistingBlock
		? `updated system-recap block on PR #${prNumber}`
		: `added system-recap block to PR #${prNumber}`,
)
