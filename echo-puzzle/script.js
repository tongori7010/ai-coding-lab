const TILE = {
  FLOOR: ".",
  WALL: "#",
  HOLE: "O",
  RIGHT: ">",
  LEFT: "<",
  UP: "^",
  DOWN: "v",
};

const MOVES = {
  ArrowUp: { dx: 0, dy: -1, mark: "^" },
  KeyW: { dx: 0, dy: -1, mark: "^" },
  ArrowDown: { dx: 0, dy: 1, mark: "v" },
  KeyS: { dx: 0, dy: 1, mark: "v" },
  ArrowLeft: { dx: -1, dy: 0, mark: "<" },
  KeyA: { dx: -1, dy: 0, mark: "<" },
  ArrowRight: { dx: 1, dy: 0, mark: ">" },
  KeyD: { dx: 1, dy: 0, mark: ">" },
};

const TEST_MOVES = {
  U: MOVES.ArrowUp,
  D: MOVES.ArrowDown,
  L: MOVES.ArrowLeft,
  R: MOVES.ArrowRight,
};

const STAGES = [
  {
    name: "1: 追従の基本",
    goal: "右、右でクリア。壁入力でプレイヤーが待ち、残響だけが進むことを学ぶ。",
    map: ["#######", "#.....#", "#ES.PS#", "#.....#", "#######"],
    testSolution: "RR",
  },
  {
    name: "2: 壁で待つ",
    goal: "壁を待機に使い、残響を遅れてスイッチへ乗せる。",
    map: ["#########", "#.......#", "#ES.PS#.#", "#.#####.#", "#.......#", "#########"],
    testSolution: "RR",
  },
  {
    name: "3: 穴を避ける",
    goal: "穴のある盤面で、残響も安全な通路を通す。",
    map: ["#########", "#O.....O#", "#ES.PS#.#", "#..O.O..#", "#.......#", "#########"],
    testSolution: "RR",
  },
  {
    name: "4: 一方通行床",
    goal: "残響が一方通行床から右へ出てスイッチに乗る。",
    map: ["########", "#......#", "#E>S.PS#", "#...^..#", "#......#", "########"],
    testSolution: "RRR",
  },
  {
    name: "5: 総合問題",
    goal: "壁、穴、一方通行床をまとめて確認する。",
    map: ["#########", "#O.....O#", "#.E>S.PS#", "#.#O.O#.#", "#...^...#", "#.......#", "#########"],
    testSolution: "RRR",
  },
];

let game = null;

function parseStage(stage) {
  const switches = [];
  let player = null;
  let echo = null;
  const grid = stage.map.map((row, y) => [...row].map((tile, x) => {
    if (tile === "P") {
      player = { x, y };
      return TILE.FLOOR;
    }
    if (tile === "E") {
      echo = { x, y };
      return TILE.FLOOR;
    }
    if (tile === "S") {
      switches.push({ x, y });
      return TILE.FLOOR;
    }
    return tile;
  }));

  return {
    grid,
    switches,
    player,
    echo,
    pendingEchoMove: null,
    lost: false,
    won: false,
  };
}

function samePosition(a, b) {
  return a.x === b.x && a.y === b.y;
}

function tileAt(state, pos) {
  return state.grid[pos.y]?.[pos.x] ?? TILE.WALL;
}

function canLeaveTile(state, pos, move) {
  const tile = tileAt(state, pos);
  if (tile === TILE.RIGHT) return move.mark === ">";
  if (tile === TILE.LEFT) return move.mark === "<";
  if (tile === TILE.UP) return move.mark === "^";
  if (tile === TILE.DOWN) return move.mark === "v";
  return true;
}

function moveActor(state, actor, move) {
  if (!move || !canLeaveTile(state, actor, move)) return { ...actor };
  const next = { x: actor.x + move.dx, y: actor.y + move.dy };
  if (tileAt(state, next) === TILE.WALL) return { ...actor };
  return next;
}

function applyTurn(state, playerMove) {
  const echoMove = state.pendingEchoMove;
  const nextState = {
    ...state,
    player: moveActor(state, state.player, playerMove),
    echo: moveActor(state, state.echo, echoMove),
    pendingEchoMove: playerMove,
  };
  const fell = tileAt(nextState, nextState.player) === TILE.HOLE || tileAt(nextState, nextState.echo) === TILE.HOLE;
  const clear = nextState.switches.every((sw) => samePosition(sw, nextState.player) || samePosition(sw, nextState.echo)) && !samePosition(nextState.player, nextState.echo);
  return { ...nextState, lost: fell, won: clear };
}

