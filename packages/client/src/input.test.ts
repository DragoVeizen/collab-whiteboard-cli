import { describe, it, expect } from "vitest";
import { initialInputState, reduceInput, type InputState } from "./input.js";

// Deterministic id generator so tests can assert emitted ids.
const gen = (() => {
  let n = 0;
  return () => `id-${++n}`;
})();

const S = (overrides: Partial<InputState> = {}): InputState => ({
  ...initialInputState(20, 10),
  ...overrides,
});

describe("mode keys", () => {
  it("1 key sets mode to dot", () => {
    const s = S({ mode: "circle" });
    const r = reduceInput(s, "1", gen);
    expect(r.state.mode).toBe("dot");
    expect(r.emit).toBeNull();
  });

  it("2 key sets mode to circle", () => {
    const r = reduceInput(S(), "2", gen);
    expect(r.state.mode).toBe("circle");
  });

  it("3 key sets mode to line", () => {
    const r = reduceInput(S(), "3", gen);
    expect(r.state.mode).toBe("line");
  });

  it("4 key sets mode to square", () => {
    const r = reduceInput(S(), "4", gen);
    expect(r.state.mode).toBe("square");
  });

  it("changing mode clears any pending anchor", () => {
    const s = S({ mode: "circle", anchor: { x: 3, y: 3 } });
    const r = reduceInput(s, "1", gen);
    expect(r.state.anchor).toBeNull();
  });
});

describe("cursor movement", () => {
  it("h moves cursor left by 1", () => {
    const r = reduceInput(S({ cursor: { x: 5, y: 5 } }), "h", gen);
    expect(r.state.cursor).toEqual({ x: 4, y: 5 });
  });

  it("j moves cursor down by 1", () => {
    const r = reduceInput(S({ cursor: { x: 5, y: 5 } }), "j", gen);
    expect(r.state.cursor).toEqual({ x: 5, y: 6 });
  });

  it("k moves cursor up by 1", () => {
    const r = reduceInput(S({ cursor: { x: 5, y: 5 } }), "k", gen);
    expect(r.state.cursor).toEqual({ x: 5, y: 4 });
  });

  it("l moves cursor right by 1", () => {
    const r = reduceInput(S({ cursor: { x: 5, y: 5 } }), "l", gen);
    expect(r.state.cursor).toEqual({ x: 6, y: 5 });
  });

  it("H moves cursor left by 5", () => {
    const r = reduceInput(S({ cursor: { x: 10, y: 5 } }), "H", gen);
    expect(r.state.cursor).toEqual({ x: 5, y: 5 });
  });

  it("J moves cursor down by 5 (clamped to height-1)", () => {
    // viewport 20x10 → max y is 9. From y=5, +5 = 10, clamped to 9.
    const r = reduceInput(S({ cursor: { x: 5, y: 5 } }), "J", gen);
    expect(r.state.cursor.y).toBe(9);
  });

  it("K moves cursor up by 5", () => {
    const r = reduceInput(S({ cursor: { x: 5, y: 7 } }), "K", gen);
    expect(r.state.cursor).toEqual({ x: 5, y: 2 });
  });

  it("L moves cursor right by 5 (clamped to width-1)", () => {
    // viewport 20x10 → max x is 19.
    const r = reduceInput(S({ cursor: { x: 16, y: 5 } }), "L", gen);
    expect(r.state.cursor.x).toBe(19);
  });

  it("cursor clamped: cannot go below zero", () => {
    const r = reduceInput(S({ cursor: { x: 0, y: 0 } }), "h", gen);
    expect(r.state.cursor).toEqual({ x: 0, y: 0 });
  });

  it("cursor clamped: k at y=0 stays at y=0", () => {
    const r = reduceInput(S({ cursor: { x: 5, y: 0 } }), "k", gen);
    expect(r.state.cursor).toEqual({ x: 5, y: 0 });
  });
});

