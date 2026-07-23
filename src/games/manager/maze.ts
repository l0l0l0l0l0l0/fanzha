// ====================================================================
// 反诈职业经理人 · 迷宫地图系统（v5 分支图迷宫）
// 复杂迷宫：多节点 + 多边，敌人在岔路口随机/加权选路
// - 24×9 网格（v4 的 18×7 升级，路径更长更不规则）
// - 3 张手工分支迷宫（社区/市级/跨境）+ DFS 程序化生成（无尽/每日）
// - 岗哨位派生：路径相邻的非路径格（兼容旧逻辑）
// - 每个敌人生成时调用 randomPath() 取一条 entrance→exit 路径
// ====================================================================

import type { LevelTheme } from "./types";

/** 网格坐标 */
export interface Cell {
  col: number;
  row: number;
}

/** 像素坐标 */
export interface Pt {
  x: number;
  y: number;
}

/** 岗哨位：可放置守卫的格子（路径相邻的非路径格） */
export interface DeployTile {
  col: number;
  row: number;
  x: number;
  y: number;
}

/** 迷宫节点：入口/出口/岔路口 */
export interface MazeNode {
  id: number;
  col: number;
  row: number;
  x: number;
  y: number;
  kind: "entrance" | "exit" | "junction";
}

/** 迷宫边：连接两节点的路径段（cells 含起止节点格子） */
export interface MazeEdge {
  id: number;
  fromNodeId: number;
  toNodeId: number;
  /** 该边覆盖的格子序列（含起止节点格子，已去重） */
  cells: Cell[];
}

/** 迷宫定义（v5 分支图版，运行时只读） */
export interface MazeDef {
  id: string;
  name: string;
  accent: string;
  cols: number;
  rows: number;
  cellSize: number;
  offsetX: number;
  offsetY: number;

  // ===== 分支图结构 =====
  nodes: MazeNode[];
  edges: MazeEdge[];
  /** 邻接表：nodeId → nodeId[]（双向） */
  adjacency: Map<number, number[]>;
  entranceNodeId: number;
  exitNodeId: number;

  // ===== 派生数据（兼容旧 API） =====
  /** 所有路径格子的并集（任意边覆盖的格子，已去重，按遍历顺序） */
  pathCells: Cell[];
  /** 路径集合键 "c,r" → true */
  pathSet: Set<string>;
  /** 岗哨位列表（路径相邻、非路径） */
  deployTiles: DeployTile[];
  /** 岗哨集合键 "c,r" → DeployTile */
  deploySet: Map<string, DeployTile>;

  // ===== 兼容旧 API =====
  entrance: Cell;
  exit: Cell;
  entrancePt: Pt;
  exitPt: Pt;
  /** 主路径航点（保留兼容；engine 不再使用此字段移动敌人） */
  waypoints: Pt[];
}

// 引擎画布尺寸（与 engine.ts 一致）
export const MAZE_W = 960;
export const MAZE_H = 540;

// v5：网格参数 24×9（v4 为 18×7），cellSize 由 48 → 36 以适配更大网格
export const MAZE_CELL = 36;
export const MAZE_COLS = 24;
export const MAZE_ROWS = 9;
export const MAZE_OFFSET_X = 48;
export const MAZE_OFFSET_Y = 110;

/** 格子中心像素坐标 */
export function cellCenter(col: number, row: number): Pt {
  return {
    x: MAZE_OFFSET_X + col * MAZE_CELL + MAZE_CELL / 2,
    y: MAZE_OFFSET_Y + row * MAZE_CELL + MAZE_CELL / 2,
  };
}

/** 格子键 */
function key(col: number, row: number): string {
  return `${col},${row}`;
}

/** 8 方向偏移（用于岗哨位派生） */
const DIRS8: Array<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

// ====================================================================
// 路径展开工具
// ====================================================================

/**
 * 将拐角序列展开为连续路径格子（沿行/列轴线步进）
 * 每对相邻拐角必须共行或共列（否则走 L 形：先行后列）
 */
