#!/usr/bin/env node
/**
 * generate-viewer.mjs — domain-model.json から成果物を生成する。
 *
 * Usage:
 *   node generate-viewer.mjs <domain-model.json> [--out-dir .] [--template <viewer.html>]
 *
 * 出力:
 *   <name>-domain-viewer.html  … 自己完結のインタラクティブビューア（モデル埋め込み済み・オフラインで開ける）
 *   <name>-domain-diagram.md   … Mermaid 図（GitHub PR / Issue にそのまま貼れる）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
let modelFile = null
let outDir = '.'
let templateFile = path.join(here, '..', 'templates', 'viewer.html')
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out-dir') outDir = args[++i]
  else if (args[i] === '--template') templateFile = args[++i]
  else modelFile = args[i]
}
if (!modelFile) {
  console.error('Usage: node generate-viewer.mjs <domain-model.json> [--out-dir dir] [--template viewer.html]')
  process.exit(1)
}

const model = JSON.parse(fs.readFileSync(modelFile, 'utf8'))
fs.mkdirSync(outDir, { recursive: true })

// ---------- ビューア HTML（モデル埋め込み） ----------
const template = fs.readFileSync(templateFile, 'utf8')
// </script> によるタグ早期終了を防ぐ
const json = JSON.stringify(model).replace(/<\//g, '<\\/')
const html = template.replace('/*__DOMAIN_MODEL__*/null', json)
const htmlPath = path.join(outDir, `${model.name}-domain-viewer.html`)
fs.writeFileSync(htmlPath, html)

// ---------- Mermaid markdown ----------
const LAYER_ORDER = ['presentation', 'application', 'domain', 'infrastructure', 'di', 'other']
const LAYER_LABELS = { presentation: 'Presentation (UI)', application: 'Application', domain: 'Domain', infrastructure: 'Infrastructure', di: 'DI / Composition', other: 'Other' }
const mmId = name => name.replace(/[^A-Za-z0-9_]/g, '_')
const byName = id => id.split('#')[1]

const mainNodes = model.nodes.filter(n => n.kind !== 'support-type')
const mainIds = new Set(mainNodes.map(n => n.id))
const mainEdges = model.edges.filter(e => mainIds.has(e.from) && mainIds.has(e.to))

// レイヤー依存図（has は import と重複しがちなので import / implements のみ）
const flowLines = ['```mermaid', 'flowchart LR']
for (const layer of LAYER_ORDER) {
  const ln = mainNodes.filter(n => n.layer === layer)
  if (ln.length === 0) continue
  flowLines.push(`  subgraph ${layer}["${LAYER_LABELS[layer] ?? layer}"]`)
  const byCtx = new Map()
  for (const n of ln) {
    const c = n.context ?? ''
    if (!byCtx.has(c)) byCtx.set(c, [])
    byCtx.get(c).push(n)
  }
  for (const [ctx, cn] of [...byCtx.entries()].sort()) {
    if (ctx) flowLines.push(`    subgraph ${layer}_${mmId(ctx)}["${ctx}"]`)
    for (const n of cn) flowLines.push(`    ${ctx ? '  ' : ''}${mmId(n.name)}["${n.name}"]`)
    if (ctx) flowLines.push('    end')
  }
  flowLines.push('  end')
}
const seen = new Set()
for (const e of mainEdges) {
  if (e.kind === 'has') continue
  const key = `${byName(e.from)}->${byName(e.to)}`
  if (seen.has(key)) continue
  seen.add(key)
  const arrow = e.kind === 'implements' ? '-.->|implements|' : '-->'
  flowLines.push(`  ${mmId(byName(e.from))} ${arrow} ${mmId(byName(e.to))}`)
}
flowLines.push('```')

// ドメインモデル図（domain レイヤーのみ・プロパティ付き classDiagram）
const domainNodes = mainNodes.filter(n => n.layer === 'domain')
const domainIds = new Set(domainNodes.map(n => n.id))
const classLines = ['```mermaid', 'classDiagram']
for (const n of domainNodes) {
  classLines.push(`  class ${mmId(n.name)} {`)
  classLines.push(`    <<${n.kind}>>`)
  for (const p of n.props.filter(p => !p.method).slice(0, 10)) {
    classLines.push(`    +${p.type.replace(/[^A-Za-z0-9_\[\] |]/g, '')} ${p.name}`)
  }
  for (const m of (n.methods ?? []).slice(0, 10)) classLines.push(`    +${m}()`)
  classLines.push('  }')
}
const seenC = new Set()
for (const e of model.edges) {
  if (!domainIds.has(e.from) || !domainIds.has(e.to)) continue
  const key = `${byName(e.from)}->${byName(e.to)}:${e.kind}`
  if (seenC.has(key)) continue
  seenC.add(key)
  if (e.kind === 'import' && model.edges.some(o => o.kind === 'has' && o.from === e.from && o.to === e.to)) continue
  const arrow = e.kind === 'implements' ? '..|>' : e.kind === 'has' ? '-->' : '..>'
  classLines.push(`  ${mmId(byName(e.from))} ${arrow} ${mmId(byName(e.to))}${e.label ? ` : ${e.label}` : ''}`)
}
classLines.push('```')

const md = `# ${model.name} — ドメイン構成図

> 自動生成: \`analyze.mjs\` による TypeScript AST 解析（${model.nodes.length} nodes / ${model.edges.length} edges）
> インタラクティブ版: \`${path.basename(htmlPath)}\` をブラウザで開く

## レイヤー構成と依存関係

${flowLines.join('\n')}

## ドメインモデル

${classLines.join('\n')}
`
const mdPath = path.join(outDir, `${model.name}-domain-diagram.md`)
fs.writeFileSync(mdPath, md)

console.log(`✔ ${htmlPath}`)
console.log(`✔ ${mdPath}`)
