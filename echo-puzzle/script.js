const TILE = {
  FLOOR: ".",
  WALL: "#",
  HOLE: "O",
  RIGHT: ">",
  LEFT: "<",
  UP: "^",
  DOWN: "v",
};

const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1, symbol: "^" },
  KeyW: { x: 0, y: -1, symbol: "^" },
  ArrowDown: { x: 0, y: 1, symbol: "v" },
  KeyS: { x: 0, y: 1, symbol: "v" },
  ArrowLeft: { x: -1, y: 0, symbol: "<" },
  KeyA: { x: -1, y: 0, symbol: "<" },
  ArrowRight: { x: 1, y: 0, symbol: ">" },
  KeyD: { x: 1, y: 0, symbol: ">" },
};

// Keep each testSolution in sync with the map so merge-conflict resolutions preserve solvable stages.
const STAGES = [
  {
    name: "1: 追従の基本",
    goal: "右へ進んだあと、壁に向かってもう一度入力すると残響が左スイッチに乗ることを学ぶ。",
    map: ["#######", "#.....#", "#ES.PS#", "#.....#", "#######"],
    testSolution: "RR",
const STAGES = [
  {
    name: "1: 追従の基本",
    goal: "右へ進み、壁に当たって待つと残響が追いつくことを学ぶ。",
    map: ["########", "#......#", "#.SEPS.#", "#......#", "########"],
  },
  {
    name: "2: 壁で距離を作る",
    goal: "壁沿いに進んで、最後は壁を待機に使う。",
    map: ["#########", "#.......#", "#ES.PS#.#", "#.#####.#", "#.......#", "#########"],
    testSolution: "RR",
    map: ["#########", "#.......#", "#.#SEPS.#", "#.#.###.#", "#.......#", "#########"],
  },
  {
    name: "3: 穴を避ける",
    goal: "安全な通路で待ち、残響を穴へ誘導しないことを学ぶ。",
    map: ["#########", "#O.....O#", "#ES.PS#.#", "#..O.O..#", "#.......#", "#########"],
    testSolution: "RR",
    map: ["#########", "#O.....O#", "#..SEPS.#", "#..O.O..#", "#.......#", "#########"],
  },
  {
    name: "4: 一方通行床",
    goal: "一方通行床は矢印方向にだけ出られることを使う。",
    map: ["########", "#......#", "#E>S.PS#", "#...^..#", "#......#", "########"],
    testSolution: "RRR",
    map: ["########", "#......#", "#.E>SPS#", "#...^..#", "#......#", "########"],
  },
  {
    name: "5: 総合問題",
    goal: "壁・穴・一方通行床を読み、待機で同時押しを完成させる。",
    map: ["#########", "#O.....O#", "#.E>S.PS#", "#.#O.O#.#", "#...^...#", "#.......#", "#########"],
    testSolution: "RRR",
  },
];

const hasDocument = typeof document !== "undefined";
const board = hasDocument ? document.getElementById("board") : null;
const stageLabel = hasDocument ? document.getElementById("stageLabel") : null;
const stageGoal = hasDocument ? document.getElementById("stageGoal") : null;
const message = hasDocument ? document.getElementById("message") : null;
    map: ["#########", "#O.....O#", "#..E>SPS#", "#.#O.O#.#", "#...^...#", "#.......#", "#########"],
  },
];

const board = document.getElementById("board");
const stageLabel = document.getElementById("stageLabel");
const stageGoal = document.getElementById("stageGoal");
const message = document.getElementById("message");

let stageIndex = 0;
let state;

function parseStage(stage) {
  const switches = [];
  let player;
  let echo;
  const grid = stage.map.map((row, y) => [...row].map((char, x) => {
    if (char === "P") { player = { x, y }; return TILE.FLOOR; }
    if (char === "E") { echo = { x, y }; return TILE.FLOOR; }
    if (char === "S") { switches.push({ x, y }); return TILE.FLOOR; }
    return char;
  }));
  return { grid, switches, player, echo, pendingEchoMove: null, lost: false, won: false };
}

function restartStage(text = "リスタートしました。") {
  state = parseStage(STAGES[stageIndex]);
  message.textContent = text;
  render();
}

function tileAt(pos) {
  return state.grid[pos.y]?.[pos.x] ?? TILE.WALL;
}

function canLeave(pos, move) {
  const tile = tileAt(pos);
  if (tile === TILE.RIGHT) return move.symbol === ">";
  if (tile === TILE.LEFT) return move.symbol === "<";
  if (tile === TILE.UP) return move.symbol === "^";
  if (tile === TILE.DOWN) return move.symbol === "v";
  return true;
}

function moveActor(actor, move) {
  if (!move || !canLeave(actor, move)) return { ...actor };
  const next = { x: actor.x + move.x, y: actor.y + move.y };
  if (tileAt(next) === TILE.WALL) return { ...actor };
  return next;
}

function same(a, b) { return a.x === b.x && a.y === b.y; }

function isOnSwitch(pos) { return state.switches.some((sw) => same(sw, pos)); }

function checkHazards() {
  if (tileAt(state.player) === TILE.HOLE || tileAt(state.echo) === TILE.HOLE) {
    state.lost = true;
    message.textContent = "穴に落ちました。Rキーでやり直してください。";
  }
}