export function expandPath(corners: Cell[]): Cell[] {
  const cells: Cell[] = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i];
    const b = corners[i + 1];
    if (a.row === b.row) {
      const step = b.col > a.col ? 1 : -1;
      for (let c = a.col; c !== b.col + step; c += step) {
        cells.push({ col: c, row: a.row });
      }
    } else if (a.col === b.col) {
      const step = b.row > a.row ? 1 : -1;
      for (let r = a.row; r !== b.row + step; r += step) {
        cells.push({ col: a.col, row: r });
      }
    } else {
      // 非正交拐角：强制走 L 形（先行后列）
      const stepC = b.col > a.col ? 1 : -1;
      for (let c = a.col; c !== b.col + stepC; c += stepC) {
        cells.push({ col: c, row: a.row });
      }
      const stepR = b.row > a.row ? 1 : -1;
      for (let r = a.row + stepR; r !== b.row + stepR; r += stepR) {
        cells.push({ col: b.col, row: r });
      }
    }
  }
  // 去除连续重复
  const deduped: Cell[] = [];
  for (const c of cells) {
    const last = deduped[deduped.length - 1];
    if (!last || last.col !== c.col || last.row !== c.row) deduped.push(c);
  }
  return deduped;
}

/**
 * 从拐角序列构建一条边的格子序列（含起止节点格子，去重）
 */
function cellsFromCorners(corners: Cell[]): Cell[] {
  return expandPath(corners);
}

// ====================================================================
// 迷宫构建器
// ====================================================================

/** 边定义（手工迷宫用） */
interface EdgeDef {
  from: number; // 起点节点 id
  to: number;   // 终点节点 id
  corners: Cell[]; // 拐角序列（含起止节点格子）
}

/** 节点定义（手工迷宫用） */
interface NodeDef {
  id: number;
  cell: Cell;
  kind: "entrance" | "exit" | "junction";
}

/**
 * 构建迷宫：根据节点列表 + 边列表生成完整 MazeDef
 */
export function buildMaze(
  id: string,
  name: string,
  accent: string,
  nodeDefs: NodeDef[],
  edgeDefs: EdgeDef[],
): MazeDef {
  // 节点
  const nodes: MazeNode[] = nodeDefs.map((n) => {
    const pt = cellCenter(n.cell.col, n.cell.row);
    return { id: n.id, col: n.cell.col, row: n.cell.row, x: pt.x, y: pt.y, kind: n.kind };
  });
  const nodeMap = new Map<number, MazeNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // 边
  const edges: MazeEdge[] = edgeDefs.map((e, i) => {
    const cells = cellsFromCorners(e.corners);
    return { id: i, fromNodeId: e.from, toNodeId: e.to, cells };
  });

  // 邻接表
  const adjacency = new Map<number, number[]>();
  for (const n of nodes) adjacency.set(n.id, []);
  for (const e of edges) {
    adjacency.get(e.fromNodeId)?.push(e.toNodeId);
    adjacency.get(e.toNodeId)?.push(e.fromNodeId);
  }

  // 路径格子并集
  const pathSet = new Set<string>();
  const pathCells: Cell[] = [];
  for (const e of edges) {
    for (const c of e.cells) {
      const k = key(c.col, c.row);
      if (!pathSet.has(k)) {
        pathSet.add(k);
        pathCells.push(c);
      }
    }
  }

  // 入口/出口
  const entranceNode = nodes.find((n) => n.kind === "entrance") ?? nodes[0];
  const exitNode = nodes.find((n) => n.kind === "exit") ?? nodes[nodes.length - 1];
  const entrance: Cell = { col: entranceNode.col, row: entranceNode.row };
  const exit: Cell = { col: exitNode.col, row: exitNode.row };
  const entrancePt = cellCenter(entrance.col, entrance.row);
  const exitPt = cellCenter(exit.col, exit.row);

  // 主路径航点（兼容字段，取第一条 entrance→exit 路径）
  const primaryPath = randomPath(
    { adjacency, edges, nodeMap },
    entranceNode.id,
    exitNode.id,
    mulberry32(12345), // 固定种子保证可复现
  );
  const waypoints: Pt[] = primaryPath.map((c) => cellCenter(c.col, c.row));

  // 派生岗哨位：非路径格、在边界内、与任一路径格 8 邻接
  const deployTiles: DeployTile[] = [];
  const deploySet = new Map<string, DeployTile>();
  for (let r = 0; r < MAZE_ROWS; r++) {
    for (let c = 0; c < MAZE_COLS; c++) {
      if (pathSet.has(key(c, r))) continue;
      let adjacent = false;
      for (const [dc, dr] of DIRS8) {
        if (pathSet.has(key(c + dc, r + dr))) { adjacent = true; break; }
      }
      if (adjacent) {
        const pt = cellCenter(c, r);
        const tile: DeployTile = { col: c, row: r, x: pt.x, y: pt.y };
        deployTiles.push(tile);
        deploySet.set(key(c, r), tile);
      }
    }
  }

  return {
    id, name, accent,
    cols: MAZE_COLS, rows: MAZE_ROWS,
    cellSize: MAZE_CELL,
    offsetX: MAZE_OFFSET_X, offsetY: MAZE_OFFSET_Y,
    nodes, edges, adjacency,
    entranceNodeId: entranceNode.id,
    exitNodeId: exitNode.id,
    pathCells, pathSet,
    deployTiles, deploySet,
    entrance, exit, entrancePt, exitPt, waypoints,
  };
}

