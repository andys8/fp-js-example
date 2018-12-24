const { part1, part2 } = require("./day15");

const runTest = (name, fn, expected) =>
  console.log(`Test ${name} ${fn() === expected ? "worked" : "failed"}`);

runTest("Part 1", part1, 222831);
runTest("Part 2", part2, 59245);
