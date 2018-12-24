const fs = require('fs');
const input = fs.readFileSync('day15.input.txt', 'utf8').trim();

function debugLog() {
    //console.log(...arguments);
}

function newPlayer(type, x, y, elfCombatPoints) {
    return { 
        type,
        x,
        y,
        combatPoints: type === 'E' ? elfCombatPoints : 3,
        hitpoints: 200
    };
}

function parseInput(input, elfCombatPoints) {
    const lines = input.split('\n');

    const numRows = lines.length;
    const numColumns = lines[0].length; // all rows have equal length

    // The grid, containg walls and free spaces. Movable entites are not part of it.
    const grid = new Array(numRows).fill().map(_ => new Array(numColumns).fill('.'));

    let x = 0, y = 0;

    const players = [];

    for (const row of lines) {
        x = 0;
        for (cell of row) {
            switch (cell) {
                case '#':
                    // A wall
                    grid[y][x] = cell;
                    break;

                case 'E':
                case 'G':
                    players.push(newPlayer(cell, x, y, elfCombatPoints));
                    break;
            }

            ++x;
        }
        ++y;
    }

    return { grid, numRows, numColumns, players };
}

function render(state) {
    // Create a copy of the grid, where players can then be inserted.
    const copy = state.grid.map(row => [...row]);

    // Add players.
    for (player of state.players) {
        copy[player.y][player.x] = player.type;
    }

    console.log(copy.map(row => row.join('')).join('\n'));
}

// Comparator that puts coordinates in 'reading order'.
function compareCoords(x1, y1, x2, y2) {
    let res = y1 - y2;
    if (res === 0) {
        res = x1 - x2;
    }
    return res;
}

// Returns a sorted copy of the players array.
function sortPlayers(players)  {
    const sorted = [...players];
    sorted.sort((a, b) => compareCoords(a.x, a.y, b.x, b.y));
    return sorted;
}

// Returns a sorted copy of the given positions.
function sortPositions(positions)  {
    const sorted = [...positions];
    sorted.sort((a, b) => compareCoords(a.x, a.y, b.x, b.y));
    return sorted;
}

// Given a coordinate, finds free adjacent positions to it.
function findAdjacentPositions(x, y, state) {
    const positions = [
        { x: x - 1, y: y},
        { x: x + 1, y: y},
        { x: x, y: y - 1},
        { x: x, y: y + 1},
    ]
    .filter(pos => pos.x >= 0 && pos.x < state.numColumns && pos.y >= 0 && pos.y < state.numRows) // must be within grid
    .filter(pos => state.grid[pos.y][pos.x] === '.') // must not be covered by a wall
    .filter(pos => !state.players.some(player => player.x === pos.x && player.y === pos.y)) // no player must be on that position
    return positions;
}

// Finds positions from which a player of the given type (elf or goblin) can
// be attacked from.
function findAttackPositions(state, targetType) {
    const positions = [];
    for (const player of state.players.filter(p => p.type === targetType)) {
        positions.push(...findAdjacentPositions(player.x, player.y, state));
    }

    return positions;
}

// Given a player type, returns the type of the player's enemy.
function enemyType(type) {
    switch (type) {
        case 'E': return 'G';
        case 'G': return 'E';
        default: throw new Error(`invalid type: '${type}'`);
    }
}

function areEnemies(player1, player2) {
    return player1.type === enemyType(player2.type);
}

// Calculates the Manhattan distance between two coordinates.
function distance(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

// Finds enemies a player can (from his current position) attack.
function findAttackableEnemies(state, player) {
    const targets = state.players.filter(p => p.type === enemyType(player.type));
    return targets.filter(t => distance(t.x, t.y, player.x, player.y) === 1);
}

// Returns whether there are still targets of the given player left on the field.
function areTargetsLeft(state, player) {
    return state.players.some(p => areEnemies(p, player));
}


// Given the current state, a start position and a set of target positions, calculates the preferred
// next move the player could make.
function findNextMove(state, start, targets) {   
    if (targets.length === 0) {
        return null
    }

    const grid = new Array(state.numRows).fill().map(_ => new Array(state.numColumns).fill(null));

    // Calculate and mark initial positions.
    let currentPositions = targets.map(t => ({x: t.x, y: t.y}));
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
                for (const adjacent of findAdjacentPositions(curPos.x, curPos.y, state)) {
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
            return sortPositions(finalPositions)[0];
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
    const nextStep = findNextMove(state, {x: player.x, y: player.y}, findAttackPositions(state, enemyType(player.type)));
    if (nextStep) {
        debugLog('next step:', nextStep);
        player.x = nextStep.x;
        player.y = nextStep.y;
    } else {
        debugLog('no possible move');
    }
}

// If required, moves a given player towards the best possible enemies.
// If a direct attack is possible, the player is not moved.
function moveIfRequired(state, player) {
    let attackable = findAttackableEnemies(state, player);
    if (attackable.length === 0) {
        debugLog('no target adjacent, having to move');
        moveTowardsEnemy(state, player);
    }
}

// Calculates the fight between an attacker and a defendent.
function fight(attacker, defendent) {
    defendent.hitpoints -= attacker.combatPoints;;
}

// Lets one player act (withing a round).
function act(state, player) {
    if (!areTargetsLeft(state, player)) {
        return false;
    }

    debugLog(`Acting: ${player.type} (${player.x}, ${player.y})`);
    moveIfRequired(state, player);

    let attackable = findAttackableEnemies(state, player);
    if (attackable.length === 0) {
        debugLog('nothing I can do');
        return true;
    }

    debugLog('can attack an enemy');
    const attackPriorities = sortPlayers(attackable).sort((a, b) => a.hitpoints - b.hitpoints);
    const target = attackPriorities[0];
    debugLog('attacking', target)

    fight(player, target);

    if (target.hitpoints <= 0) {
        // Remove killed player.
        debugLog('I killed an enemy');
        state.players = state.players.filter(p => p !== target);
    }

    return true;
}

function round(state) {
    // Determine order of players in this round.
    const players = sortPlayers(state.players);

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
        //console.log(`>>> Iteration ${i}`);
        if (!round(state)) {
            return i;
        }

        //render(state);
    }
}

function outcome(state, iterations) {
    const hitPointSum = state.players.map(p => p.hitpoints).reduce((a, b) => a + b, 0);
    return iterations * hitPointSum;
}

// Expected result: Combat ends after 72 full rounds. Result: 196200.
function part1() {
    state = parseInput(input, 3);
    //render(state);
    const iterations = combat(state);
    console.log(`Combat ends after ${iterations} full rounds. Result: ${outcome(state, iterations)}.`);
}

// With 17 combat points, the elves win without any losses after 50 iterations.
// Outcome: 61750.
function part2() {
    for (let combatPoints = 4; ; ++combatPoints) {
        state = parseInput(input, combatPoints);
        //render(state);

        const numInitialElves = state.players.filter(p => p.type === 'E').length;
        
        const iterations = combat(state);

        const numFinalElves = state.players.filter(p => p.type === 'E').length;
        if (numFinalElves === numInitialElves) {
            console.log(`With ${combatPoints} combat points, the elves win without any losses after ${iterations} iterations.`);
            console.log(`Outcome: ${outcome(state, iterations)}.`);
            break;
        } else {
            console.log(`With ${combatPoints} combat points, the ${numInitialElves - numFinalElves} elves are lost after ${iterations} iterations.`);
        }
    }
    state = parseInput(input, 3);
}

console.log('Part 1:');
part1();

console.log('\nPart 2:');
part2();