// ====================================================================
// 随机路径生成（敌人在岔路口选路）
// ====================================================================

interface GraphCtx {
  adjacency: Map<number, number[]>;
  edges: MazeEdge[];
  nodeMap: Map<number, MazeNode>;
}

/** Mulberry32 确定性伪随机 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 找到连接两个节点的边 */
function findEdge(ctx: GraphCtx, a: number, b: number): MazeEdge | undefined {
  return ctx.edges.find((e) =>
    (e.fromNodeId === a && e.toNodeId === b) ||
    (e.fromNodeId === b && e.toNodeId === a)
  );
}

/**
 * 从 startNodeId 到 endNodeId 走一条随机路径
 * - 在岔路口随机选未访问邻居（DFS + 随机化）
 * - 走死路时回溯
 * - 返回该路径覆盖的格子序列（已去重）
 */
export function randomPath(ctx: GraphCtx, startNodeId: number, endNodeId: number, rng: () => number): Cell[] {
  const visited = new Set<number>([startNodeId]);
  const nodePath: number[] = [startNodeId];
  let current = startNodeId;
  let safety = 200; // 防止死循环
  while (current !== endNodeId && safety-- > 0) {
    const neighbors = ctx.adjacency.get(current) ?? [];
    // 优先选未访问的邻居
    let candidates = neighbors.filter((n) => !visited.has(n));
    // 若全访问过，允许回访（避免卡死）
    if (candidates.length === 0) candidates = neighbors.slice();
    if (candidates.length === 0) {
      // 死路：回溯
      if (nodePath.length <= 1) break;
      nodePath.pop();
      current = nodePath[nodePath.length - 1];
      continue;
    }
    // 加权选择：距离 endNode 曼哈顿距离更近的节点优先（带随机扰动）
    const endNode = ctx.nodeMap.get(endNodeId);
    let next: number;
    if (endNode && candidates.length > 1) {
      const weights = candidates.map((cid) => {
        const cn = ctx.nodeMap.get(cid);
        if (!cn) return 1;
        const d = Math.abs(cn.col - endNode.col) + Math.abs(cn.row - endNode.row);
        // 距离越近权重越高（指数衰减）
        return Math.max(0.1, 2.5 - d * 0.15) + rng() * 0.5;
      });
      const total = weights.reduce((s, w) => s + w, 0);
      let pick = rng() * total;
      next = candidates[0];
      for (let i = 0; i < candidates.length; i++) {
        pick -= weights[i];
        if (pick <= 0) { next = candidates[i]; break; }
      }
    } else {
      next = candidates[Math.floor(rng() * candidates.length)];
    }
    nodePath.push(next);
    visited.add(next);
    current = next;
  }

  // 把 nodePath 转换为格子序列
  const cells: Cell[] = [];
  const cellSet = new Set<string>();
  for (let i = 0; i < nodePath.length - 1; i++) {
    const a = nodePath[i];
    const b = nodePath[i + 1];
    const edge = findEdge(ctx, a, b);
    if (!edge) continue;
    for (const c of edge.cells) {
      const k = key(c.col, c.row);
      if (!cellSet.has(k)) {
        cellSet.add(k);
        cells.push(c);
      }
    }
  }
  return cells;
}