function checkClear() {
  const covered = state.switches.every((sw) => same(sw, state.player) || same(sw, state.echo));
  const separateActors = !same(state.player, state.echo);
  if (covered && separateActors) {
    state.won = true;
    message.textContent = stageIndex === STAGES.length - 1
      ? "全ステージクリア！Rで最終ステージを再挑戦できます。"
      : "クリア！次のステージへ進みます。";
    if (stageIndex < STAGES.length - 1) {
      window.setTimeout(() => { stageIndex += 1; restartStage("次のステージです。"); }, 900);
    }
  }
}

function moveFromTestCommand(command) {
  const moves = {
    U: DIRECTIONS.ArrowUp,
    D: DIRECTIONS.ArrowDown,
    L: DIRECTIONS.ArrowLeft,
    R: DIRECTIONS.ArrowRight,
  };
  return moves[command];
}

function simulateStageSolution(stage) {
  const previousState = state;
  state = parseStage(stage);

  for (const command of stage.testSolution) {
    const move = moveFromTestCommand(command);
    if (!move) throw new Error(`Unknown test command: ${command}`);
    const echoMove = state.pendingEchoMove;
    state.player = moveActor(state.player, move);
    state.echo = moveActor(state.echo, echoMove);
    state.pendingEchoMove = move;

    if (tileAt(state.player) === TILE.HOLE || tileAt(state.echo) === TILE.HOLE) {
      const result = { stage: stage.name, solution: stage.testSolution, clear: false, reason: "actor fell into a hole" };
      state = previousState;
      return result;
    }
  }

  const clear = state.switches.every((sw) => same(sw, state.player) || same(sw, state.echo)) && !same(state.player, state.echo);
  const result = {
    stage: stage.name,
    solution: stage.testSolution,
    clear,
    player: { ...state.player },
    echo: { ...state.echo },
    switches: state.switches.map((sw) => ({ ...sw })),
    reason: clear ? "clear" : "switches not covered",
  };
  state = previousState;
  return result;
}

function runStageSelfTests() {
  return STAGES.map(simulateStageSolution);
}

function handleMove(move) {
  if (state.lost || state.won) return;
  const echoMove = state.pendingEchoMove;
  state.player = moveActor(state.player, move);
  state.echo = moveActor(state.echo, echoMove);
  state.pendingEchoMove = move;
  message.textContent = isOnSwitch(state.player) || isOnSwitch(state.echo)
    ? "スイッチを踏んでいます。2つ同時に押そう。"
    : "";
  checkHazards();
  if (!state.lost) checkClear();
  render();
}

function render() {
  const stage = STAGES[stageIndex];
  stageLabel.textContent = `${stage.name} (${stageIndex + 1}/${STAGES.length})`;
  stageGoal.textContent = stage.goal;
  board.style.gridTemplateColumns = `repeat(${state.grid[0].length}, 1fr)`;
  board.innerHTML = "";

  state.grid.forEach((row, y) => row.forEach((tile, x) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    if (tile === TILE.WALL) cell.classList.add("wall");
    if (tile === TILE.HOLE) cell.classList.add("hole");
    if ([TILE.RIGHT, TILE.LEFT, TILE.UP, TILE.DOWN].includes(tile)) {
      cell.classList.add("oneway");
      cell.textContent = tile;
    }
    if (state.switches.some((sw) => sw.x === x && sw.y === y)) {
      cell.classList.add("switch", (same(state.player, { x, y }) || same(state.echo, { x, y })) ? "on" : "off");
    }
    if (state.won && state.switches.some((sw) => sw.x === x && sw.y === y)) cell.classList.add("goal");

    const both = same(state.player, state.echo) && same(state.player, { x, y });
    if (same(state.echo, { x, y })) cell.appendChild(actor("echo", both));
    if (same(state.player, { x, y })) cell.appendChild(actor("player", both));
    board.appendChild(cell);
  }));
}

function actor(kind, both) {
  const el = document.createElement("div");
  el.className = `actor ${kind}${both ? " both" : ""}`;
  el.textContent = kind === "player" ? "P" : "E";
  return el;
}

if (hasDocument) {
  const selfTestResults = runStageSelfTests();
  if (selfTestResults.some((result) => !result.clear)) {
    console.error("Stage self-test failed", selfTestResults);
  }

  document.addEventListener("keydown", (event) => {
    if (event.code === "KeyR") {
      event.preventDefault();
      restartStage();
      return;
    }
    const move = DIRECTIONS[event.code];
    if (move) {
      event.preventDefault();
      handleMove(move);
    }
  });

  restartStage("矢印キーまたはWASDで移動してください。");
}

if (typeof module !== "undefined") {
  module.exports = { STAGES, runStageSelfTests };
}
document.addEventListener("keydown", (event) => {
  if (event.code === "KeyR") {
    event.preventDefault();
    restartStage();
    return;
  }
  const move = DIRECTIONS[event.code];
  if (move) {
    event.preventDefault();
    handleMove(move);
  }
});

restartStage("矢印キーまたはWASDで移動してください。");
