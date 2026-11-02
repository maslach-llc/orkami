// The release check, the last step of `npm run verify`: what `npm pack` would ship is the
// library and nothing else (no playground, tests, docs, plan or seed files), every `exports`
// entry resolves to a file in the build, and the version in package.json has its section in
// CHANGELOG.md. Run after the build; exits 1 with every problem listed.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const problems = []

// 1. The pack list
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const [packed] = JSON.parse(execFileSync(npm, ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
const files = packed.files.map(f => f.path)
const stray = /^(playground|seed|test|docs|todos|scripts|node_modules)\/|^\.|\.test\.|\.log$|\.env/
for (const f of files) if (stray.test(f)) problems.push(`npm pack would ship ${f}`)
for (const need of ['package.json', 'README.md', 'LICENSE', 'NOTICE.md', 'dist/index.js', 'dist/index.d.ts']) {
  if (!files.includes(need)) problems.push(`npm pack would not ship ${need}`)
}

// 2. Every exports entry resolves in the build
const targets = (v) => typeof v === 'string' ? [v] : Object.values(v).flatMap(targets)
for (const [entry, v] of Object.entries(pkg.exports)) {
  for (const t of targets(v)) {
    if (!existsSync(join(root, t))) problems.push(`exports["${entry}"] points at ${t}, which does not exist (build first)`)
    else if (!files.includes(t.replace(/^\.\//, ''))) problems.push(`exports["${entry}"] points at ${t}, which npm pack would not ship`)
  }
}
for (const field of ['main', 'types']) {
  if (pkg[field] && !files.includes(pkg[field].replace(/^\.\//, ''))) problems.push(`"${field}": ${pkg[field]} would not ship`)
}

// 3. The changelog has the version
const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')
if (!new RegExp(`^## \\[${pkg.version.replace(/\./g, '\\.')}\\]`, 'm').test(changelog)) problems.push(`CHANGELOG.md has no "## [${pkg.version}]" section`)

if (problems.length) {
  console.error(`release check: ${problems.length} problem(s)\n` + problems.map(p => `- ${p}`).join('\n'))
  process.exit(1)
}
console.log(`release check: ${files.length} files, ${Object.keys(pkg.exports).length} exports resolve, CHANGELOG has ${pkg.version}`)