/** 包装：为指定迷宫生成一条随机路径（rng 由调用方提供） */
export function pickRandomPath(maze: MazeDef, rng: () => number): Cell[] {
  return randomPath(
    { adjacency: maze.adjacency, edges: maze.edges, nodeMap: new Map(maze.nodes.map((n) => [n.id, n])) },
    maze.entranceNodeId,
    maze.exitNodeId,
    rng,
  );
}

// ====================================================================
// 3 张手工分支迷宫（24×9）
// ====================================================================

/**
 * 迷宫 1 · 社区反诈（v5：基础分支，1 个岔路口 + 1 条捷径）
 * 路径较长且不规则，2 条可选路线
 */
const MAZE_1_NODES: NodeDef[] = [
  { id: 0, cell: { col: 23, row: 0 }, kind: "entrance" }, // 入口（右上）
  { id: 1, cell: { col: 0, row: 0 },  kind: "junction" }, // 上路拐点
  { id: 2, cell: { col: 0, row: 4 },  kind: "junction" }, // 中岔路
  { id: 3, cell: { col: 23, row: 4 }, kind: "junction" }, // 右侧捷径交汇
  { id: 4, cell: { col: 12, row: 6 }, kind: "junction" }, // 中段绕行
  { id: 5, cell: { col: 0, row: 8 },  kind: "exit" },     // 出口（左下）
];
const MAZE_1_EDGES: EdgeDef[] = [
  // 0→1: 入口横移到左上
  { from: 0, to: 1, corners: [{ col: 23, row: 0 }, { col: 0, row: 0 }] },
  // 1→2: 左侧竖向下
  { from: 1, to: 2, corners: [{ col: 0, row: 0 }, { col: 0, row: 4 }] },
  // 2→4: 中段斜下绕行（不规则）
  { from: 2, to: 4, corners: [
    { col: 0, row: 4 }, { col: 6, row: 4 },
    { col: 6, row: 6 }, { col: 12, row: 6 },
  ]},
  // 4→5: 出口段
  { from: 4, to: 5, corners: [
    { col: 12, row: 6 }, { col: 6, row: 6 },
    { col: 6, row: 8 }, { col: 0, row: 8 },
  ]},
  // 2→3: 上捷径横移到右
  { from: 2, to: 3, corners: [{ col: 0, row: 4 }, { col: 23, row: 4 }] },
  // 3→4: 右侧绕行下到中段（捷径）
  { from: 3, to: 4, corners: [
    { col: 23, row: 4 }, { col: 18, row: 4 },
    { col: 18, row: 6 }, { col: 12, row: 6 },
  ]},
];

/**
 * 迷宫 2 · 市级反诈（v5：菱形分支，3 条可选路线）
 * 主路 + 上绕行 + 下绕行 + 中段捷径
 */
const MAZE_2_NODES: NodeDef[] = [
  { id: 0, cell: { col: 23, row: 4 }, kind: "entrance" }, // 入口（右中）
  { id: 1, cell: { col: 18, row: 4 }, kind: "junction" }, // 第一岔路
  { id: 2, cell: { col: 18, row: 1 }, kind: "junction" }, // 上路
  { id: 3, cell: { col: 18, row: 7 }, kind: "junction" }, // 下路
  { id: 4, cell: { col: 8, row: 1 },  kind: "junction" }, // 上路中段
  { id: 5, cell: { col: 8, row: 7 },  kind: "junction" }, // 下路中段
  { id: 6, cell: { col: 8, row: 4 },  kind: "junction" }, // 中路汇合
  { id: 7, cell: { col: 4, row: 4 },  kind: "junction" }, // 出口前
  { id: 8, cell: { col: 0, row: 4 },  kind: "exit" },     // 出口
];
const MAZE_2_EDGES: EdgeDef[] = [
  // 0→1: 入口到第一岔路
  { from: 0, to: 1, corners: [{ col: 23, row: 4 }, { col: 18, row: 4 }] },
  // 1→2: 上岔
  { from: 1, to: 2, corners: [{ col: 18, row: 4 }, { col: 18, row: 1 }] },
  // 1→3: 下岔
  { from: 1, to: 3, corners: [{ col: 18, row: 4 }, { col: 18, row: 7 }] },
  // 2→4: 上路横移
  { from: 2, to: 4, corners: [{ col: 18, row: 1 }, { col: 8, row: 1 }] },
  // 3→5: 下路横移
  { from: 3, to: 5, corners: [{ col: 18, row: 7 }, { col: 8, row: 7 }] },
  // 4→6: 上路下行汇合
  { from: 4, to: 6, corners: [{ col: 8, row: 1 }, { col: 8, row: 4 }] },
  // 5→6: 下路上行汇合
  { from: 5, to: 6, corners: [{ col: 8, row: 7 }, { col: 8, row: 4 }] },
  // 1→6: 中路捷径（短路径，诱惑敌人走捷径）
  { from: 1, to: 6, corners: [{ col: 18, row: 4 }, { col: 8, row: 4 }] },
  // 6→7: 汇合后向左
  { from: 6, to: 7, corners: [{ col: 8, row: 4 }, { col: 4, row: 4 }] },
  // 7→8: 出口
  { from: 7, to: 8, corners: [{ col: 4, row: 4 }, { col: 0, row: 4 }] },
];

