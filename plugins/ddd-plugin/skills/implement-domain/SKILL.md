---
description: Implement a DDD domain layer — Value Objects, Entities, Aggregates, Domain Services — using brand types and companion object pattern (no classes)
---

TypeScript の DDD ドメイン層を実装する。クラスは使用せず、ブランド型・コンパニオンオブジェクトパターンで構築する。

## ファイル命名規則

| 概念 | サフィックス | 配置ディレクトリ |
|------|-------------|----------------|
| Value Object | `.vo.ts` | `value-objects/` |
| Entity | `.entity.ts` | `entities/` |
| Aggregate | `.aggregate.ts` | `aggregates/` |
| Domain Service | `.service.ts` | `services/` |
| Repository Interface | `i-{name}.repository.ts` | ドメインルート直下 |
| Barrel export | `index.ts` | ドメインルート直下 |

ディレクトリ構造（`{context}` を bounded context 名に置換）:

```
src/domain/{context}/
  value-objects/
    {concept}-id.vo.ts
    {concept}-{field}.vo.ts
  entities/
    {concept}.entity.ts
  aggregates/
    {concept}.aggregate.ts
  services/
    {concept}-{rule}.service.ts
  i-{concept}.repository.ts
  index.ts
```

## TypeScript 設定要件

`tsconfig.json` に必須のオプション:

```json
{
  "compilerOptions": {
    "erasableSyntaxOnly": true,
    "strict": true,
    "verbatimModuleSyntax": true
  }
}
```

`erasableSyntaxOnly: true` によりコンパイラレベルでクラス宣言を禁止する。

## Value Object パターン（`.vo.ts`）

```typescript
export type FooId = string & { readonly _brand: 'FooId' }

export const FooId = {
  /** 検証あり — ユーザー入力・外部値に使う */
  of(value: string): FooId {
    if (value.trim() === '') throw new Error('FooId must not be empty')
    return value as FooId
  },
  /** 信頼できるソース（DB 等）からの復元用 */
  fromTrusted(value: string): FooId {
    return value as FooId
  },
  equals(a: FooId, b: FooId): boolean { return a === b },
  unwrap(id: FooId): string { return id },
}
```

**ルール:**
- ID 系 VO: `of` / `fromTrusted` / `equals` / `unwrap` を必ず実装
- バリデーション系 VO (Title, Name 等): `of` / `equals` / `unwrap` を実装
- 閉じた選択肢は union 型でブランド不要 (`type Status = 'active' | 'inactive'`)
- `readonly _brand` は実行時に存在しない phantom property — 型安全のみ

## Entity パターン（`.entity.ts`）

```typescript
import type { FooId } from '../value-objects/foo-id.vo.ts'
import type { FooTitle } from '../value-objects/foo-title.vo.ts'

export type Foo = {
  readonly id: FooId
  readonly title: FooTitle
  readonly completed: boolean
  readonly createdAt: Date
}

/** 新規作成用 — 派生フィールドを省略してデフォルト値を適用 */
export type FooProps = {
  readonly id: FooId
  readonly title: FooTitle
  readonly createdAt: Date
}

/** 永続化データ復元用 — 全フィールドを明示 */
export type FooReconstructProps = FooProps & {
  readonly completed: boolean
}

export const Foo = {
  /** 新規作成（completed: false 等のデフォルトを設定） */
  create(props: FooProps): Foo {
    return { ...props, completed: false }
  },
  /** 永続化されたデータから復元（全フィールドをそのまま使う） */
  reconstruct(props: FooReconstructProps): Foo {
    return { ...props }
  },
  // ドメイン操作 — 常に新オブジェクトを返す（イミュータブル）
  complete(foo: Foo): Foo { return { ...foo, completed: true } },
  uncomplete(foo: Foo): Foo { return { ...foo, completed: false } },
  changeTitle(foo: Foo, title: FooTitle): Foo { return { ...foo, title } },
  isSameAs(a: Foo, b: Foo): boolean { return a.id === b.id },
}
```

**ルール:**
- `create` と `reconstruct` を必ず分ける
- ドメイン操作は全てイミュータブル（spread で新オブジェクトを返す）
- `isSameAs` は ID による同一性比較

## Aggregate パターン（`.aggregate.ts`）

