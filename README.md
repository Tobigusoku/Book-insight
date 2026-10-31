# Book Insight

書籍を検索して「積読」「読了」を記録する、個人開発の読書記録アプリです。Webアプリの基礎を学びながら、バックエンド・データベース・データ活用まで段階的に作ることを目指しています。

> 開発中です。現在の画面はブラウザの `localStorage` に保存します。Express APIは学習用に別途実装しており、画面とはまだ接続していません。

## 現在できること

- 国立国会図書館サーチの OpenSearch APIで本を検索し、候補からタイトル・著者を入力できます。見つからない本は手入力できます。
- 検索候補にISBNがあれば、Open Libraryの書影を検索結果に表示します。候補を選んで登録すると書影URLも記録に保存し、一覧で表示します。画像がない・取得できない場合は代替表示にします。
- 本を積読または読了として登録し、一覧表示、タイトル・著者の編集、削除ができます。
- 読了した本に1〜5の評価、読了時期（年月日・年のみ・不明）、任意のメモを記録・編集できます。
- 画面の記録は `localStorage` に保存し、同じブラウザで再読み込みしても残ります。
- 独立したExpress APIで `POST /api/books` による積読の登録と、`GET /api/books` による登録済み一覧の取得ができます。データはサーバーのメモリに一時保存します。

## 技術構成

| 領域 | 現在使用している技術 |
| --- | --- |
| 画面 | React、JavaScript/JSX、Vite、CSS |
| 書籍検索・書影 | 国立国会図書館サーチ OpenSearch API、Open Library Covers |
| API | Node.js、Express |
| テスト | Vitest、React Testing Library、jsdom、HTTP通信を使うAPIテスト |
| 保存 | 画面は `localStorage`、APIはプロセス内メモリ |

現状のデータの流れは次のとおりです。

```text
ブラウザ（React） ──検索──> 国立国会図書館サーチ
       │                         └─ ISBNからOpen Libraryの書影URLを生成
       └──記録の保存──> localStorage

Express API（POST /api/books・GET /api/books） <──> サーバーのメモリ
```

画面からExpress APIへの通信、PostgreSQLによる永続化、分析・推薦、他メディアへの拡張は未実装です。サーバーの記録は再起動すると消えます。

## ローカルで動かす

Node.jsとnpmが必要です。リポジトリのルートで依存関係をインストールします。

```bash
npm ci
npm run dev
```

Viteが表示するURL（通常は `http://localhost:5173/`）で画面を開きます。画面の利用にAPIサーバーの起動はまだ不要です。

APIを試す場合は別のターミナルで起動します。

```bash
npm run dev:server
```

APIは通常 `http://localhost:3001` で待ち受けます。`POST /api/books` は `Content-Type: application/json` の本文に `title` と `author` を指定し、成功時は `201` と作成した積読の本、入力不正や壊れたJSONには `400` を返します。`GET /api/books` は登録順の一覧を `200` で返し、未登録なら空の配列を返します。画面からこのAPIはまだ呼び出していません。

## テストと確認

```bash
npx vitest run --pool=forks
npm run lint
npm run build
```

画面のテストは外部検索APIの応答をモックし、入力・検索・登録・編集・削除などを確認します。APIのテストは実際のHTTPリクエストで正常系と入力エラーを確認します。

## 今後の方向

書影の手元画像による追加・差し替えなど、書籍の記録機能を仕上げます。その後、画面とAPIの接続、PostgreSQLへの保存を段階的に進める予定です。分析や推薦、機械学習、他メディア対応、公開は必須とはせず、データ量や必要性を見て判断します。

詳しい要件は [REQUIREMENTS.md](REQUIREMENTS.md)、開発順序と学習方針は [ROADMAP.md](ROADMAP.md) にまとめています。
