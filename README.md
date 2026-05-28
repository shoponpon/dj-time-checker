# Rekordbox HOTCUE A-C Time Checker (dj-time-checker)

rekordboxからエクスポートしたセットリスト（XML形式）を読み込み、各楽曲の **HOTCUE A** と **HOTCUE C** の間の時間を計算して合算・出力するTypeScriptプログラムです。

DJプレイや配信などで、各トラックの特定のセクション（例：イントロ〜ボーカル入り、ビルドアップ開始〜ドロップ等）の時間を合算して、セットリスト全体の構成時間やトランジション計画を立てる際に役立ちます。

## 機能特徴

- **プレイリスト順の処理**: XML内にプレイリスト構造が存在する場合、その演奏順に従って楽曲を処理します（プレイリストがない場合はコレクション全体の楽曲を処理します）。
- **正確なHOTCUE抽出**: XML内の `POSITION_MARK` から `Type="0"` (キュー/ホットキューポイント) の `Num="0"` (HOTCUE A) と `Num="2"` (HOTCUE C) を自動検知します。
- **堅牢なエラーハンドリング**: HOTCUE AまたはCのいずれかが欠落している、あるいは設定されていない楽曲は自動でスキップし、欠落している情報をコンソールへ通知します。
- **見やすい出力**: 各曲の位置、時間間隔、および全体の合算時間を `MM:SS.mmm` (または `HH:MM:SS.mmm`) フォーマットと秒数の両方で表示します。

---

## セットアップ

### 1. 依存関係のインストール
プロジェクトのルートディレクトリで以下を実行して、必要なパッケージをインストールします。

```bash
npm install
```

---

## 使い方

### rekordboxからのエクスポート方法
1. rekordboxを開きます。
2. 対象のプレイリストを右クリックし、**「プレイリストをXMLフォーマットでエクスポート」** を選択します。（または、コレクション全体をXMLとしてエクスポートします）
3. エクスポートしたXMLファイルのパスをメモします。

### プログラムの実行
以下のコマンドで、パースと時間計算を実行します。

```bash
npx ts-node src/index.ts <エクスポートしたXMLファイルのパス> <対象プレイリスト名>
```

#### 実行例：
```bash
npx ts-node src/index.ts test_setlist.xml "今日のセトリ"
```

#### 出力結果の例：
```text
Reading file: C:\Users\oishi\Workspaces\dj-time-checker\test_setlist.xml
Found 4 tracks across playlist(s). Processing in playlist order...

--- Processing Track HOTCUEs ---
--------------------------------------------------------------------------------
[PASS] DJ Spark - Awesome Anthem
       HOTCUE A: 00:15.500 (15.5s)
       HOTCUE C: 01:15.250 (75.25s)
       Interval: 00:59.750 (59.750s)
--------------------------------------------------------------------------------
[PASS] Sub Sonic - Deep Bass
       HOTCUE A: 00:10.000 (10s)
       HOTCUE C: 02:10.000 (130s)
       Interval: 02:00.000 (120.000s)
--------------------------------------------------------------------------------
[SKIP] Silent Sound - No Cues (Missing: HOTCUE A, HOTCUE C)
--------------------------------------------------------------------------------
[SKIP] Solo - Only A (Missing: HOTCUE C)
--------------------------------------------------------------------------------

--- Summary ---
Total Tracks Processed: 2
Total Tracks Skipped:   2
Total Combined Time (A to C): 02:59.750 (179.750 seconds)
```

---

## プロジェクト構成

- `src/index.ts` - メインのプログラムロジック
- `test_setlist.xml` - 動作テスト用のサンプルXMLファイル
- `tsconfig.json` - TypeScriptコンパイル設定
- `package.json` - プロジェクト設定および依存関係