```typescript
import { Foo } from '../entities/foo.entity.ts'
import type { FooProps, FooReconstructProps } from '../entities/foo.entity.ts'
import type { FooId } from '../value-objects/foo-id.vo.ts'
import type { FooTitle } from '../value-objects/foo-title.vo.ts'

// Aggregate root が Entity と同一型の場合（最も一般的）
export type FooAggregate = Foo

export type UpdateFooAggregateParams = {
  readonly title?: FooTitle
  readonly completed?: boolean
}

export const FooAggregate = {
  create(props: FooProps): FooAggregate {
    return Foo.create(props)
  },
  reconstruct(props: FooReconstructProps): FooAggregate {
    return Foo.reconstruct(props)
  },
  applyUpdate(agg: FooAggregate, params: UpdateFooAggregateParams): FooAggregate {
    let updated = agg
    if (params.title !== undefined) updated = Foo.changeTitle(updated, params.title)
    if (params.completed !== undefined) {
      updated = params.completed ? Foo.complete(updated) : Foo.uncomplete(updated)
    }
    return updated
  },
  isSameAs(a: FooAggregate, b: FooAggregate): boolean { return Foo.isSameAs(a, b) },
  getId(agg: FooAggregate): FooId { return agg.id },
}
```

**Child entity を持つ場合（例: Plugin が Skill を子に持つ）:**

```typescript
export const FooAggregate = {
  // ...
  // 不変条件: 同一 ChildId の重複を禁止
  addChild(agg: FooAggregate, child: Child): FooAggregate {
    if (agg.children.some(c => c.id === child.id)) {
      throw new Error(`FooAggregate.addChild: duplicate id ${child.id}`)
    }
    return { ...agg, children: [...agg.children, child] }
  },
  removeChild(agg: FooAggregate, childId: ChildId): FooAggregate {
    if (!agg.children.some(c => c.id === childId)) {
      throw new Error(`FooAggregate.removeChild: not found ${childId}`)
    }
    return { ...agg, children: agg.children.filter(c => c.id !== childId) }
  },
}
```

**ルール:**
- 集約内の不変条件はここで `throw` する
- `type FooAggregate = Foo` — Entity と同一型のエイリアス（`foo.entity.ts` は別ファイル）

## Domain Service パターン（`.service.ts`）

単一集約を超えるルール（他集約の参照が必要）や、集約に自然に収まらないポリシーを担当。

```typescript
import type { FooTitle } from '../value-objects/foo-title.vo.ts'
import type { FooAggregate } from '../aggregates/foo.aggregate.ts'
import type { IFooRepository } from '../i-foo.repository.ts'

export type DomainValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string }

export const FooDomainService = {
  /** I/O あり: リポジトリへの問い合わせが必要なルール */
  async checkUniqueness(
    title: FooTitle,
    repository: IFooRepository,
  ): Promise<DomainValidationResult> {
    const existing = await repository.findByTitle(title)
    if (existing !== null) {
      return { valid: false, reason: `Title "${title}" is already taken` }
    }
    return { valid: true }
  },

  /** Pure: 集約単体では判断できないポリシー検証 */
  validateReadiness(agg: FooAggregate): DomainValidationResult {
    // 例: 公開前に必須フィールドが揃っているか確認
    return { valid: true }
  },
}
```

**ルール:**
- 依存はコンストラクタではなく**関数引数で渡す**（クラス不使用のため）
- 純粋関数と I/O 関数を明確に分ける

## Repository Interface パターン（`i-{name}.repository.ts`）

```typescript
import type { FooAggregate, UpdateFooAggregateParams } from './aggregates/foo.aggregate.ts'
import type { FooId } from './value-objects/foo-id.vo.ts'
import type { FooTitle } from './value-objects/foo-title.vo.ts'

export interface IFooRepository {
  findAll(): Promise<FooAggregate[]>
  findById(id: FooId): Promise<FooAggregate | null>    // 見つからない場合は null（throw しない）
  findByTitle(title: FooTitle): Promise<FooAggregate | null>
  create(/* VO を受け取る */): Promise<FooAggregate>
  update(id: FooId, params: UpdateFooAggregateParams): Promise<FooAggregate>
  delete(id: FooId): Promise<void>
}
```

**ルール:**
- 引数にはドメイン型（VO）を使う（プリミティブを直接受け取らない）
- 見つからない場合は `null` を返す（`throw` しない）

## 実装手順

1. TypeScript セットアップ（`package.json`, `tsconfig.json`）
2. Value Objects（相互依存なし → 全て並行作成可）
3. Entities（VO に依存）
4. Aggregates（Entity + VO に依存）
5. Repository Interface（Aggregate に依存）
6. Domain Services（Aggregate + Repository Interface に依存）
7. `index.ts` barrel export

## 禁止事項

- `class` キーワード（`erasableSyntaxOnly: true` でコンパイルエラー）
- ドメイン層からインフラ・UI へのインポート
- VO・Entity・Aggregate の直接変異（`readonly` を外す、プロパティへの直接代入）
- Repository interface の具象実装をドメイン層に置く