/**
 * 迷宫 3 · 跨境反诈（v5：最复杂，4+ 条路线 + 死路绕行）
 * 多岔路口 + 不规则折返 + 3 个分支
 */
const MAZE_3_NODES: NodeDef[] = [
  { id: 0,  cell: { col: 23, row: 0 }, kind: "entrance" }, // 入口（右上）
  { id: 1,  cell: { col: 23, row: 3 }, kind: "junction" }, // 入口下岔
  { id: 2,  cell: { col: 16, row: 0 }, kind: "junction" }, // 上路起点
  { id: 3,  cell: { col: 16, row: 4 }, kind: "junction" }, // 中路起点
  { id: 4,  cell: { col: 16, row: 7 }, kind: "junction" }, // 下路起点
  { id: 5,  cell: { col: 8, row: 0 },  kind: "junction" }, // 上路中
  { id: 6,  cell: { col: 8, row: 4 },  kind: "junction" }, // 中路中（核心枢纽）
  { id: 7,  cell: { col: 8, row: 7 },  kind: "junction" }, // 下路中
  { id: 8,  cell: { col: 4, row: 2 },  kind: "junction" }, // 上汇合
  { id: 9,  cell: { col: 4, row: 6 },  kind: "junction" }, // 下汇合
  { id: 10, cell: { col: 0, row: 4 },  kind: "exit" },     // 出口
  { id: 11, cell: { col: 12, row: 2 }, kind: "junction" }, // 死路陷阱（上）
  { id: 12, cell: { col: 12, row: 6 }, kind: "junction" }, // 死路陷阱（下）
];
const MAZE_3_EDGES: EdgeDef[] = [
  // 0→1: 入口下行
  { from: 0, to: 1, corners: [{ col: 23, row: 0 }, { col: 23, row: 3 }] },
  // 1→2: 上行到上路
  { from: 1, to: 2, corners: [{ col: 23, row: 3 }, { col: 23, row: 0 }, { col: 16, row: 0 }] },
  // 1→3: 中行
  { from: 1, to: 3, corners: [{ col: 23, row: 3 }, { col: 16, row: 3 }, { col: 16, row: 4 }] },
  // 1→4: 下行到下路
  { from: 1, to: 4, corners: [{ col: 23, row: 3 }, { col: 23, row: 7 }, { col: 16, row: 7 }] },
  // 2→5: 上路横移
  { from: 2, to: 5, corners: [{ col: 16, row: 0 }, { col: 8, row: 0 }] },
  // 3→6: 中路横移
  { from: 3, to: 6, corners: [{ col: 16, row: 4 }, { col: 8, row: 4 }] },
  // 4→7: 下路横移
  { from: 4, to: 7, corners: [{ col: 16, row: 7 }, { col: 8, row: 7 }] },
  // 2→11: 上路死路陷阱
  { from: 2, to: 11, corners: [{ col: 16, row: 0 }, { col: 12, row: 0 }, { col: 12, row: 2 }] },
  // 4→12: 下路死路陷阱
  { from: 4, to: 12, corners: [{ col: 16, row: 7 }, { col: 12, row: 7 }, { col: 12, row: 6 }] },
  // 11→6: 死路连中路（绕远但可达）
  { from: 11, to: 6, corners: [{ col: 12, row: 2 }, { col: 12, row: 4 }, { col: 8, row: 4 }] },
  // 12→6: 死路连中路（绕远但可达）
  { from: 12, to: 6, corners: [{ col: 12, row: 6 }, { col: 12, row: 4 }, { col: 8, row: 4 }] },
  // 5→8: 上路汇合（不规则折下）
  { from: 5, to: 8, corners: [
    { col: 8, row: 0 }, { col: 4, row: 0 },
    { col: 4, row: 2 },
  ]},
  // 6→8: 中路上行
  { from: 6, to: 8, corners: [{ col: 8, row: 4 }, { col: 4, row: 4 }, { col: 4, row: 2 }] },
  // 7→9: 下路汇合
  { from: 7, to: 9, corners: [
    { col: 8, row: 7 }, { col: 4, row: 7 },
    { col: 4, row: 6 },
  ]},
  // 6→9: 中路下行
  { from: 6, to: 9, corners: [{ col: 8, row: 4 }, { col: 4, row: 4 }, { col: 4, row: 6 }] },
  // 8→10: 上汇合到出口
  { from: 8, to: 10, corners: [{ col: 4, row: 2 }, { col: 4, row: 4 }, { col: 0, row: 4 }] },
  // 9→10: 下汇合到出口
  { from: 9, to: 10, corners: [{ col: 4, row: 6 }, { col: 4, row: 4 }, { col: 0, row: 4 }] },
];