describe("dot placement", () => {
  it("space in dot mode emits draw dot at cursor", () => {
    const s = S({ mode: "dot", cursor: { x: 3, y: 4 } });
    const r = reduceInput(s, "space", gen);
    expect(r.emit).not.toBeNull();
    expect(r.emit?.type).toBe("draw");
    if (r.emit?.type === "draw") {
      expect(r.emit.shape).toEqual({ kind: "dot", at: { x: 3, y: 4 } });
    }
  });

  it("dot placement records the emitted id in ownDraws", () => {
    const s = S({ mode: "dot", cursor: { x: 1, y: 1 } });
    const r = reduceInput(s, "space", gen);
    expect(r.state.ownDraws.length).toBe(1);
  });
});

describe("two-anchor shapes", () => {
  it("space in circle mode without anchor sets anchor", () => {
    const s = S({ mode: "circle", cursor: { x: 5, y: 5 } });
    const r = reduceInput(s, "space", gen);
    expect(r.state.anchor).toEqual({ x: 5, y: 5 });
    expect(r.emit).toBeNull();
  });

  it("space in circle mode with anchor emits draw circle", () => {
    const s = S({
      mode: "circle",
      cursor: { x: 8, y: 5 },
      anchor: { x: 5, y: 5 },
    });
    const r = reduceInput(s, "space", gen);
    expect(r.emit?.type).toBe("draw");
    if (r.emit?.type === "draw") {
      expect(r.emit.shape.kind).toBe("circle");
    }
    expect(r.state.anchor).toBeNull();
  });

  it("space in line mode without anchor sets anchor", () => {
    const s = S({ mode: "line", cursor: { x: 5, y: 5 } });
    const r = reduceInput(s, "space", gen);
    expect(r.state.anchor).toEqual({ x: 5, y: 5 });
    expect(r.emit).toBeNull();
  });

  it("space in line mode with anchor emits draw line", () => {
    const s = S({
      mode: "line",
      cursor: { x: 8, y: 5 },
      anchor: { x: 2, y: 5 },
    });
    const r = reduceInput(s, "space", gen);
    expect(r.emit?.type).toBe("draw");
    if (r.emit?.type === "draw") {
      expect(r.emit.shape.kind).toBe("line");
    }
  });

  it("space in square mode without anchor sets anchor", () => {
    const s = S({ mode: "square", cursor: { x: 3, y: 3 } });
    const r = reduceInput(s, "space", gen);
    expect(r.state.anchor).toEqual({ x: 3, y: 3 });
    expect(r.emit).toBeNull();
  });

  it("space in square mode with anchor emits draw square", () => {
    const s = S({
      mode: "square",
      cursor: { x: 8, y: 8 },
      anchor: { x: 3, y: 3 },
    });
    const r = reduceInput(s, "space", gen);
    expect(r.emit?.type).toBe("draw");
    if (r.emit?.type === "draw") {
      expect(r.emit.shape.kind).toBe("square");
    }
  });

  it("esc cancels pending anchor", () => {
    const s = S({ mode: "circle", anchor: { x: 5, y: 5 } });
    const r = reduceInput(s, "escape", gen);
    expect(r.state.anchor).toBeNull();
    expect(r.emit).toBeNull();
  });
});

describe("undo", () => {
  it("u emits undo of last own draw", () => {
    const s = S({ ownDraws: ["e1", "e2", "e3"] });
    const r = reduceInput(s, "u", gen);
    expect(r.emit?.type).toBe("undo");
    if (r.emit?.type === "undo") {
      expect(r.emit.targetId).toBe("e3");
    }
    expect(r.state.ownDraws).toEqual(["e1", "e2"]);
  });

  it("u with no prior own draws does nothing", () => {
    const s = S({ ownDraws: [] });
    const r = reduceInput(s, "u", gen);
    expect(r.emit).toBeNull();
    expect(r.state).toEqual(s);
  });
});

describe("clear", () => {
  it("x emits clear", () => {
    const r = reduceInput(S(), "x", gen);
    expect(r.emit?.type).toBe("clear");
  });
});

describe("quit", () => {
  it("q sets quit flag", () => {
    const r = reduceInput(S(), "q", gen);
    expect(r.quit).toBe(true);
  });
});

describe("purity", () => {
  it("reduceInput does not mutate the input state", () => {
    const s = S({ cursor: { x: 5, y: 5 } });
    const before = JSON.stringify(s);
    reduceInput(s, "j", gen);
    expect(JSON.stringify(s)).toBe(before);
  });
});
