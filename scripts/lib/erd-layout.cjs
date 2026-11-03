// Keep tables in aligned rows, with dedicated routing lanes in the empty gutters.
// Coordinates include exact orthogonal waypoints; draw.io only paints crossing jumps.
const HEADER = 28;
const ROW = 22;
const TRACK = 10;
const PADDING = 12;

// Non-overlapping intervals can reuse a lane without merging relationship lines.
function allocateTracks(tasks) {
  const ends = [];
  tasks.sort((a, b) => a.from - b.from || a.to - b.to);
  for (const task of tasks) {
    let lane = ends.findIndex((end) => end < task.from);
    if (lane < 0) lane = ends.length;
    ends[lane] = task.to;
    for (const field of task.fields) task.edge[field] = lane;
  }
  return ends.length;
}

function layoutErd(tables) {
  const tableMap = new Map(tables.map((table) => [table.id, table]));
  const nameWidth = Math.max(210, ...tables.flatMap((t) => t.columns.map((c) => c.name.length * 8 + 20)));
  const typeWidth = Math.max(180, ...tables.flatMap((t) => t.columns.map((c) => c.type.length * 8 + 20)));
  const width = Math.max(78 + nameWidth + typeWidth, ...tables.map((t) => t.name.length * 8 + 30));
  const colCount = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(tables.length))));
  const rowCount = Math.ceil(tables.length / colCount);
  const edges = tables.flatMap((child) => child.constraints.filter((k) => k.type === 'f' && tableMap.has(k.target_id))
    .map((fk) => ({ child, parent: tableMap.get(fk.target_id), fk })));
  const neighbors = new Map(tables.map((table) => [table.id, []]));
  for (const edge of edges) {
    neighbors.get(edge.parent.id).push(edge.child.id);
    neighbors.get(edge.child.id).push(edge.parent.id);
  }
  const positions = new Map();
  const distance = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
  const estimatedHeight = new Map(tables.map((table) => [table.id, HEADER + table.columns.reduce((sum, column) => {
    const count = edges.filter((e) => (e.parent.id === table.id && e.fk.target_columns[0] === column.position)
      || (e.child.id === table.id && e.fk.columns[0] === column.position)).length;
    return sum + ROW + Math.max(0, Math.ceil(count / 2) - 1) * 8;
  }, 0)]));
  const sorted = [...tables].sort((a, b) => estimatedHeight.get(b.id) - estimatedHeight.get(a.id)
    || neighbors.get(b.id).length - neighbors.get(a.id).length || a.name.localeCompare(b.name));
  // Similar-height tables share a row so shorter tables do not leave tall empty holes.
  for (let row = 0; row < rowCount; row++) {
    const pending = sorted.slice(row * colCount, (row + 1) * colCount);
    const free = pending.map((_, col) => ({ row, col }));
    while (pending.length) {
      const priority = (t) => neighbors.get(t.id).filter((id) => positions.has(id)).length * 1000 + neighbors.get(t.id).length;
      pending.sort((a, b) => priority(b) - priority(a) || a.name.localeCompare(b.name));
      const table = pending.shift();
      const adjacent = neighbors.get(table.id).filter((id) => positions.has(id));
      const cost = (slot) => adjacent.reduce((sum, id) => sum + distance(slot, positions.get(id)), 0)
        + Math.abs(slot.col - (colCount - 1) / 2) * 0.05;
      free.sort((a, b) => cost(a) - cost(b) || a.col - b.col);
      positions.set(table.id, { ...free.shift(), width });
    }
  }
  // Improve locality while charging for any extra row height introduced by a swap.
  const placementCost = () => {
    const heights = Array(rowCount).fill(0);
    for (const table of tables) {
      const row = positions.get(table.id).row;
      heights[row] = Math.max(heights[row], estimatedHeight.get(table.id));
    }
    return heights.reduce((a, b) => a + b, 0)
      + edges.reduce((sum, e) => sum + distance(positions.get(e.parent.id), positions.get(e.child.id)) * 14, 0);
  };
  let bestCost = placementCost();
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < tables.length; i++) for (let j = i + 1; j < tables.length; j++) {
    const a = tables[i].id, b = tables[j].id;
    const pa = positions.get(a), pb = positions.get(b);
    positions.set(a, pb); positions.set(b, pa);
    const cost = placementCost();
    if (cost < bestCost) bestCost = cost;
    else { positions.set(a, pa); positions.set(b, pb); }
  }

  const gutters = Array.from({ length: colCount + 1 }, () => []);
  const gaps = Array.from({ length: rowCount + 1 }, () => []);
  for (const edge of edges) {
    const source = positions.get(edge.parent.id);
    const target = positions.get(edge.child.id);
    if (source.col === target.col) {
      edge.sourceSide = edge.targetSide = gutters[source.col].length <= gutters[source.col + 1].length ? 0 : 1;
    } else {
      edge.sourceSide = source.col < target.col ? 1 : 0;
      edge.targetSide = 1 - edge.sourceSide;
    }
    edge.sourceGutter = source.col + edge.sourceSide;
    edge.targetGutter = target.col + edge.targetSide;
    edge.sourceLane = gutters[edge.sourceGutter].length;
    gutters[edge.sourceGutter].push(edge);
    if (edge.sourceGutter === edge.targetGutter) edge.targetLane = edge.sourceLane;
    else {
      edge.targetLane = gutters[edge.targetGutter].length;
      gutters[edge.targetGutter].push(edge);
      const candidates = source.row === target.row ? [source.row, source.row + 1]
        : Array.from({ length: Math.abs(source.row - target.row) }, (_, i) => Math.min(source.row, target.row) + i + 1);
      candidates.sort((a, b) => gaps[a].length - gaps[b].length
        || Math.abs(a - (source.row + target.row + 1) / 2) - Math.abs(b - (source.row + target.row + 1) / 2));
      edge.gap = candidates[0];
      edge.horizontalLane = gaps[edge.gap].length;
      gaps[edge.gap].push(edge);
    }
  }
  const gutterTracks = gutters.map((_, gutter) => allocateTracks(edges.flatMap((edge) => {
    const source = positions.get(edge.parent.id), target = positions.get(edge.child.id);
    if (edge.sourceGutter === gutter && edge.targetGutter === gutter) return [{ edge,
      from: Math.min(source.row,target.row), to: Math.max(source.row,target.row), fields: ['sourceLane','targetLane'] }];
    const tasks = [];
    for (const [end, box] of [['source',source],['target',target]]) if (edge[`${end}Gutter`] === gutter) {
      tasks.push({ edge, from: Math.min(box.row,edge.gap - 0.5),
        to: Math.max(box.row,edge.gap - 0.5), fields: [`${end}Lane`] });
    }
    return tasks;
  })));
  const gapTracks = gaps.map((routes) => allocateTracks(routes.map((edge) => ({ edge,
    from: Math.min(edge.sourceGutter,edge.targetGutter), to: Math.max(edge.sourceGutter,edge.targetGutter), fields: ['horizontalLane'] }))));
  const ports = new Map();
  for (const edge of edges) for (const end of ['source', 'target']) {
    const table = end === 'source' ? edge.parent : edge.child;
    const column = end === 'source' ? edge.fk.target_columns[0] : edge.fk.columns[0];
    const key = `${table.id}:${column}:${edge[`${end}Side`]}`;
    if (!ports.has(key)) ports.set(key, []);
    ports.get(key).push({ edge, end });
  }
  const rowHeights = Array(rowCount).fill(0);
  for (const table of tables) {
    const box = positions.get(table.id);
    let top = HEADER;
    box.columns = new Map();
    for (const column of table.columns) {
      const fanout = Math.max(ports.get(`${table.id}:${column.position}:0`)?.length || 0,
        ports.get(`${table.id}:${column.position}:1`)?.length || 0);
      const height = Math.max(ROW, ROW + (fanout - 1) * 8);
      box.columns.set(column.position, { top, height });
      top += height;
    }
    box.height = top;
    rowHeights[box.row] = Math.max(rowHeights[box.row], top);
  }
  const gutterX = [];
  let x = 20;
  for (let col = 0; col <= colCount; col++) {
    gutterX.push(x);
    x += Math.max(col === 0 || col === colCount ? 28 : 56, PADDING * 2 + gutterTracks[col] * TRACK);
    for (const box of positions.values()) if (box.col === col) box.x = x;
    if (col < colCount) x += width;
  }
  const gapY = [];
  let y = 84;
  for (let row = 0; row <= rowCount; row++) {
    gapY.push(y);
    y += Math.max(row === 0 || row === rowCount ? 24 : 40, PADDING * 2 + gapTracks[row] * TRACK);
    for (const box of positions.values()) if (box.row === row) box.y = y;
    if (row < rowCount) y += rowHeights[row];
  }
  const occupiedPortY = gutters.map(() => []);
  // Separate opposing horizontal stubs in the same gutter as well as fan-outs.
  for (const [key, endpoints] of ports) endpoints.forEach(({ edge, end }, index) => {
    const table = end === 'source' ? edge.parent : edge.child;
    const column = end === 'source' ? edge.fk.target_columns[0] : edge.fk.columns[0];
    const box = positions.get(table.id);
    const band = box.columns.get(column);
    if (!band) throw new Error(`Missing endpoint column ${key}`);
    const low = box.y + band.top + 5;
    const high = box.y + band.top + band.height - 5;
    const preferred = box.y + band.top + band.height * (index + 1) / (endpoints.length + 1);
    const reserved = occupiedPortY[edge[`${end}Gutter`]];
    let portY;
    for (let offset = 0; offset <= band.height; offset += 3) {
      for (const sign of [1, -1]) {
        const candidate = Math.round(preferred + offset * sign);
        if (candidate >= low && candidate <= high && !reserved.some((p) => p.edge !== edge && Math.abs(p.y - candidate) < 3)) {
          portY = candidate; break;
        }
      }
      if (portY !== undefined) break;
    }
    if (portY === undefined) throw new Error(`Insufficient endpoint space for ${key}`);
    reserved.push({ y: portY, edge });
    edge[`${end}Y`] = portY;
    edge[`${end}Fraction`] = (portY - box.y - band.top) / band.height;
  });
  for (const edge of edges) {
    const source = positions.get(edge.parent.id);
    const target = positions.get(edge.child.id);
    const sx = gutterX[edge.sourceGutter] + PADDING + edge.sourceLane * TRACK;
    const tx = gutterX[edge.targetGutter] + PADDING + edge.targetLane * TRACK;
    const points = [{ x: source.x + edge.sourceSide * width, y: edge.sourceY }, { x: sx, y: edge.sourceY }];
    if (edge.sourceGutter !== edge.targetGutter) {
      const hy = gapY[edge.gap] + PADDING + edge.horizontalLane * TRACK;
      points.push({ x: sx, y: hy }, { x: tx, y: hy });
    }
    points.push({ x: tx, y: edge.targetY }, { x: target.x + edge.targetSide * width, y: edge.targetY });
    edge.points = points.filter((point, index) => !index || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
  }
  return { positions, edges, width, nameWidth, typeWidth, totalWidth: x + 20, totalHeight: y + 20 };
}

module.exports = { layoutErd, HEADER };