/** 构建好的 3 张手工迷宫（按关卡 1/2/3 索引） */
export const STATIC_MAZES: MazeDef[] = [
  buildMaze("maze_residential", "社区防骗阵线", "#52C41A", MAZE_1_NODES, MAZE_1_EDGES),
  buildMaze("maze_city", "都市反诈中枢", "#FFB020", MAZE_2_NODES, MAZE_2_EDGES),
  buildMaze("maze_border", "跨境电诈围剿线", "#E5353B", MAZE_3_NODES, MAZE_3_EDGES),
];

// ====================================================================
// 反诈术语系统：每个路径格子展示一句朗朗上口的反诈口诀
// - 玩家在战斗中持续 exposure 到反诈常识
// - 36 句精选短术语（4-6 字），按格子坐标确定性分配，避免闪烁
// ====================================================================

/**
 * 36 句反诈术语（4-6 字，朗朗上口易传播）
 * 涵盖刷单/杀猪盘/公检法/客服/钓鱼/贷款/征信/网恋/AI/两卡等主流诈骗类型
 */
export const MAZE_TERMS: string[] = [
  "不点陌生链",
  "不扫陌生码",
  "拨96110核",
  "刷单即诈骗",
  "安全账户假",
  "公检法不电办",
  "稳赚必是坑",
  "先交钱是骗",
  "拒屏幕共享",
  "验证码不泄",
  "不裸聊不点",
  "贷款先收费",
  "征信不能修",
  "退款走官方",
  "客服不主动",
  "投资认持牌",
  "网恋不转账",
  "熟人先核实",
  "AI换脸核实",
  "不租售两卡",
  "助学金不转",
  "退费不下载",
  "中奖先付费",
  "低价游有坑",
  "慈善不返利",
  "拍卖不预费",
  "ETC过期假",
  "百万保障免",
  "提额要验证",
  "退改签官方",
  "神药不治病",
  "境外高薪假",
  "军警不私聊",
  "不信红头文",
  "核实再转账",
  "挂断拨110",
];

/**
 * 根据格子坐标确定性选取一句反诈术语
 * - 同一格子始终返回同一句（避免帧间闪烁）
 * - 用 col/row 哈希打散，保证术语在迷宫中均匀分布
 */
export function cellTerm(col: number, row: number): string {
  // 简易哈希：col * 31 + row * 17，保证不同格子尽量不同术语
  const h = (col * 31 + row * 17 + col * row) >>> 0;
  return MAZE_TERMS[h % MAZE_TERMS.length];
}

