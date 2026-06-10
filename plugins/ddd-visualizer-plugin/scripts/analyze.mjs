#!/usr/bin/env node
/**
 * analyze.mjs — TypeScript AST からドメイン構成モデル (JSON) を抽出する。
 *
 * Usage:
 *   node analyze.mjs <srcDir> [moreSrcDirs...] [--out domain-model.json] [--name <projectName>] [--config <ddd-viz.config.json>]
 *
 * 対象プロジェクトの node_modules/typescript を解決して使う（プロジェクト側の TS バージョンに追従）。
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

// ---------- CLI ----------
const args = process.argv.slice(2)
const srcDirs = []
let outFile = 'domain-model.json'
let projectName = null
let configFile = null
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') outFile = args[++i]
  else if (args[i] === '--name') projectName = args[++i]
  else if (args[i] === '--config') configFile = args[++i]
  else srcDirs.push(path.resolve(args[i]))
}
if (srcDirs.length === 0) {
  console.error('Usage: node analyze.mjs <srcDir> [moreSrcDirs...] [--out file] [--name name] [--config file]')
  process.exit(1)
}

const config = configFile
  ? JSON.parse(fs.readFileSync(configFile, 'utf8'))
  : {}
const excludePatterns = ['node_modules', '.d.ts', '.test.', '.spec.', '__tests__', '/dist/', '/build/', ...(config.exclude ?? [])]
const layerHints = {
  domain: 'domain',
  application: 'application',
  usecases: 'application',
  'use-cases': 'application',
  infrastructure: 'infrastructure',
  infra: 'infrastructure',
  presentation: 'presentation',
  ui: 'presentation',
  components: 'presentation',
  pages: 'presentation',
  views: 'presentation',
  hooks: 'presentation',
  di: 'di',
  ...(config.layerHints ?? {}),
}

// ---------- TypeScript の解決 ----------
async function loadTypescript() {
  for (const dir of [...srcDirs, process.cwd()]) {
    try {
      return createRequire(path.join(dir, '__resolve__.js'))('typescript')
    } catch { /* try next */ }
  }
  try {
    return (await import('typescript')).default
  } catch {
    console.error('typescript が見つかりません。対象プロジェクトに typescript をインストールしてください。')
    process.exit(1)
  }
}
const ts = await loadTypescript()

// ---------- ファイル収集 ----------
function collectFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    const posix = full.split(path.sep).join('/')
    if (excludePatterns.some(p => posix.includes(p))) continue
    if (entry.isDirectory()) collectFiles(full, acc)
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) acc.push(full)
  }
  return acc
}
const files = srcDirs.flatMap(d => collectFiles(d))
const rootDir = srcDirs.length === 1 ? srcDirs[0] : path.dirname(srcDirs[0])
const rel = f => path.relative(rootDir, f).split(path.sep).join('/')

// ---------- レイヤー / コンテキスト / 種別の判定 ----------
function classifyLayer(relPath) {
  const segs = relPath.split('/')
  for (const seg of segs) {
    if (layerHints[seg]) return { layer: layerHints[seg], layerSeg: seg }
  }
  return { layer: 'other', layerSeg: null }
}
function classifyContext(relPath, layerSeg) {
  const segs = relPath.split('/')
  const i = layerSeg ? segs.indexOf(layerSeg) : -1
  if (i >= 0 && i + 1 < segs.length - 1) {
    const next = segs[i + 1]
    // value-objects 等の種別ディレクトリ直下ならコンテキストなし
    if (!/^(value-objects|entities|aggregates|events|services|api|http|hooks|components|pages|views|shared)$/.test(next)) return next
  }
  return null
}
function classifyKind({ relPath, layer, name, isBrand, isInterface, fileName }) {
  const p = relPath
  // Props / Params / Input / Result 等は主概念の補助型として扱う
  if (!isBrand && /(Props|Params|Input|Output|Result|Error|Config|Options)$/.test(name)) return 'support-type'
  if (layer === 'domain') {
    if (p.includes('value-objects/') || fileName.endsWith('.vo.ts') || isBrand) return 'value-object'
    if (p.includes('entities/') || fileName.endsWith('.entity.ts')) return 'entity'
    if (p.includes('aggregates/') || fileName.endsWith('.aggregate.ts')) return 'aggregate'
    if (p.includes('events/') || fileName.endsWith('.event.ts')) return 'domain-event'
    if (p.includes('services/') || fileName.endsWith('.service.ts')) return 'domain-service'
    if (/^I[A-Z].*Repository$/.test(name) || /^i-.*\.repository\.ts$/.test(fileName)) return 'repository-interface'
    return 'domain-type'
  }
  if (layer === 'application') {
    if (/UseCase$/.test(name) || p.includes('usecases/') || p.includes('use-cases/')) return 'use-case'
    return 'application-service'
  }
  if (layer === 'infrastructure') {
    if (/Repository$/.test(name) && !isInterface) return 'repository-impl'
    if (/(Api|Client|Http|Fetch)/.test(name)) return 'api-client'
    return 'infrastructure'
  }
  if (layer === 'presentation') {
    if (/^use[A-Z]/.test(name)) return 'hook'
    if (fileName.endsWith('.tsx')) return 'component'
    return 'presentation'
  }
  if (layer === 'di') return 'di'
  return 'module'
}

