import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../wabun_morse_audio_canvas.jsx";

describe("keyboard play controls", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockImplementation(() => Date.now());
  });

  it("captures a short Space press as a dot during a running game", async () => {
    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "音ゲー開始" }));
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
});
