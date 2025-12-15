import { mini } from '@strudel/mini';
import { s } from '@strudel/core';

console.log("Type of mini('bd'):", typeof mini('bd'));
console.log("Type of s('bd'):", typeof s('bd'));

const p1 = mini('bd hh');
console.log("mini('bd hh') constructor name:", p1.constructor.name);
// console.log("mini('bd hh') query:", p1.query);

const p2 = s('bd hh');
console.log("s('bd hh') constructor name:", p2.constructor.name);

const p3 = mini('c3');
console.log("mini('c3').note exists:", typeof p3.note);
