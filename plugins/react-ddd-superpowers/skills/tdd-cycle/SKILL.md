---
description: Strict Red-Green-Refactor TDD with Vitest for React + TypeScript + Vite DDD projects — one failing test at a time, in-memory repository test doubles, layer-by-layer test strategy from Value Objects to components. Use for all implementation work
---

Vitest による厳格な TDD(Red → Green → Refactor)で実装する。**失敗するテストを見る前にプロダクションコードを書くことを禁止**する。

## 鉄則

1. **Red:** 失敗するテストを 1 つだけ書き、実行して**期待どおりの理由で失敗する**ことを確認する(コンパイルエラーも Red の一種)
2. **Green:** そのテストを通す**最小限**のコードを書く。先回りの実装をしない
3. **Refactor:** テストが通ったまま重複除去・命名改善。テストコード自身も対象
4. 1 サイクル = 数分。サイクルが 10 分を超えるならテストのステップが大きすぎる — 分割する
5. テストを書き換えて無理やり通すのは禁止(仕様が間違っていた場合を除く。その場合は `clarify-spec` に戻る)
6. 受け入れ条件(仕様書の Given/When/Then)1 つにつき最低 1 テスト。全条件がテストで裏付けられるまで完了としない

## セットアップ(Vite 8 + Vitest)

```bash
npm i -D vitest @testing-library/react @testing-library/user-event jsdom
```

```typescript
// vite.config.ts
/// <reference types="vitest/config" />
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',       // domain/application だけなら 'node' で十分
    globals: false,             // 明示 import を推奨(import { describe, it, expect } from 'vitest')
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

テストファイルは実装と同じディレクトリに `{name}.test.ts(x)` で置く(`todo-title.vo.ts` の隣に `todo-title.vo.test.ts`)。

## 実装順序 = 依存の内側から外側へ

依存されるものからテストを書く。各段階で下の層は完成済みなのでモック不要になる。

```
1. Value Object → 2. Entity → 3. Aggregate → 4. InMemory Repository
→ 5. Use Case → 6. Hook → 7. Component
```

## 層ごとのテスト戦略

### 1〜3. ドメイン層(純粋関数 — テストが最も安い)

```typescript
// src/domain/todo/value-objects/todo-title.vo.test.ts
import { describe, it, expect } from 'vitest'
import { TodoTitle } from './todo-title.vo.ts'

describe('TodoTitle.of', () => {
  it('前後の空白を除去して受理する', () => {
    const result = TodoTitle.of('  買い物  ')
    expect(result).toEqual({ ok: true, value: '買い物' })
  })
  it('空文字列は Empty エラー', () => {
    expect(TodoTitle.of('   ')).toEqual({ ok: false, error: { type: 'Empty' } })
  })
  it('101 文字は TooLong エラーで max と actual を含む', () => {
    const result = TodoTitle.of('あ'.repeat(101))
    expect(result).toEqual({ ok: false, error: { type: 'TooLong', max: 100, actual: 101 } })
  })
})
```

- **境界値を必ず両側テストする**(100 文字 OK / 101 文字 NG)
- Result は `toEqual` で ok/error まるごと比較 — エラーの payload も検証する
- Entity の状態遷移は「遷移できる」だけでなく「型で禁止される遷移がコンパイルエラーになる」ことを確認する。ランタイムテストでは書けないので、必要なら `@ts-expect-error` を使ったテストを書く:

```typescript
it('完了済み TODO の二重完了は型エラー', () => {
  const completed = Todo.complete(active, '2026-07-13T00:00:00Z')
  // @ts-expect-error CompletedTodo は complete に渡せない
  Todo.complete(completed, '2026-07-14T00:00:00Z')
})
```

### 4. InMemory Repository(テストダブル兼、最初の Repository 実装)

インターフェースを満たす class として実装し、**これ自体もテストする**(以後全ユースケーステストの土台になるため)。

```typescript
// src/infrastructure/todo/repositories/in-memory-todo.repository.ts
export class InMemoryTodoRepository implements ITodoRepository {
  private readonly store = new Map<string, TodoAggregate>()
  private seq = 0

