---
description: Design a DDD layered architecture for React + TypeScript + Vite — brand types and companion objects (no classes) in domain/application layers, class-based Repository implementations in infrastructure, DI via composition root and React Context, DIP throughout
---

React + TypeScript + Vite プロジェクトの DDD レイヤードアーキテクチャを設計する。ドメイン層・アプリケーション層は **`type` + コンパニオンオブジェクト + ブランド型**(クラス禁止)、**Repository 実装のみ class 使用可**。依存性逆転(DIP)とコンポジションルートによる DI を徹底する。

## レイヤー構成と依存方向

```
src/
  domain/          # 最内層。何にも依存しない
    shared/            result.ts, domain-event.ts
    {context}/
      value-objects/   *.vo.ts        — ブランド型 + コンパニオン
      entities/        *.entity.ts    — 判別 Union で状態表現
      aggregates/      *.aggregate.ts — 不変条件の境界
      events/          *.event.ts
      services/        *.service.ts
      i-{name}.repository.ts           — Repository インターフェース(定義はここ)
      index.ts
  application/     # domain のみに依存。ユースケース = ファクトリ関数
    {context}/
      use-cases/       *.use-case.ts
  infrastructure/  # domain のインターフェースを実装。★唯一 class を許可する層
    {context}/
      repositories/    *.repository.ts
  presentation/    # application のみに依存(domain の型は参照可)
    components/        *.tsx
    hooks/             use-*.ts
  di/              # コンポジションルート。全レイヤーを知る唯一の場所
    dependencies.ts
    dependencies-context.tsx
```

**依存ルール(DIP):**
- 依存は常に内側へ: `presentation → application → domain` / `infrastructure → domain`
- domain は他のどの層も import しない。application は infrastructure を import しない
- 外側の具象(Repository 実装)を内側へ渡すのは `di/` の責務だけ
- 違反は import 文を見れば機械的に検出できる — レビュー時に必ず確認する

## ドメイン層のパターン(要点)

ドメイン層の詳細な実装規約(VO / Entity / Aggregate / Domain Event / Domain Service / Specification の各テンプレート)は `ddd-plugin:implement-domain` スキルと同一。要点のみ再掲する:

```typescript
// ブランド型 + コンパニオンオブジェクト(VO の基本形)
export type TodoTitle = string & { readonly _brand: 'TodoTitle' }

export type TodoTitleError =
  | { readonly type: 'Empty' }
  | { readonly type: 'TooLong'; readonly max: number; readonly actual: number }

export const TodoTitle = {
  of(value: string): Result<TodoTitle, TodoTitleError> { /* 検証して Result を返す */ },
  fromTrusted(value: string): TodoTitle { return value as TodoTitle },  // DB 復元専用
  equals(a: TodoTitle, b: TodoTitle): boolean { return a === b },
  unwrap(title: TodoTitle): string { return title },
}
```

- データは `type`、振る舞いはコンパニオン `const`。すべてイミュータブル
- エラーは throw せず `Result<T, E>`(判別 Union のエラー型)で返す
- Entity の状態は判別 Union で表現し、不正な遷移を型エラーにする
- 集約は Vernon の4原則: 真の不変条件で境界・小さく・他集約は ID 参照・境界外は結果整合性

## Repository — インターフェースは domain、class 実装は infrastructure

**インターフェース(domain 層):** コレクション指向・集約単位。

```typescript
// src/domain/todo/i-todo.repository.ts
export interface ITodoRepository {
  nextId(): TodoId
  findById(id: TodoId): Promise<TodoAggregate | null>
  findAll(): Promise<readonly TodoAggregate[]>
  save(aggregate: TodoAggregate): Promise<void>
  delete(id: TodoId): Promise<void>
}
```

**実装(infrastructure 層):** ここだけ class を使ってよい。接続・キャッシュ等の内部状態を持つ技術的関心事であり、class が最も自然なため。

```typescript
// src/infrastructure/todo/repositories/local-storage-todo.repository.ts
import type { ITodoRepository } from '../../../domain/todo/i-todo.repository.ts'

export class LocalStorageTodoRepository implements ITodoRepository {
  constructor(private readonly storageKey: string = 'todos') {}

  nextId(): TodoId {
    return TodoId.fromTrusted(crypto.randomUUID())
  }

  async findById(id: TodoId): Promise<TodoAggregate | null> {
    const rows = this.load()
    const row = rows.find(r => r.id === TodoId.unwrap(id))
    return row ? this.toDomain(row) : null
  }

  async save(aggregate: TodoAggregate): Promise<void> { /* toRow して書き込み */ }

  // 永続化形式 ⇔ ドメイン型の変換は Repository 実装の責務
  private toDomain(row: TodoRow): TodoAggregate {
    return TodoAggregate.reconstruct({
      id: TodoId.fromTrusted(row.id),
      title: TodoTitle.fromTrusted(row.title),
      /* ... */
    })
  }
  private load(): TodoRow[] { /* localStorage から読み出し */ }
}
```

**ルール:**
- `implements ITodoRepository` を必ず書く(構造的部分型に頼らない — インターフェース変更時にコンパイルエラーで検出する)
- 永続化用の行型(`TodoRow` 等)とドメイン型の変換は Repository 内に閉じる。ドメイン型をそのまま `JSON.stringify` しない
- 復元には `fromTrusted` / `reconstruct` を使う(`of` / `create` は新規生成用)
- `tsconfig` の `erasableSyntaxOnly: true` はコンストラクタのパラメータプロパティを禁止しないため使えるが、有効にする場合は `private readonly storageKey` 形式が使えない点に注意(通常のフィールド宣言に展開する)