// ---------- AST 抽出 ----------
function isExported(node) {
  return node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
}
function typeText(node, src) {
  return node ? node.getText(src).replace(/\s+/g, ' ') : 'unknown'
}
function literalMembers(typeNode, src) {
  // union of string literals → メンバーリスト
  if (!ts.isUnionTypeNode(typeNode)) return null
  const members = []
  for (const t of typeNode.types) {
    if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) members.push(t.literal.text)
    else return null
  }
  return members
}
function detectBrand(typeNode) {
  // X & { readonly _brand: '...' } 形式の検出
  if (!ts.isIntersectionTypeNode(typeNode)) return false
  return typeNode.types.some(
    t => ts.isTypeLiteralNode(t) && t.members.some(m => m.name && m.name.getText() === '_brand'),
  )
}
function extractProps(typeNode, src, acc = []) {
  if (ts.isTypeLiteralNode(typeNode) || ts.isInterfaceDeclaration(typeNode)) {
    for (const m of typeNode.members) {
      if ((ts.isPropertySignature(m) || ts.isMethodSignature(m)) && m.name) {
        const name = m.name.getText(src)
        if (name === '_brand') continue
        if (ts.isMethodSignature(m) || (m.type && ts.isFunctionTypeNode(m.type))) {
          acc.push({ name, type: typeText(m.type, src), optional: !!m.questionToken, method: true })
        } else {
          acc.push({ name, type: typeText(m.type, src), optional: !!m.questionToken, method: false })
        }
      }
    }
  } else if (ts.isIntersectionTypeNode(typeNode)) {
    for (const t of typeNode.types) extractProps(t, src, acc)
  }
  return acc
}

const fileInfos = new Map() // relPath -> { imports: [{specifier, resolved, names}], exports: Map(name -> data) }

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null
  const base = path.resolve(path.dirname(fromFile), specifier)
  for (const cand of [base, base.replace(/\.(js|ts|tsx)$/, '') + '.ts', base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand
  }
  // .ts 拡張子付き import ("./Todo.ts")
  if (/\.ts$/.test(base) && fs.existsSync(base)) return base
  return null
}

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const info = { imports: [], exports: new Map() }
  fileInfos.set(rel(file), info)

  for (const stmt of src.statements) {
    // import 文
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const resolved = resolveImport(file, stmt.moduleSpecifier.text)
      const names = []
      const clause = stmt.importClause
      if (clause) {
        if (clause.name) names.push(clause.name.text)
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const el of clause.namedBindings.elements) names.push(el.name.text)
        }
      }
      info.imports.push({ specifier: stmt.moduleSpecifier.text, resolved: resolved ? rel(resolved) : null, names })
      continue
    }
    if (!isExported(stmt)) continue

    // export type Foo = ...
    if (ts.isTypeAliasDeclaration(stmt)) {
      const name = stmt.name.text
      const ex = info.exports.get(name) ?? { name, forms: [] }
      ex.forms.push('type')
      ex.brand = detectBrand(stmt.type)
      ex.unionMembers = literalMembers(stmt.type, src)
      if (ts.isUnionTypeNode(stmt.type) && !ex.unionMembers) {
        ex.unionOf = stmt.type.types.map(t => typeText(t, src))
      }
      const props = extractProps(stmt.type, src)
      if (props.length > 0) ex.props = props
      info.exports.set(name, ex)
    }
    // export interface IFoo { ... }
    else if (ts.isInterfaceDeclaration(stmt)) {
      const name = stmt.name.text
      const ex = info.exports.get(name) ?? { name, forms: [] }
      ex.forms.push('interface')
      const props = extractProps(stmt, src)
      ex.methods = props.filter(p => p.method).map(p => p.name)
      const dataProps = props.filter(p => !p.method)
      if (dataProps.length > 0) ex.props = dataProps
      info.exports.set(name, ex)
    }
    // export const Foo = { ... } (companion object)
    else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue
        const name = decl.name.text
        const ex = info.exports.get(name) ?? { name, forms: [] }
        ex.forms.push('const')
        if (decl.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
          ex.methods = decl.initializer.properties
            .map(p => p.name?.getText(src))
            .filter(Boolean)
        }
        info.exports.set(name, ex)
      }
    }
    // export function / export class（インフラ・UI 層で出現しうる）
    else if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      const name = stmt.name.text
      const ex = info.exports.get(name) ?? { name, forms: [] }
      ex.forms.push('function')
      info.exports.set(name, ex)
    } else if (ts.isClassDeclaration(stmt) && stmt.name) {
      const name = stmt.name.text
      const ex = info.exports.get(name) ?? { name, forms: [] }
      ex.forms.push('class')
      ex.methods = stmt.members
        .filter(m => ts.isMethodDeclaration(m) && m.name)
        .map(m => m.name.getText(src))
      ex.implements = (stmt.heritageClauses ?? [])
        .filter(h => h.token === ts.SyntaxKind.ImplementsKeyword)
        .flatMap(h => h.types.map(t => t.expression.getText(src)))
      info.exports.set(name, ex)
    }
  }
}