function simulateStage(stage) {
  let state = parseStage(stage);
  for (const command of stage.testSolution) {
    const move = TEST_MOVES[command];
    if (!move) throw new Error(`Unknown test command: ${command}`);
    state = applyTurn(state, move);
    if (state.lost) break;
  }
  return {
    stage: stage.name,
    solution: stage.testSolution,
    clear: state.won,
    lost: state.lost,
    player: state.player,
    echo: state.echo,
    switches: state.switches,
  };
}

function runStageSelfTests() {
  return STAGES.map(simulateStage);
}

function createGame(documentRef) {
  const board = documentRef.getElementById("board");
  const stageLabel = documentRef.getElementById("stageLabel");
  const stageGoal = documentRef.getElementById("stageGoal");
  const message = documentRef.getElementById("message");
  let stageIndex = 0;
  let state = parseStage(STAGES[stageIndex]);

  function restart(text = "リスタートしました。") {
    state = parseStage(STAGES[stageIndex]);
    message.textContent = text;
    render();
  }

  function nextStage() {
    if (stageIndex < STAGES.length - 1) {
      stageIndex += 1;
      restart("次のステージです。");
    }
  }

  function handleMove(move) {
    if (state.lost || state.won) return;
    state = applyTurn(state, move);
    if (state.lost) {
      message.textContent = "穴に落ちました。Rでやり直してください。";
    } else if (state.won) {
      message.textContent = stageIndex === STAGES.length - 1 ? "全ステージクリア！" : "クリア！次へ進みます。";
      window.setTimeout(nextStage, 800);
    } else {
      message.textContent = "";
    }
    render();
  }

  function render() {
    const stage = STAGES[stageIndex];
    stageLabel.textContent = `${stage.name} (${stageIndex + 1}/${STAGES.length})`;
    stageGoal.textContent = stage.goal;
    board.innerHTML = "";
    board.style.gridTemplateColumns = `repeat(${state.grid[0].length}, 1fr)`;

    state.grid.forEach((row, y) => {
      row.forEach((tile, x) => {
        const cell = documentRef.createElement("div");
        cell.className = "cell";
        if (tile === TILE.WALL) cell.classList.add("wall");
        if (tile === TILE.HOLE) cell.classList.add("hole");
        if ([TILE.RIGHT, TILE.LEFT, TILE.UP, TILE.DOWN].includes(tile)) {
          cell.classList.add("oneway");
          cell.textContent = tile;
        }
        if (state.switches.some((sw) => sw.x === x && sw.y === y)) {
          cell.classList.add("switch");
          if (samePosition(state.player, { x, y }) || samePosition(state.echo, { x, y })) cell.classList.add("on");
        }
        const playerHere = samePosition(state.player, { x, y });
        const echoHere = samePosition(state.echo, { x, y });
        if (echoHere) cell.appendChild(makeActor("echo", playerHere));
        if (playerHere) cell.appendChild(makeActor("player", echoHere));
        board.appendChild(cell);
      });
    });
  }

  function makeActor(kind, split) {
    const actor = documentRef.createElement("div");
    actor.className = `actor ${kind} ${split ? `split-${kind}` : ""}`;
    actor.textContent = kind === "player" ? "P" : "E";
    return actor;
  }

  documentRef.addEventListener("keydown", (event) => {
    if (event.code === "KeyR") {
      event.preventDefault();
      restart();
      return;
    }
    const move = MOVES[event.code];
    if (move) {
      event.preventDefault();
      handleMove(move);
    }
  });

  restart("矢印キーまたはWASDで移動してください。");
  return { restart, handleMove, runStageSelfTests };
}

if (typeof document !== "undefined") {
  const results = runStageSelfTests();
  if (!results.every((result) => result.clear)) {
    console.error("Stage self-test failed", results);
  }
  game = createGame(document);
}

if (typeof module !== "undefined") {
  module.exports = { STAGES, parseStage, applyTurn, runStageSelfTests };
}
