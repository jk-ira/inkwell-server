const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
module.exports = { escapeLike };
