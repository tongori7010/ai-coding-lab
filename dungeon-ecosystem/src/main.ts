import './style.css';

const COLS = 20;
const ROWS = 12;
const CELL = 34;
const INVASION_TIME = 75;
const TICK_SECONDS = 0.28;

type Cell = { dug: boolean; nutrient: number; room?: 'entrance' | 'lord' };
type Species = 'microbe' | 'small' | 'large';
type GameState = 'preparing' | 'invaded' | 'won' | 'lost';
type Creature = { id: number; species: Species; x: number; y: number; hp: number; atk: number; hunger: number; age: number };
type Hero = { x: number; y: number; hp: number; atk: number; path: Point[]; stepCooldown: number };
type Point = { x: number; y: number };

const speciesStats: Record<Species, { hp: number; atk: number; hunger: number; color: string; label: string }> = {
  microbe: { hp: 3, atk: 0, hunger: 30, color: '#75dd72', label: '微' },
  small: { hp: 12, atk: 3, hunger: 38, color: '#8cc8ff', label: '小' },
  large: { hp: 30, atk: 8, hunger: 48, color: '#e78bff', label: '大' },
};

let grid: Cell[][] = [];
let creatures: Creature[] = [];
let hero: Hero | null = null;
let demonLordHp = 40;
let state: GameState = 'preparing';
let message = '';
let debug = false;
let nextCreatureId = 1;
let timeLeft = INVASION_TIME;
let tickBank = 0;
let lastTime = 0;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found');
app.innerHTML = `
  <div class="layout">
    <div class="board-wrap"><canvas id="game" width="${COLS * CELL}" height="${ROWS * CELL}"></canvas></div>
    <aside class="panel">
      <h1>Dungeon Ecosystem</h1>
      <div class="stat"><span>侵入まで</span><strong id="time"></strong></div>
      <div class="stat"><span>微小生物</span><strong id="microbes"></strong></div>
      <div class="stat"><span>小型魔物</span><strong id="small"></strong></div>
      <div class="stat"><span>大型魔物</span><strong id="large"></strong></div>
      <div class="stat"><span>勇者HP</span><strong id="heroHp"></strong></div>
      <div class="stat"><span>魔王HP</span><strong id="lordHp"></strong></div>
      <div class="message" id="message"></div>
      <div class="controls">
        <button id="reset">最初から（R）</button>
        <button class="secondary" id="debug">デバッグ表示（D）</button>
      </div>
      <div class="legend">
        クリック: 土を掘る / <span class="kbd">R</span>: リセット / <span class="kbd">D</span>: 栄養・HP・空腹表示<br />
        茶=土、黒=通路、緑=微小生物、青=小型魔物、紫=大型魔物、白=勇者、赤=魔王。
      </div>
    </aside>
  </div>`;

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;
if (!canvas || !ctx) throw new Error('Canvas not available');

function reset(): void {
  grid = Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) => ({
    dug: false,
    nutrient: Math.max(0, Math.round(6 + seededNoise(x, y) * 6 - Math.abs(y - 6))),
  })));
  creatures = [];
  hero = null;
  demonLordHp = 40;
  state = 'preparing';
  message = '土を掘って通路を伸ばし、周辺の栄養から生態系を育てよう。掘りすぎると勇者が一直線に来ます。';
  nextCreatureId = 1;
  timeLeft = INVASION_TIME;
  tickBank = 0;
  grid[0][0] = { dug: true, nutrient: 0, room: 'entrance' };
  grid[ROWS - 1][COLS - 1] = { dug: true, nutrient: 0, room: 'lord' };
  for (let i = 0; i < 7; i++) dig(1 + i, 0, false);
  for (let i = 0; i < 5; i++) dig(COLS - 2 - i, ROWS - 1, false);
  spawn('microbe', 3, 0);
  spawn('microbe', COLS - 4, ROWS - 1);
}

function seededNoise(x: number, y: number): number {
  return ((Math.sin(x * 41.7 + y * 93.1) * 10000) % 1 + 1) % 1;
}

function dig(x: number, y: number, byPlayer = true): void {
  const cell = grid[y]?.[x];
  if (!cell || cell.room || cell.dug || state === 'won' || state === 'lost') return;
  cell.dug = true;
  let released = 0;
  for (const n of neighbors(x, y)) {
    const c = grid[n.y][n.x];
    if (!c.dug) {
      c.nutrient = Math.min(15, c.nutrient + 2);
      released += c.nutrient;
    }
  }
  if (byPlayer && released > 18 && creatures.filter(c => c.species === 'microbe').length < 18) spawn('microbe', x, y);
}

function spawn(species: Species, x: number, y: number): void {
  const s = speciesStats[species];
  creatures.push({ id: nextCreatureId++, species, x, y, hp: s.hp, atk: s.atk, hunger: s.hunger, age: 0 });
}

