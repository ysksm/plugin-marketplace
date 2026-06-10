# prompts/ — スキルを使わずプロンプトだけで使う

Claude Code のプラグイン / スキルをインストールできない環境（プラグイン非対応の環境、他の AI ツール、チャット UI など）向けに、各プラグインと同等の結果を得られる**スタンドアロンのプロンプト**を置く。

## 使い方

1. 使いたいプロンプトファイルの中身を**丸ごとコピー**する
2. AI アシスタントにそのまま貼り付ける
3. ファイル末尾の指示に従って、対象（ドメイン要件・解析対象ディレクトリなど）を追記する

ファイルの中身がそのままプロンプトになるよう書かれているので、加工は不要。

## プロンプト一覧

| プロンプト | 対応プラグイン / スキル | 内容 |
|-----------|------------------------|------|
| [implement-domain.prompt.md](implement-domain.prompt.md) | ddd-plugin `/implement-domain` | TypeScript の DDD ドメイン層をクラスなし（ブランド型・コンパニオンオブジェクト・判別 Union・Result 型）で実装する規約一式 |
| [visualize-domain.prompt.md](visualize-domain.prompt.md) | ddd-visualizer-plugin `/visualize-domain` | TypeScript プロジェクトを AST 解析し、インタラクティブ HTML ビューア + Mermaid markdown を生成する手順 |

## メンテナンス方針

- 一次ソースは各プラグインの `SKILL.md`。スキルを更新したら対応するプロンプトも同期すること
- `implement-domain.prompt.md` は SKILL.md の規約本文をそのまま含む（自己完結にするための意図的な複製）
- `visualize-domain.prompt.md` はスクリプト本体（約 1,000 行）を埋め込まず、このリポジトリから取得して実行する方式を取る
