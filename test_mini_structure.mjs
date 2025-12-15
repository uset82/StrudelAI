import { mini } from '@strudel/mini';
import { s } from '@strudel/core';

const m = mini('bd');
const c = s('bd');

console.log("mini event value:", m.query({start:0, end:1})[0].value);
console.log("core event value:", c.query({start:0, end:1})[0].value);
