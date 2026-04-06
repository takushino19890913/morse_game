# Fullscreen Rhythm Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Space スクロールを確実に防ぎつつ、音ゲーをフルスクリーンモーダルで遊べるようにする

**Architecture:** `wabun_morse_audio_canvas.jsx` の既存状態管理は維持し、音ゲー表示部分だけをフルスクリーンオーバーレイへ再利用可能なレイアウトとして抽出する。フルスクリーンの開閉に応じて `body` のスクロールをロックし、キーボード処理に Escape とフォーカス制御を加える。

**Tech Stack:** React 18, Vite, Vitest, Testing Library, Tailwind utility classes

---

### Task 1: Regression Tests For Fullscreen Mode

**Files:**
- Modify: `src/App.keyboard.test.jsx`
- Test: `src/App.keyboard.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
it("locks body scroll while fullscreen rhythm mode is open", async () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "フルスクリーンで遊ぶ" }));

  expect(document.body.style.overflow).toBe("hidden");
  expect(screen.getByRole("dialog", { name: "音ゲーフルスクリーン" })).toBeTruthy();
});

it("closes fullscreen rhythm mode with Escape", async () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "フルスクリーンで遊ぶ" }));
  fireEvent.keyDown(window, { key: "Escape", code: "Escape" });

  expect(screen.queryByRole("dialog", { name: "音ゲーフルスクリーン" })).toBeNull();
  expect(document.body.style.overflow).toBe("");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.keyboard.test.jsx`
Expected: FAIL because fullscreen trigger, dialog, or body scroll lock does not exist yet

- [ ] **Step 3: Write minimal implementation**

```jsx
const [isFullscreenGameOpen, setIsFullscreenGameOpen] = useState(false);

useEffect(() => {
  if (!isFullscreenGameOpen) return undefined;

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => {
    document.body.style.overflow = previousOverflow;
  };
}, [isFullscreenGameOpen]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/App.keyboard.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.keyboard.test.jsx wabun_morse_audio_canvas.jsx src/index.css
git commit -m "feat: add fullscreen rhythm game mode"
```

### Task 2: Fullscreen Overlay UI

**Files:**
- Modify: `wabun_morse_audio_canvas.jsx`
- Modify: `src/index.css`
- Test: `src/App.keyboard.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
it("renders the rhythm game in a fullscreen dialog with a close control", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "フルスクリーンで遊ぶ" }));

  expect(screen.getByRole("dialog", { name: "音ゲーフルスクリーン" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "閉じる" })).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.keyboard.test.jsx`
Expected: FAIL because the fullscreen dialog shell is missing

- [ ] **Step 3: Write minimal implementation**

```jsx
{isFullscreenGameOpen ? (
  <div role="dialog" aria-modal="true" aria-label="音ゲーフルスクリーン">
    <button type="button" onClick={() => setIsFullscreenGameOpen(false)}>
      閉じる
    </button>
    {renderGamePanel({ fullscreen: true })}
  </div>
) : null}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/App.keyboard.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.keyboard.test.jsx wabun_morse_audio_canvas.jsx src/index.css
git commit -m "feat: present rhythm game in fullscreen overlay"
```

### Task 3: Keyboard And Focus Polish

**Files:**
- Modify: `wabun_morse_audio_canvas.jsx`
- Test: `src/App.keyboard.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
it("moves focus into the fullscreen dialog when it opens", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "フルスクリーンで遊ぶ" }));

  expect(screen.getByRole("dialog", { name: "音ゲーフルスクリーン" })).toHaveFocus();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.keyboard.test.jsx`
Expected: FAIL because the dialog is not focusable yet

- [ ] **Step 3: Write minimal implementation**

```jsx
const fullscreenDialogRef = useRef(null);

useEffect(() => {
  if (!isFullscreenGameOpen) return;
  fullscreenDialogRef.current?.focus();
}, [isFullscreenGameOpen]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/App.keyboard.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.keyboard.test.jsx wabun_morse_audio_canvas.jsx
git commit -m "feat: focus fullscreen rhythm dialog on open"
```

### Task 4: Final Verification

**Files:**
- Modify: `wabun_morse_audio_canvas.jsx`
- Modify: `src/index.css`
- Modify: `src/App.keyboard.test.jsx`

- [ ] **Step 1: Run targeted tests**

Run: `npm test -- src/App.keyboard.test.jsx`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Verify in browser**

Run: `npm run dev`
Then confirm:
- フルスクリーンの開閉ができる
- Space でページスクロールが起きない
- Escape で閉じる
- モバイル幅でもレーンが崩れない

- [ ] **Step 5: Commit**

```bash
git add wabun_morse_audio_canvas.jsx src/index.css src/App.keyboard.test.jsx docs/superpowers/specs/2026-04-04-fullscreen-rhythm-game-design.md docs/superpowers/plans/2026-04-04-fullscreen-rhythm-game.md
git commit -m "feat: harden rhythm game input and fullscreen mode"
```