// ---------- ノード構築 ----------
const nodes = []
const nodeByName = new Map() // exportName -> node（最後勝ちだが通常ユニーク）
const nodeById = new Map()

for (const [relPath, info] of fileInfos) {
  const fileName = path.basename(relPath)
  const { layer, layerSeg } = classifyLayer(relPath)
  const context = classifyContext(relPath, layerSeg)
  for (const ex of info.exports.values()) {
    const kind = classifyKind({
      relPath, layer, name: ex.name,
      isBrand: !!ex.brand,
      isInterface: ex.forms.includes('interface'),
      fileName,
    })
    const node = {
      id: `${relPath}#${ex.name}`,
      name: ex.name,
      kind, layer,
      context: context ?? inferContextFromName(ex.name),
      file: relPath,
      forms: [...new Set(ex.forms)],
      brand: !!ex.brand,
      unionMembers: ex.unionMembers ?? null,
      unionOf: ex.unionOf ?? null,
      props: ex.props ?? [],
      methods: ex.methods ?? [],
      implements: ex.implements ?? [],
    }
    nodes.push(node)
    nodeById.set(node.id, node)
    nodeByName.set(ex.name, node)
  }
}

function inferContextFromName(_name) { return null }

// ファイルの代表ノード（ファイル名と一致する export を優先）
function primaryNode(relPath) {
  const info = fileInfos.get(relPath)
  if (!info) return null
  const base = path.basename(relPath).replace(/\.(vo|entity|aggregate|event|service|repository)?\.(ts|tsx)$/, '').replace(/^i-/, 'i')
  const norm = s => s.toLowerCase().replace(/[-_]/g, '')
  let best = null
  for (const ex of info.exports.keys()) {
    if (norm(ex) === norm(base) || norm(ex) === norm(base.replace(/^i/, 'i'))) { best = ex; break }
    if (!best) best = ex
  }
  return best ? nodeById.get(`${relPath}#${best}`) : null
}

// ---------- エッジ構築 ----------
const edges = []
const edgeSeen = new Set()
function addEdge(from, to, kind, label = null) {
  if (!from || !to || from.id === to.id) return
  const key = `${from.id}->${to.id}:${kind}`
  if (edgeSeen.has(key)) return
  edgeSeen.add(key)
  edges.push({ from: from.id, to: to.id, kind, label })
}

for (const [relPath, info] of fileInfos) {
  const fromNode = primaryNode(relPath)
  // import エッジ
  for (const imp of info.imports) {
    if (!imp.resolved || !fileInfos.has(imp.resolved)) continue
    for (const name of imp.names) {
      const target = nodeById.get(`${imp.resolved}#${name}`)
      if (target) addEdge(fromNode, target, 'import')
    }
    if (imp.names.length === 0) addEdge(fromNode, primaryNode(imp.resolved), 'import')
  }
  // has エッジ（プロパティ型 → 既知ノード）と implements エッジ
  for (const ex of info.exports.values()) {
    const node = nodeById.get(`${relPath}#${ex.name}`)
    for (const prop of ex.props ?? []) {
      for (const word of (prop.type.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [])) {
        const target = nodeByName.get(word)
        if (target && target.id !== node.id) addEdge(node, target, 'has', prop.name)
      }
    }
    for (const iface of ex.implements ?? []) {
      const target = nodeByName.get(iface)
      if (target) addEdge(node, target, 'implements')
    }
    // union メンバー（type Foo = A | B）→ has エッジ
    for (const member of ex.unionOf ?? []) {
      const target = nodeByName.get(member.trim())
      if (target && node && target.id !== node.id) addEdge(node, target, 'has', 'variant')
    }
  }
}

// ---------- 出力 ----------
const LAYER_ORDER = ['presentation', 'application', 'domain', 'infrastructure', 'di', 'other']
const model = {
  name: projectName ?? path.basename(rootDir),
  root: rootDir,
  layers: LAYER_ORDER.filter(l => nodes.some(n => n.layer === l)),
  contexts: [...new Set(nodes.map(n => n.context).filter(Boolean))].sort(),
  nodes: nodes.sort((a, b) => a.id.localeCompare(b.id)),
  edges: edges.sort((a, b) => (a.from + a.to).localeCompare(b.from + b.to)),
}

fs.writeFileSync(outFile, JSON.stringify(model, null, 2))
console.log(`✔ ${model.nodes.length} nodes, ${model.edges.length} edges → ${outFile}`)
console.log(`  layers: ${model.layers.join(', ')}`)
console.log(`  contexts: ${model.contexts.join(', ') || '(none)'}`)
