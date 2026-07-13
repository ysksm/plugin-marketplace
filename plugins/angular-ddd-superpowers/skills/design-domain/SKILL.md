---
description: Design a DDD layered architecture for Angular + TypeScript — brand types and companion objects (no classes) in domain/application layers, class-based Repository implementations in infrastructure, DI/DIP via InjectionToken and useFactory providers, signal-based components
---

Angular + TypeScript プロジェクトの DDD レイヤードアーキテクチャを設計する。ドメイン層・アプリケーション層は **`type` + コンパニオンオブジェクト + ブランド型**(クラス禁止)。class の例外は **① Repository 実装(インフラ層)② Angular が class を要求する Component / Directive / Pipe** の 2 つだけ。依存性逆転(DIP)は Angular DI の `InjectionToken` で実現する。

## レイヤー構成と依存方向

```
src/app/
  domain/          # 最内層。Angular にも依存しない(@angular/* を import しない)
    shared/            result.ts, domain-event.ts
    {context}/
      value-objects/   *.vo.ts        — ブランド型 + コンパニオン
      entities/        *.entity.ts    — 判別 Union で状態表現
      aggregates/      *.aggregate.ts — 不変条件の境界
      events/          *.event.ts
      services/        *.service.ts   — Domain Service(関数、@Injectable ではない)
      i-{name}.repository.ts           — Repository インターフェース(定義はここ)
      index.ts
  application/     # domain のみに依存。ユースケース = ファクトリ関数(Angular 非依存)
    {context}/
      use-cases/       *.use-case.ts
  infrastructure/  # domain のインターフェースを実装。★Repository class を置く層
    {context}/
      repositories/    *.repository.ts
  presentation/    # application のみに依存(domain の型は参照可)
    {context}/
      *.component.ts   — Angular Component(class・standalone・signals)
  di/              # DI トークン定義と provider 組み立て。全レイヤーを知る唯一の場所
    tokens.ts
    providers.ts
  app.config.ts    # providers.ts を登録するだけ
```

**依存ルール(DIP):**
- 依存は常に内側へ: `presentation → application → domain` / `infrastructure → domain`
- **domain と application は `@angular/*` を一切 import しない**(フレームワーク非依存 = テストに TestBed 不要)
- 外側の具象(Repository 実装)を内側へ渡す配線は `di/` の provider 定義だけが知る
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
- Domain Service は `@Injectable` クラスにしない — 依存を引数で受ける関数(Angular の "Service" という語に引きずられてドメインロジックを class に置かない)

## Repository — インターフェースは domain、class 実装は infrastructure

**インターフェース(domain 層):** コレクション指向・集約単位。

```typescript
// src/app/domain/todo/i-todo.repository.ts
export interface ITodoRepository {
  nextId(): TodoId
  findById(id: TodoId): Promise<TodoAggregate | null>
  findAll(): Promise<readonly TodoAggregate[]>
  save(aggregate: TodoAggregate): Promise<void>
  delete(id: TodoId): Promise<void>
}
```

**実装(infrastructure 層):** ここは class を使ってよい。`@Injectable()` は付けず、`di/providers.ts` の `useFactory` で組み立てる(実装クラス自体を Angular 非依存に保ち、DI の配線を 1 箇所に集める)。`HttpClient` など Angular のサービスが必要な場合は factory から `inject()` して渡す。

```typescript
// src/app/infrastructure/todo/repositories/http-todo.repository.ts
import type { ITodoRepository } from '../../../domain/todo/i-todo.repository.ts'

export class HttpTodoRepository implements ITodoRepository {
  constructor(private readonly http: HttpClient) {}

  nextId(): TodoId {
    return TodoId.fromTrusted(crypto.randomUUID())
  }

  async findById(id: TodoId): Promise<TodoAggregate | null> {
    const row = await firstValueFrom(this.http.get<TodoRow | null>(`/api/todos/${TodoId.unwrap(id)}`))
    return row ? this.toDomain(row) : null
  }

  async save(aggregate: TodoAggregate): Promise<void> { /* toRow して PUT */ }

  // 永続化形式 ⇔ ドメイン型の変換は Repository 実装の責務
  private toDomain(row: TodoRow): TodoAggregate {
    return TodoAggregate.reconstruct({
      id: TodoId.fromTrusted(row.id),
      title: TodoTitle.fromTrusted(row.title),
      /* ... */
    })
  }
}
```

**ルール:**
- `implements ITodoRepository` を必ず書く(インターフェース変更時にコンパイルエラーで検出する)
- 永続化用の行型(`TodoRow` 等)とドメイン型の変換は Repository 内に閉じる。API の JSON をそのままドメイン型として扱わない
- 復元には `fromTrusted` / `reconstruct` を使う(`of` / `create` は新規生成用)
- Observable ではなく Promise を返す(インターフェースが domain 層にあり RxJS 依存を持ち込まないため)。RxJS が必要な UI 都合は presentation 層で変換する

## アプリケーション層 — ユースケースはファクトリ関数

