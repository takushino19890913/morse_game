import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../wabun_morse_audio_canvas.jsx";

describe("keyboard play controls", () => {
  let originalScrollIntoView;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockImplementation(() => Date.now());
    originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  });

  it("captures a short Space press as a dot during a running game", async () => {
    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "音ゲー開始" }));
      await Promise.resolve();
    });

    const startButton = screen.getByRole("button", { name: "スタート" });

    await act(async () => {
      fireEvent.click(startButton);
      await vi.advanceTimersByTimeAsync(2105);
    });

    expect(screen.getByText("Enter / Space またはここを長押し")).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true }));
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(120);
      window.dispatchEvent(new KeyboardEvent("keyup", { key: " ", code: "Space", bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(screen.getByText("入力: ・")).toBeTruthy();
  });

  it("prevents the default Space key action while idle", () => {
    render(<App />);

    const event = new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true });
    const dispatched = window.dispatchEvent(event);

    expect(dispatched).toBe(false);
    expect(event.defaultPrevented).toBe(true);
  });

  it("opens a start modal when the game start button is pressed", () => {
    render(<App />);

    expect(screen.queryByRole("textbox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "音ゲー開始" }));

    expect(screen.getByRole("dialog", { name: "開始する文字を入力" })).toBeTruthy();
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("starts the game from the modal and scrolls to the game lane", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "音ゲー開始" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "おはよう" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "スタート" }));
      await Promise.resolve();
    });

    expect(screen.queryByRole("dialog", { name: "開始する文字を入力" })).toBeNull();
    expect(scrollIntoView).toHaveBeenCalled();
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: originalScrollIntoView,
    });
  });

  it("locks body scroll and focuses the fullscreen dialog while fullscreen play is open", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "フルスクリーンで遊ぶ" }));

    const dialog = screen.getByRole("dialog", { name: "音ゲーフルスクリーン" });
    const guideViewport = screen.getByTestId("char-guide-viewport");
    const guideTrack = screen.getByTestId("char-guide-track");
    expect(dialog).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement).toBe(dialog);
    expect(dialog.className).toContain("overflow-hidden");
    expect(guideViewport.className).toContain("shrink-0");
    expect(within(dialog).queryByRole("textbox")).toBeNull();
    expect(guideViewport.className).not.toContain("overflow-x-auto");
    expect(guideTrack.className).toContain("flex-wrap");
  });

  it("closes fullscreen play with Escape and restores body scrolling", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "フルスクリーンで遊ぶ" }));
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });

    expect(screen.queryByRole("dialog", { name: "音ゲーフルスクリーン" })).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("prevents Space default on focused fullscreen controls", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "フルスクリーンで遊ぶ" }));

    const closeButton = screen.getByRole("button", { name: "閉じる" });
    closeButton.focus();
    const event = new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true });
    closeButton.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
