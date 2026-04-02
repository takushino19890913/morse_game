import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

class MockResizeObserver {
  observe() {}
  disconnect() {}
}

class MockAudioParam {
  value = 0;
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  cancelScheduledValues() {}
}

class MockGainNode {
  constructor() {
    this.gain = new MockAudioParam();
  }

  connect() {}
}

class MockOscillatorNode {
  constructor() {
    this.frequency = { value: 0 };
    this.type = "sine";
  }

  connect() {}
  start() {}
  stop() {}
}

class MockAudioContext {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.destination = {};
  }

  resume() {
    return Promise.resolve();
  }

  close() {
    this.state = "closed";
    return Promise.resolve();
  }

  createOscillator() {
    return new MockOscillatorNode();
  }

  createGain() {
    return new MockGainNode();
  }
}

globalThis.ResizeObserver = MockResizeObserver;
globalThis.AudioContext = MockAudioContext;
globalThis.webkitAudioContext = MockAudioContext;

vi.stubGlobal("requestAnimationFrame", (callback) => setTimeout(() => callback(performance.now()), 16));
vi.stubGlobal("cancelAnimationFrame", (id) => clearTimeout(id));

afterEach(() => {
  cleanup();
});
