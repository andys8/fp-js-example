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

function parseInput(input, elfCombatPoints) {
  const lines = input.split("\n");
  const numRows = lines.length;
  const numColumns = lines[0].length; // all rows have equal length

  // The grid, containg walls and free spaces. Movable entites are not part of it.
  const grid = new Array(numRows)
    .fill()
    .map(_ => new Array(numColumns).fill("."));

  let x = 0,
    y = 0;

  const players = [];

  for (const row of lines) {
    x = 0;
    for (let cell of row) {
      switch (cell) {
        case "#":
          // A wall
          grid[y][x] = cell;
          break;

        case "E":
        case "G":
          players.push(newPlayer(cell, x, y, elfCombatPoints));
          break;
      }

      ++x;
    }
    ++y;
  }

  return { grid, numRows, numColumns, players };
}

const compareCoords = (a, b) => (a.y - b.y !== 0 ? a.y - b.y : a.x - b.x);
const sortByCoord = xs => [...xs].sort(compareCoords);
const sortByHitPoints = xs => [...xs].sort((a, b) => a.hitpoints - b.hitpoints);

// Given a coordinate, finds free adjacent positions to it.
function findAdjacentPositions(x, y, state) {
  const positions = [
    { x: x - 1, y: y },
    { x: x + 1, y: y },
    { x: x, y: y - 1 },
    { x: x, y: y + 1 }
  ]
    .filter(
      pos =>
        pos.x >= 0 &&
        pos.x < state.numColumns &&
        pos.y >= 0 &&
        pos.y < state.numRows
    ) // must be within grid
    .filter(pos => state.grid[pos.y][pos.x] === ".") // must not be covered by a wall
    .filter(
      pos =>
        !state.players.some(player => player.x === pos.x && player.y === pos.y)
    ); // no player must be on that position
  return positions;
}

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
const distance = (x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2);

// Finds enemies a player can (from his current position) attack.
const findAttackableEnemies = (state, player) =>
  state.players
    .filter(isEnemyOf(player))
    .filter(t => distance(t.x, t.y, player.x, player.y) === 1);

// Given the current state, a start position and a set of target positions, calculates the preferred
// next move the player could make.
function findNextMove(state, start, targets) {
  if (targets.length === 0) {
    return null;
  }

  const grid = new Array(state.numRows)
    .fill()
    .map(_ => new Array(state.numColumns).fill(null));

  // Calculate and mark initial positions.
  let currentPositions = targets.map(t => ({ x: t.x, y: t.y }));
  for (const curPos of currentPositions) {
    grid[curPos.y][curPos.x] = 0;
  }
  grid[start.y][start.x] = -1;

  for (let iteration = 1; ; ++iteration) {
    // console.log(grid.map(row => row.map(cell => {
    //     if (cell === null) return '.';
    //     if (cell === -1) return 'S';
    //     return cell;
    // }).join('')).join('\n'), '\n\n');
    let newPositions = [];
    let finalPositions = [];

    for (const curPos of currentPositions) {
      if (distance(curPos.x, curPos.y, start.x, start.y) === 1) {
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
    { x: player.x, y: player.y },
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
  let attackable = findAttackableEnemies(state, player);
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

function combat(state) {
  for (let i = 0; ; ++i) {
    if (!round(state)) {
      return i;
    }
  }
}

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