const fs = require("fs");
const R = require("ramda");

const input = fs.readFileSync("day15.input.txt", "utf8").trim();

const newPlayer = (type, x, y, elfCombatPoints) => ({
  type,
  x,
  y,
  combatPoints: type === "E" ? elfCombatPoints : 3,
  hitpoints: 200
});

const mapIndexed = R.addIndex(R.map);
const cellToPlayer = (cell, x, y, elfCombatPoints) =>
  cell === "E" || cell === "G"
    ? newPlayer(cell, x, y, elfCombatPoints)
    : undefined;

const linesToPlayers = elfCombatPoints =>
  R.pipe(
    mapIndexed((row, y) =>
      mapIndexed((cell, x) => cellToPlayer(cell, x, y, elfCombatPoints), row)
    ),
    R.flatten,
    R.reject(R.isNil)
  );

function parseInput(input, elfCombatPoints) {
  const inputToLines = R.split("\n");
  const toCell = c => (c === "#" ? "#" : ".");
  const linesToGrid = R.map(
    R.pipe(
      R.split(""),
      R.map(toCell)
    )
  );

  const lines = inputToLines(input);
  return {
    grid: linesToGrid(lines),
    players: linesToPlayers(elfCombatPoints)(lines)
  };
}

const numGridRows = grid => grid.length;
const numGridCols = grid => grid[0].length;

const compareCoords = (a, b) => (a.y - b.y !== 0 ? a.y - b.y : a.x - b.x);
const sortByCoord = xs => [...xs].sort(compareCoords);
const sortByHitPoints = xs => [...xs].sort((a, b) => a.hitpoints - b.hitpoints);

const isPosInGrid = (cols, rows) => pos =>
  pos.x >= 0 && pos.x < cols && pos.y >= 0 && pos.y < rows;

const isPosCoveredByWall = grid => pos => grid[pos.y][pos.x] === ".";

const isPosWithNoPlayer = players => pos =>
  !players.some(player => player.x === pos.x && player.y === pos.y);

// Given a coordinate, finds free adjacent positions to it.
const findAdjacentPositions = (x, y, state) =>
  [
    { x: x - 1, y: y },
    { x: x + 1, y: y },
    { x: x, y: y - 1 },
    { x: x, y: y + 1 }
  ]
    .filter(isPosInGrid(numGridCols(state.grid), numGridRows(state.grid)))
    .filter(isPosCoveredByWall(state.grid))
    .filter(isPosWithNoPlayer(state.players));

// Finds positions from which a player of the given type (elf or goblin) can be attacked from.
const findAttackPositions = (state, targetType) =>
  R.pipe(
    R.prop("players"),
    R.filter(R.propEq("type", targetType)),
    R.chain(({ x, y }) => findAdjacentPositions(x, y, state))
  );

// Given a player type, returns the type of the player's enemy.
function enemyType(type) {
  switch (type) {
    case "E":
      return "G";
    case "G":
      return "E";
    default:
      throw new Error(`invalid type: '${type}'`);
  }
}

// Returns whether there are still targets of the given player left on the field.
const isEnemyOf = p1 => p2 => enemyType(p1.type) === p2.type;
const areTargetsLeft = (state, player) => state.players.some(isEnemyOf(player));

// Calculates the Manhattan distance between two coordinates.
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// Finds enemies a player can (from his current position) attack.
const findAttackableEnemies = (state, player) =>
  state.players
    .filter(isEnemyOf(player))
    .filter(t => distance(t, player) === 1);

// Given the current state, a start position and a set of target positions, calculates the preferred
// next move the player could make.
function findNextMove(state, start, targets) {
  if (targets.length === 0) {
    return null;
  }

  // Calculate and mark initial positions.
  const grid = R.map(R.map(R.always(null)), state.grid);

  // TODO: Remove loop
  let currentPositions = targets.map(t => ({ x: t.x, y: t.y }));
  for (const curPos of currentPositions) {
    // TODO: Remove mutation
    grid[curPos.y][curPos.x] = 0;
  }
  grid[start.y][start.x] = -1;

  // TODO: Remove loops and mutation
  for (let iteration = 1; ; ++iteration) {
    const newPositions = [];
    const finalPositions = [];

    for (const curPos of currentPositions) {
      if (distance(curPos, start) === 1) {
        finalPositions.push(curPos);
      } else {
        for (const adjacent of findAdjacentPositions(
          curPos.x,
          curPos.y,
          state
        )) {
          if (grid[adjacent.y][adjacent.x] === null) {
            // Not yet visited.
            grid[adjacent.y][adjacent.x] = iteration;
            newPositions.push(adjacent);
          }
        }
      }
    }

    // If any of the new positions is the start position, we're done.
    if (finalPositions.length > 0) {
      // Return preferred coordinate.
      return sortByCoord(finalPositions)[0];
    }

    // If no new possible positions have been added, there obviously is no path to any of the targets.
    if (newPositions.length === 0) {
      return null;
    }

    currentPositions = newPositions;
  }
}

// Moves a player closer to the best suitable enemy.
function moveTowardsEnemy(state, player) {
  const nextStep = findNextMove(
    state,
    player,
    findAttackPositions(state, enemyType(player.type))(state)
  );

  // TODO: Remove mutation of player
  if (nextStep) {
    player.x = nextStep.x;
    player.y = nextStep.y;
  }
}

// If required, moves a given player towards the best possible enemies.
// If a direct attack is possible, the player is not moved.
function moveIfRequired(state, player) {
  const attackable = findAttackableEnemies(state, player);
  if (attackable.length === 0) {
    moveTowardsEnemy(state, player);
  }
}

// Calculates the fight between an attacker and a defendent.
function fight(attacker, defendent) {
  // TODO: Remove mutation
  defendent.hitpoints -= attacker.combatPoints;
}

// Lets one player act (withing a round).
function act(state, player) {
  if (!areTargetsLeft(state, player)) {
    return false;
  }

  moveIfRequired(state, player);

  const attackable = findAttackableEnemies(state, player);
  if (attackable.length === 0) {
    return true;
  }

  const attackPriorities = sortByHitPoints(sortByCoord(attackable));
  const target = attackPriorities[0];

  fight(player, target);

  if (target.hitpoints <= 0) {
    // Remove killed player.
    // TODO: Remove mutation
    state.players = state.players.filter(p => p !== target);
  }

  return true;
}

function round(state) {
  // Determine order of players in this round.
  const players = sortByCoord(state.players);

  for (const player of players) {
    // Is player still in the game? It could already have been killed.
    if (state.players.indexOf(player) !== -1) {
      if (!act(state, player)) {
        return false;
      }
    }
  }

  return true;
}

const combat = (state, i = 0) => (round(state) ? combat(state, i + 1) : i);

const totalPlayerHitPoints = R.pipe(
  R.map(R.prop("hitpoints")),
  R.sum
);

const outcome = (players, iterations) =>
  iterations * totalPlayerHitPoints(players);

const part1 = () => {
  const state = parseInput(input, 3);
  const iterations = combat(state);
  return outcome(state.players, iterations);
};

const isElv = R.propEq("type", "E");
const countElves = R.pipe(
  R.filter(isElv),
  R.length
);

const part2 = (combatPoints = 4) => {
  const state = parseInput(input, combatPoints);
  const numInitialElves = countElves(state.players);

  const iterations = combat(state);
  const numFinalElves = countElves(state.players);

  return numFinalElves === numInitialElves
    ? outcome(state.players, iterations)
    : part2(combatPoints + 1);
};

module.exports = { part1, part2 };