  nextId(): TodoId { return TodoId.fromTrusted(`todo-${++this.seq}`) }
  async findById(id: TodoId): Promise<TodoAggregate | null> {
    return this.store.get(TodoId.unwrap(id)) ?? null
  }
  async findAll(): Promise<readonly TodoAggregate[]> { return [...this.store.values()] }
  async save(aggregate: TodoAggregate): Promise<void> {
    this.store.set(TodoId.unwrap(aggregate.id), aggregate)
  }
  async delete(id: TodoId): Promise<void> { this.store.delete(TodoId.unwrap(id)) }
}
```

- `vi.fn()` の寄せ集めモックより InMemory 実装を優先する — インターフェース変更に強く、テストが仕様を語る
- 本番用 Repository(localStorage / API)は同じテストスイートを共有できる(contract test): インターフェースのテストを関数化し、実装ごとに実行する

### 5. ユースケース(InMemory Repository + 固定 Clock を注入)

```typescript
describe('addTodo', () => {
  const fixedClock: Clock = { now: () => '2026-07-13T00:00:00Z' }

  it('有効なタイトルで TODO が保存される', async () => {
    const repo = new InMemoryTodoRepository()
    const addTodo = createAddTodoUseCase(repo, fixedClock)

    const result = await addTodo({ title: '買い物' })

    expect(result.ok).toBe(true)
    expect(await repo.findAll()).toHaveLength(1)   // 副作用(保存)まで検証する
  })
  it('空タイトルはエラーを返し保存されない', async () => {
    const repo = new InMemoryTodoRepository()
    const addTodo = createAddTodoUseCase(repo, fixedClock)

    const result = await addTodo({ title: '' })

    expect(result).toEqual({ ok: false, error: { type: 'Empty' } })
    expect(await repo.findAll()).toHaveLength(0)
  })
})
```

- 戻り値と**副作用の両方**を検証する(保存された/されなかった)
- テスト間で Repository を共有しない — 各テストで新規作成

### 6〜7. Hook・コンポーネント(Testing Library + DI 差し替え)

```tsx
// テスト用の Provider ヘルパー(src/test/render-with-deps.tsx)
export const renderWithDeps = (ui: ReactNode, overrides?: Partial<Dependencies>) => {
  const deps = { ...createTestDependencies(), ...overrides }   // InMemory で組んだ既定値
  return { ...render(<DependenciesProvider dependencies={deps}>{ui}</DependenciesProvider>), deps }
}
```

```tsx
it('タイトルを入力して追加すると一覧に表示される', async () => {
  const user = userEvent.setup()
  renderWithDeps(<TodoPage />)

  await user.type(screen.getByRole('textbox', { name: 'タイトル' }), '買い物')
  await user.click(screen.getByRole('button', { name: '追加' }))

  expect(await screen.findByText('買い物')).toBeInTheDocument()
})
```

- コンポーネントテストは**ユーザー視点**(role / label で取得、実装詳細の state を見ない)
- ここでもモックライブラリではなく DI 差し替えで動かす — アーキテクチャがテスト容易性を担保している証明になる
- コンポーネントテストは受け入れ条件レベルの粗い粒度でよい。細かいロジックは下の層で網羅済みのはず。コンポーネントテストで細かい分岐を試したくなったら、ロジックが上の層に漏れているサイン

## サイクル運用

- 実行は `npx vitest run {対象ファイル}` で対象を絞り、フェーズ完了時に `npx vitest run` で全体を回す
- Red で失敗を確認したら、**失敗メッセージが意図どおりか**を見る(別の理由で落ちていたらテストが間違っている)
- Green のたびにコミット可能な状態になる。区切りのよい単位でコミットする(ユーザーがコミットを求めている場合)
- リファクタリングでテストが落ちたら即座に戻す — 落ちたまま次の変更を重ねない

## アンチパターン

- ❌ 実装を書いてからテストを「後付け」する(それは TDD ではなくテスト作成作業)
- ❌ 一度に 5 個のテストを書いてから実装する(Red の意味が失われる)
- ❌ `as any` / `as unknown as` でテストデータを作る — `fromTrusted` / `create` で正規に作る
- ❌ private メソッドや内部状態を直接テストする — 公開 API 経由で検証できないなら設計を見直す
- ❌ カバレッジ数値を目標にする — 目標は受け入れ条件の網羅