// ====================================================================
// 程序化生成（无尽 / 每日）—— DFS 递归回溯生成真迷宫
// ====================================================================

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/**
 * 程序化生成分支迷宫（DFS 递归回溯算法）
 * - 在 24×9 网格上以 2 步为单位挖通路（标准迷宫生成）
 * - 入口固定在右上，出口固定在左下
 * - 每条边都是直线段，便于岗哨位派生
 * - 随机打通若干墙增加分支（避免单解迷宫）
 */
export function generateMaze(seed: string, accent = "#B388FF"): MazeDef {
  const rng = mulberry32(hashSeed(seed));
  // 单元网格：cols/rows 必须为奇数才能用标准 DFS（用 col 1,3,5... 作为节点）
  // 简化：直接用所有格子做随机 DFS（每步 2 格保持墙厚度）
  const W = MAZE_COLS;
  const H = MAZE_ROWS;
  // visited 标记
  const visited: boolean[][] = [];
  for (let r = 0; r < H; r++) {
    visited.push(new Array(W).fill(false));
  }
  // 节点列表（岔路口 + 端点）
  const nodeDefs: NodeDef[] = [];
  const cellToNodeId = new Map<string, number>();
  let nextNodeId = 0;
  const addNode = (cell: Cell, kind: "entrance" | "exit" | "junction"): number => {
    const k = key(cell.col, cell.row);
    const existing = cellToNodeId.get(k);
    if (existing !== undefined) return existing;
    const id = nextNodeId++;
    nodeDefs.push({ id, cell, kind });
    cellToNodeId.set(k, id);
    return id;
  };

  // 起点：右上
  const startCell = { col: W - 1, row: 0 };
  visited[0][W - 1] = true;
  addNode(startCell, "entrance");

  // DFS 栈
  const stack: Cell[] = [startCell];
  // 已挖通路（cell 集合）
  const carved = new Set<string>([key(startCell.col, startCell.row)]);
  // 边定义（用拐角序列记录）
  const edgeDefs: EdgeDef[] = [];

  // 4 方向（每次跳 2 格）
  const dirs: Array<[number, number]> = [[0, -2], [0, 2], [-2, 0], [2, 0]];

  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    // 找未访问的邻居（2 格之外）
    const shuffled = dirs.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    let moved = false;
    for (const [dc, dr] of shuffled) {
      const nc = cur.col + dc;
      const nr = cur.row + dr;
      if (nc < 0 || nc >= W || nr < 0 || nr >= H) continue;
      if (visited[nr][nc]) continue;
      // 挖通：中间格子 + 目标格子
      const midC = cur.col + dc / 2;
      const midR = cur.row + dr / 2;
      const midCell = { col: midC, row: midR };
      const targetCell = { col: nc, row: nr };
      carved.add(key(midC, midR));
      carved.add(key(nc, nr));
      visited[nr][nc] = true;
      // 边：cur → targetCell（含中间格）
      const fromId = addNode(cur, "junction");
      const toId = addNode(targetCell, "junction");
      edgeDefs.push({ from: fromId, to: toId, corners: [cur, midCell, targetCell] });
      stack.push(targetCell);
      moved = true;
      break;
    }
    if (!moved) stack.pop();
  }

  // 出口：左下
  const exitCell = { col: 0, row: H - 1 };
  if (!carved.has(key(exitCell.col, exitCell.row))) {
    // 强制挖到出口
    let cx = exitCell.col, cy = exitCell.row;
    carved.add(key(cx, cy));
    while (cx < W - 1) {
      cx++;
      carved.add(key(cx, cy));
    }
    // 添加边：从出口到 (W-1, H-1)
    const exitNodeId = addNode(exitCell, "exit");
    const bridgeEnd = { col: W - 1, row: H - 1 };
    const bridgeEndId = addNode(bridgeEnd, "junction");
    edgeDefs.push({ from: exitNodeId, to: bridgeEndId, corners: [exitCell, bridgeEnd] });
  } else {
    addNode(exitCell, "exit");
  }
  // 入口节点 kind 修正
  const entNode = nodeDefs.find((n) => n.cell.col === startCell.col && n.cell.row === startCell.row);
  if (entNode) entNode.kind = "entrance";

  // 随机打通若干墙增加分支（loop）
  const loopCount = 3 + Math.floor(rng() * 4); // 3..6 个额外连通
  for (let i = 0; i < loopCount; i++) {
    const c = 1 + Math.floor(rng() * (W - 2));
    const r = 1 + Math.floor(rng() * (H - 2));
    // 选 4 邻居中已 carved 的两个，连一条边
    const neighbors: Cell[] = [];
    for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nc >= W || nr < 0 || nr >= H) continue;
      if (carved.has(key(nc, nr))) neighbors.push({ col: nc, row: nr });
    }
    if (neighbors.length >= 2) {
      // 选两个邻居连边（通过当前格子）
      const a = neighbors[Math.floor(rng() * neighbors.length)];
      let b = neighbors[Math.floor(rng() * neighbors.length)];
      let tries = 0;
      while ((b.col === a.col && b.row === a.row) && tries++ < 5) {
        b = neighbors[Math.floor(rng() * neighbors.length)];
      }
      if (b.col !== a.col || b.row !== a.row) {
        const aId = addNode(a, "junction");
        const bId = addNode(b, "junction");
        // 边 a → (c,r) → b
        edgeDefs.push({ from: aId, to: bId, corners: [a, { col: c, row: r }, b] });
        carved.add(key(c, r));
      }
    }
  }

  // 修正节点 kind：未标 entrance/exit 的全为 junction
  for (const n of nodeDefs) {
    if (n.kind === "entrance" || n.kind === "exit") continue;
    n.kind = "junction";
  }

  return buildMaze(`maze_proc_${seed}`, "随机迷宫", accent, nodeDefs, edgeDefs);
}