function neighbors(x: number, y: number): Point[] {
  return [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }].filter(p => p.x >= 0 && p.y >= 0 && p.x < COLS && p.y < ROWS);
}

function passable(p: Point): boolean { return grid[p.y][p.x].dug; }
function same(a: Point, b: Point): boolean { return a.x === b.x && a.y === b.y; }

function step(): void {
  if (state === 'won' || state === 'lost') return;
  if (state === 'preparing') {
    timeLeft -= TICK_SECONDS;
    if (timeLeft <= 0) invade();
  }
  ecosystemStep();
  heroStep();
  updateUi();
}

function ecosystemStep(): void {
  for (const c of [...creatures]) {
    c.age += 1;
    c.hunger -= 1;
    if (c.species === 'microbe') microbeStep(c);
    else predatorStep(c, c.species === 'small' ? 'microbe' : 'small');
    if (c.hunger < -18) c.hp -= 2;
  }
  creatures = creatures.filter(c => c.hp > 0);
  if (creatures.filter(c => c.species === 'small').length < 10 && creatures.filter(c => c.species === 'microbe').length > 7 && Math.random() < 0.09) evolve('microbe', 'small');
  if (creatures.filter(c => c.species === 'large').length < 5 && creatures.filter(c => c.species === 'small').length > 4 && Math.random() < 0.06) evolve('small', 'large');
}

function microbeStep(c: Creature): void {
  const nearbyNutrition = neighbors(c.x, c.y).reduce((sum, p) => sum + grid[p.y][p.x].nutrient, 0);
  if (nearbyNutrition > 10 && Math.random() < 0.18 && creatures.filter(m => m.species === 'microbe').length < 30) {
    const choices = neighbors(c.x, c.y).filter(passable);
    const target = choices[Math.floor(Math.random() * choices.length)] ?? c;
    spawn('microbe', target.x, target.y);
    c.hunger = speciesStats.microbe.hunger;
    const rich = neighbors(c.x, c.y).sort((a, b) => grid[b.y][b.x].nutrient - grid[a.y][a.x].nutrient)[0];
    if (rich) grid[rich.y][rich.x].nutrient = Math.max(0, grid[rich.y][rich.x].nutrient - 1);
  }
  wander(c);
}

function predatorStep(c: Creature, prey: Species): void {
  const target = nearest(c, creatures.filter(o => o.species === prey));
  if (target && distance(c, target) <= 1) {
    target.hp -= c.atk || 2;
    if (target.hp <= 0) c.hunger = speciesStats[c.species].hunger;
  } else if (target) moveToward(c, target);
  else wander(c);
}

function evolve(from: Species, to: Species): void {
  const source = creatures.find(c => c.species === from);
  if (!source) return;
  source.hp = 0;
  spawn(to, source.x, source.y);
}

function wander(c: Creature): void {
  const choices = neighbors(c.x, c.y).filter(passable);
  const target = choices[Math.floor(Math.random() * choices.length)];
  if (target) { c.x = target.x; c.y = target.y; }
}

function moveToward(c: Creature, target: Point): void {
  const path = findPath(c, target);
  if (path[1]) { c.x = path[1].x; c.y = path[1].y; }
}

function nearest<T extends Point>(origin: Point, targets: T[]): T | undefined {
  return targets.sort((a, b) => distance(origin, a) - distance(origin, b))[0];
}
function distance(a: Point, b: Point): number { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

function invade(): void {
  state = 'invaded';
  hero = { x: 0, y: 0, hp: 70, atk: 7, path: [], stepCooldown: 0 };
  message = '勇者が入口から侵入しました。大型魔物が育っていれば足止めできます。';
}

function heroStep(): void {
  if (!hero || state !== 'invaded') return;
  const foes = creatures.filter(c => same(c, hero!));
  if (foes.length > 0) {
    const foe = foes.sort((a, b) => (b.species === 'large' ? 1 : 0) - (a.species === 'large' ? 1 : 0))[0];
    foe.hp -= hero.atk;
    hero.hp -= foe.atk;
    if (hero.hp <= 0) { state = 'won'; message = '勇者を倒しました。生態系の勝利です！'; }
    return;
  }
  hero.stepCooldown -= 1;
  if (hero.stepCooldown > 0) return;
  hero.path = findPath(hero, { x: COLS - 1, y: ROWS - 1 });
  if (hero.path.length === 0) return;
  const next = hero.path[1];
  if (next) { hero.x = next.x; hero.y = next.y; hero.stepCooldown = Math.max(1, Math.floor(hero.path.length / 12)); }
  if (hero.x === COLS - 1 && hero.y === ROWS - 1) {
    demonLordHp -= 10;
    if (demonLordHp <= 0) { state = 'lost'; message = '魔王の部屋に到達されました。掘る経路を絞り、生物を増やしましょう。'; }
  }
}

function findPath(start: Point, goal: Point): Point[] {
  const queue: Point[] = [start];
  const came = new Map<string, string>();
  const key = (p: Point) => `${p.x},${p.y}`;
  came.set(key(start), '');
  while (queue.length) {
    const cur = queue.shift()!;
    if (same(cur, goal)) break;
    for (const n of neighbors(cur.x, cur.y).filter(passable)) {
      if (!came.has(key(n))) { came.set(key(n), key(cur)); queue.push(n); }
    }
  }
  if (!came.has(key(goal))) return [];
  const path: Point[] = [];
  let k = key(goal);
  while (k) {
    const [x, y] = k.split(',').map(Number);
    path.unshift({ x, y });
    k = came.get(k) ?? '';
  }
  return path;
}

function draw(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) drawCell(x, y);
  if (hero?.path) drawPath(hero.path);
  for (const c of creatures) drawCreature(c);
  if (hero) drawHero(hero);
  drawLord();
}

