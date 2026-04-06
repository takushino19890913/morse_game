# Fullscreen Rhythm Game Design

**Date:** 2026-04-04

## Goal

Space キーでページが勝手にスクロールする体験を確実に防ぎつつ、音ゲーパートだけをフルスクリーンで集中して遊べる UI を追加する。

## Problem

- 現在の音ゲーは通常の縦長ページの一部として表示されるため、ゲームプレイ中の没入感が弱い。
- Space キーは既定動作抑止が入っているが、画面全体が通常レイアウトのままなので「ページがスクロールしそう」という不安と操作ノイズが残る。
- 文字入力欄や通常 UI の存在と、ゲームプレイ中に求められる集中した入力体験が同じ面に混在している。

## Chosen Approach

音ゲー表示を専用ルートではなくフルスクリーンモーダルとして分離する。既存の `WabunMorseAudioCanvas` の状態管理は維持し、音ゲー UI だけを通常表示とフルスクリーン表示の両方で再利用する。

### Why This Approach

- React Router 等を追加せずに実装できる。
- 既存のゲーム状態、タイマー、採点、キーボード入力処理をそのまま流用しやすい。
- モーダル表示中に `body` スクロールを止めれば、Space キー対策を UI レベルでも補強できる。
- 音ゲーとビルダーの導線を壊さず、既存ページからすぐ入れる。

## UX

### Normal Page

- 音ゲーカード内に `フルスクリーンで遊ぶ` ボタンを追加する。
- ボタン押下で全画面オーバーレイを開き、通常ページは背面に退く。

### Fullscreen Mode

- `fixed inset-0` のオーバーレイでゲーム領域を全面表示する。
- 上部に現在状態、閉じるボタン、必要なら簡潔な操作説明を置く。
- ゲームレーンと主要ステータスを中央に大きく見せる。
- Escape か閉じるボタンで終了できる。
- フルスクリーン中はページ全体をスクロール不能にする。

## Keyboard Behavior

- Space / Enter は現行どおり音確認とゲーム入力に使う。
- ゲーム中と待機中の `preventDefault()` は維持する。
- フルスクリーン時はモーダルコンテナに `tabIndex={-1}` を持たせ、表示時にフォーカスを寄せる。
- `textarea` / `input` / `contentEditable` 上では既存どおり Space 抑止対象から除外する。
- Escape はフルスクリーン終了専用に追加する。

## Scroll Lock

- フルスクリーンモードの間だけ `document.body.style.overflow = "hidden"` を設定する。
- 終了時に元の値を復元する。
- コンポーネント unmount 時にも必ず復元する。

## Visual Direction

- visual thesis: 暗いレーンを主役にして、周辺 UI を静かに退かせる没入型ステージにする。
- content plan: header controls, game lane focus, score/support info, exit action。
- interaction thesis: fullscreen entrance is immediate, lane remains the visual anchor, key state and judgments stay as the dominant motion signals。

## Files

- Modify: `wabun_morse_audio_canvas.jsx`
- Modify: `src/index.css`
- Modify: `src/App.keyboard.test.jsx`

## Testing

- 既存の Space 抑止テストは維持する。
- フルスクリーン開閉テストを追加する。
- フルスクリーン中に `body.style.overflow` が `hidden` になることを確認する。
- Escape でフルスクリーンを閉じられることを確認する。
- ビルドを通し、ブラウザで通常表示とフルスクリーン表示を確認する。
