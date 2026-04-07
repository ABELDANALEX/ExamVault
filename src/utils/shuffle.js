const { randomInt } = require('node:crypto');

function fisherYatesShuffle(items) {
  const array = [...items];

  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }

  return array;
}

module.exports = {
  fisherYatesShuffle
};