class は使わない。**依存を引数に取るファクトリ関数**がユースケースを返す。Angular 非依存なので単体テストに TestBed が要らない。

```typescript
// src/app/application/todo/use-cases/add-todo.use-case.ts
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

## DI — InjectionToken による DIP と provider 組み立て

**トークン定義(`di/tokens.ts`):** インターフェース型に対する DI の「名前」。

```typescript
import { InjectionToken } from '@angular/core'

export const TODO_REPOSITORY = new InjectionToken<ITodoRepository>('ITodoRepository')
export const CLOCK = new InjectionToken<Clock>('Clock')
export const ADD_TODO_USE_CASE = new InjectionToken<AddTodoUseCase>('AddTodoUseCase')
export const COMPLETE_TODO_USE_CASE = new InjectionToken<CompleteTodoUseCase>('CompleteTodoUseCase')
```

**provider 組み立て(`di/providers.ts`):** ここがコンポジションルート。`new` を書けるのはこことテストだけ。

```typescript
import { inject, type Provider } from '@angular/core'
import { HttpClient } from '@angular/common/http'

export const provideTodoFeature = (): Provider[] => [
  { provide: TODO_REPOSITORY, useFactory: () => new HttpTodoRepository(inject(HttpClient)) },
  { provide: CLOCK, useValue: SystemClock },
  {
    provide: ADD_TODO_USE_CASE,
    useFactory: () => createAddTodoUseCase(inject(TODO_REPOSITORY), inject(CLOCK)),
  },
  {
    provide: COMPLETE_TODO_USE_CASE,
    useFactory: () => createCompleteTodoUseCase(inject(TODO_REPOSITORY), inject(CLOCK)),
  },
]
```

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(), provideTodoFeature()],
}
```

**presentation 層のコンポーネントはトークン経由でユースケースだけを注入する:**

```typescript
// src/app/presentation/todo/todo-page.component.ts
@Component({
  selector: 'app-todo-page',
  standalone: true,
  template: `...`,
})
export class TodoPageComponent {
  private readonly addTodo = inject(ADD_TODO_USE_CASE)

  protected readonly todos = signal<readonly TodoAggregate[]>([])
  protected readonly error = signal<AddTodoError | null>(null)

  protected async onSubmit(title: string): Promise<void> {
    const result = await this.addTodo({ title })
    if (!result.ok) { this.error.set(result.error); return }
    this.error.set(null)
    this.todos.update(list => [...list, result.value])
  }
}
```

**ルール:**
- コンポーネントは class(Angular の要求)だが、**ドメインロジックを持たない** — VO 検証・ビジネスルールをコンポーネント内に書かず、ユースケースを呼んで `Result` を signal に反映するだけ
- コンポーネントから Repository トークンを直接 inject しない — 必ずユースケース経由
- 状態は signals(`signal` / `computed`)。ドメイン型をそのまま signal に載せてよい(イミュータブルなので `update` と相性がよい)
- テストでは `TestBed.configureTestingModule({ providers: [{ provide: TODO_REPOSITORY, useValue: inMemoryRepo }, ...] })` でトークン単位に差し替え

## TypeScript 設定要件

```json
// tsconfig.json (compilerOptions)
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

- クラス禁止(Repository 実装・Angular Component/Directive/Pipe・テスト以外)は**規約**であり、コンパイラでは強制されない。ESLint の `no-restricted-syntax` で `ClassDeclaration` を禁止し、`infrastructure/**/repositories/**` と `presentation/**` を override で除外する構成を推奨
- `domain/` `application/` への `@angular/*` import 禁止は `eslint-plugin-import` の `no-restricted-imports`(または boundaries 系プラグイン)で強制できる

## 設計成果物

このスキルの出力は実装ではなく**設計の提示**。以下をユーザーに示し、異論がないことを確認してから `tdd-cycle` に進む:

1. 追加・変更する型の一覧(VO / Entity / Aggregate / Event)と各々の責務 1 行
2. 集約境界の判断と理由(なぜこの単位でトランザクション整合性を守るのか)
3. Repository インターフェース・DI トークンへの追加(必要な場合のみ)
4. ユースケースの一覧(名前 = ユビキタス言語の動詞)
5. 影響を受ける既存コード

## レビューチェックリスト(設計時の自己点検)

- [ ] import の向きが全て内側か(domain / application に `@angular/*` の import がゼロか)
- [ ] class が Repository 実装と Angular Component/Directive/Pipe 以外に存在しないか
- [ ] ユースケースの依存は全て引数注入か(モジュールスコープで `new` していないか)
- [ ] `new` が `di/providers.ts` とテスト以外に存在しないか
- [ ] コンポーネントにドメインロジック(バリデーション・ビジネスルール)が漏れていないか
- [ ] VO 化すべきプリミティブが裸で流れていないか(ID・タイトル・金額等)
- [ ] Repository インターフェースに生成責務やクエリビルダが紛れ込んでいないか
- [ ] 型名・関数名がユビキタス言語(仕様書の用語表)と一致しているか