// ====================================================================
// 按模式/关卡选取迷宫
// ====================================================================

/**
 * 获取初始迷宫
 * - classic/daily：按当前关卡取手工迷宫
 * - timeTrial：迷宫 2（市级，中等复杂度）
 * - bossRush：迷宫 3（跨境，最长路径，BOSS 追击感）
 * - endlessRush：程序化（随机种子）
 */
export function getInitialMaze(
  mode: string,
  level: number,
  seed: string,
): MazeDef {
  switch (mode) {
    case "timeTrial":
      return STATIC_MAZES[1];
    case "bossRush":
      return STATIC_MAZES[2];
    case "endlessRush":
      return generateMaze(seed, "#B388FF");
    default:
      return STATIC_MAZES[Math.max(0, Math.min(STATIC_MAZES.length - 1, level - 1))];
  }
}

/** classic/daily 关卡推进时取下一关迷宫 */
export function getLevelMaze(level: number): MazeDef {
  return STATIC_MAZES[Math.max(0, Math.min(STATIC_MAZES.length - 1, level - 1))];
}

/** 关卡主题 → 迷宫主题色映射（保留兼容） */
export function mazeThemeForLevel(level: number): LevelTheme | undefined {
  return undefined;
}

/**
 * 将守卫格子重映射到新迷宫的最近有效岗哨位
 * 用于 classic/daily 关卡推进时迷宫切换
 */
export function remapSlotsToMaze(
  oldSlots: { col: number; row: number; agentId: string | null }[],
  newMaze: MazeDef,
): { col: number; row: number; agentId: string | null }[] {
  const used = new Set<string>();
  const result: { col: number; row: number; agentId: string | null }[] = [];
  const available = newMaze.deployTiles.slice();

  for (const s of oldSlots) {
    if (!s.agentId) continue;
    const k = key(s.col, s.row);
    if (newMaze.deploySet.has(k) && !used.has(k)) {
      used.add(k);
      result.push({ col: s.col, row: s.row, agentId: s.agentId });
      continue;
    }
    let best: DeployTile | null = null;
    let bestDist = Infinity;
    for (const t of available) {
      const tk = key(t.col, t.row);
      if (used.has(tk)) continue;
      const d = Math.abs(t.col - s.col) + Math.abs(t.row - s.row);
      if (d < bestDist) { bestDist = d; best = t; }
    }
    if (best) {
      const bk = key(best.col, best.row);
      used.add(bk);
      result.push({ col: best.col, row: best.row, agentId: s.agentId });
    }
  }
  return result;
}