## アプリケーション層 — ユースケースはファクトリ関数

class は使わない。**依存を引数に取るファクトリ関数**がユースケースを返す。これが DI の単位になる。

```typescript
// src/application/todo/use-cases/add-todo.use-case.ts
import type { ITodoRepository } from '../../../domain/todo/i-todo.repository.ts'

export type AddTodoInput = { readonly title: string }
export type AddTodoError = TodoTitleError | { readonly type: 'TitleTaken' }
export type AddTodoUseCase = (input: AddTodoInput) => Promise<Result<TodoAggregate, AddTodoError>>

export const createAddTodoUseCase = (
  repository: ITodoRepository,
  clock: Clock,                      // 現在時刻も注入する(テスト容易性)
): AddTodoUseCase => async (input) => {
  const title = TodoTitle.of(input.title)
  if (!title.ok) return title

  const { aggregate, events } = TodoAggregate.create({
    id: repository.nextId(),
    title: title.value,
    createdAt: clock.now(),
  })
  await repository.save(aggregate)
  // events の publish が必要ならここで行う(ドメイン層は返すだけ)
  return Result.ok(aggregate)
}
```

**ルール:**
- ユースケースは 1 ファイル 1 関数。入力はプリミティブ(UI から来る生の値)、出力は `Result<ドメイン型, エラー Union>`
- VO の検証はユースケースの入り口で行い、以降はブランド型だけを流す
- 時刻・乱数などの非決定性も依存として注入する(`Clock` インターフェース等)

## DI — コンポジションルートと React Context

**コンポジションルート(全ての具象を組み立てる唯一の場所):**

```typescript
// src/di/dependencies.ts
export type Dependencies = {
  readonly addTodo: AddTodoUseCase
  readonly completeTodo: CompleteTodoUseCase
  readonly listTodos: ListTodosUseCase
}

export const createDependencies = (): Dependencies => {
  const todoRepository: ITodoRepository = new LocalStorageTodoRepository()
  const clock: Clock = SystemClock
  return {
    addTodo: createAddTodoUseCase(todoRepository, clock),
    completeTodo: createCompleteTodoUseCase(todoRepository, clock),
    listTodos: createListTodosUseCase(todoRepository),
  }
}
```

**React への供給(Context):**

```tsx
// src/di/dependencies-context.tsx
const DependenciesContext = createContext<Dependencies | null>(null)

export const DependenciesProvider = ({ dependencies, children }: {
  dependencies: Dependencies
  children: ReactNode
}) => (
  <DependenciesContext.Provider value={dependencies}>{children}</DependenciesContext.Provider>
)

export const useDependencies = (): Dependencies => {
  const deps = useContext(DependenciesContext)
  if (deps === null) throw new Error('DependenciesProvider is missing')  // 設定ミスは fail fast
  return deps
}
```

```tsx
// src/main.tsx — アプリの入口で1回だけ組み立てる
createRoot(document.getElementById('root')!).render(
  <DependenciesProvider dependencies={createDependencies()}>
    <App />
  </DependenciesProvider>,
)
```

**presentation 層の hook はユースケースだけを呼ぶ:**

```typescript
// src/presentation/hooks/use-add-todo.ts
export const useAddTodo = () => {
  const { addTodo } = useDependencies()
  const [error, setError] = useState<AddTodoError | null>(null)
  const submit = async (title: string) => {
    const result = await addTodo({ title })
    if (!result.ok) { setError(result.error); return }
    setError(null)
  }
  return { submit, error }
}
```

**ルール:**
- `new` が書けるのは `di/` とテストコードだけ(Repository 実装の class を含む)
- コンポーネント・hook から Repository を直接触らない — 必ずユースケース経由
- テストでは `DependenciesProvider` に InMemory 実装で組んだ `Dependencies` を渡すだけで全て差し替わる
- Context の分割(認証用・機能別)はアプリが育ってから。最初は 1 つでよい

## TypeScript / Vite 設定要件

```json
// tsconfig.json (compilerOptions)
{
  "strict": true,
  "verbatimModuleSyntax": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

- クラス禁止(Repository 実装と `di/`・テスト以外)は**規約**であり、コンパイラでは強制されない。ESLint の `no-restricted-syntax` で `ClassDeclaration` を禁止し、`src/infrastructure/**/repositories/**` を override で除外する構成を推奨
- Vite 8 では設定はデフォルトで十分。パスエイリアスを使う場合は `vite.config.ts` と `tsconfig.json` の両方に定義する

## 設計成果物

このスキルの出力は実装ではなく**設計の提示**。以下をユーザーに示し、異論がないことを確認してから `tdd-cycle` に進む:

1. 追加・変更する型の一覧(VO / Entity / Aggregate / Event)と各々の責務 1 行
2. 集約境界の判断と理由(なぜこの単位でトランザクション整合性を守るのか)
3. Repository インターフェースへの追加メソッド(必要な場合のみ)
4. ユースケースの一覧(名前 = ユビキタス言語の動詞)
5. 影響を受ける既存コード

## レビューチェックリスト(設計時の自己点検)

- [ ] import の向きが全て内側か(domain → 他層の import がゼロか)
- [ ] class が Repository 実装以外に存在しないか
- [ ] ユースケースの依存は全て引数注入か(モジュールスコープで `new` していないか)
- [ ] VO 化すべきプリミティブが裸で流れていないか(ID・タイトル・金額等)
- [ ] Repository インターフェースに生成責務やクエリビルダが紛れ込んでいないか
- [ ] 型名・関数名がユビキタス言語(仕様書の用語表)と一致しているか