function drawCell(x: number, y: number): void {
  const c = grid[y][x];
  ctx.fillStyle = c.dug ? '#11100f' : `rgb(${80 + c.nutrient * 8}, ${52 + c.nutrient * 4}, 28)`;
  ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  ctx.strokeStyle = '#33261d'; ctx.strokeRect(x * CELL, y * CELL, CELL, CELL);
  if (c.room === 'entrance') { ctx.fillStyle = '#ddd'; ctx.fillText('入', x * CELL + 11, y * CELL + 22); }
  if (debug) { ctx.fillStyle = '#ffe8a0'; ctx.font = '11px monospace'; ctx.fillText(String(c.nutrient), x * CELL + 2, y * CELL + 12); }
}

function drawPath(path: Point[]): void {
  ctx.fillStyle = '#ffffff22';
  for (const p of path) ctx.fillRect(p.x * CELL + 10, p.y * CELL + 10, 14, 14);
}

function drawCreature(c: Creature): void {
  const s = speciesStats[c.species];
  ctx.fillStyle = s.color;
  ctx.beginPath(); ctx.arc(c.x * CELL + CELL / 2, c.y * CELL + CELL / 2, c.species === 'large' ? 12 : 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#08100a'; ctx.font = '12px sans-serif'; ctx.fillText(s.label, c.x * CELL + 12, c.y * CELL + 21);
  if (debug) { ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.fillText(`${c.hp}/${c.hunger}`, c.x * CELL + 1, c.y * CELL + 32); }
}

function drawHero(h: Hero): void {
  ctx.fillStyle = '#f8f8f8'; ctx.fillRect(h.x * CELL + 8, h.y * CELL + 6, 18, 22);
  ctx.fillStyle = '#222'; ctx.fillText('勇', h.x * CELL + 11, h.y * CELL + 22);
}

function drawLord(): void {
  ctx.fillStyle = '#e04444'; ctx.fillRect((COLS - 1) * CELL + 6, (ROWS - 1) * CELL + 6, 22, 22);
  ctx.fillStyle = '#fff0d0'; ctx.fillText('魔', (COLS - 1) * CELL + 10, (ROWS - 1) * CELL + 22);
}

function updateUi(): void {
  setText('time', state === 'preparing' ? `${Math.ceil(timeLeft)}秒` : '侵入中');
  setText('microbes', String(creatures.filter(c => c.species === 'microbe').length));
  setText('small', String(creatures.filter(c => c.species === 'small').length));
  setText('large', String(creatures.filter(c => c.species === 'large').length));
  setText('heroHp', hero ? String(Math.max(0, hero.hp)) : '-');
  setText('lordHp', String(Math.max(0, demonLordHp)));
  setText('message', message);
}
function setText(id: string, value: string): void { const el = document.querySelector(`#${id}`); if (el) el.textContent = value; }

canvas.addEventListener('click', event => {
  const rect = canvas.getBoundingClientRect();
  dig(Math.floor((event.clientX - rect.left) / CELL), Math.floor((event.clientY - rect.top) / CELL));
});
document.querySelector('#reset')?.addEventListener('click', reset);
document.querySelector('#debug')?.addEventListener('click', () => { debug = !debug; });
window.addEventListener('keydown', event => {
  if (event.key.toLowerCase() === 'r') reset();
  if (event.key.toLowerCase() === 'd') debug = !debug;
});

function loop(now: number): void {
  const delta = Math.min(0.1, (now - lastTime) / 1000 || 0);
  lastTime = now;
  tickBank += delta;
  while (tickBank > TICK_SECONDS) { step(); tickBank -= TICK_SECONDS; }
  draw();
  requestAnimationFrame(loop);
}

reset();
updateUi();
requestAnimationFrame(loop);
