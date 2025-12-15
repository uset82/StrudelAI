import * as mini from '@strudel/mini';

const p = mini.mini("bd");
console.log("Type:", typeof p);
console.log("Is Pattern:", p.constructor.name);
// console.log("Structure:", JSON.stringify(p, null, 2));
console.log("Has .s method:", typeof p.s === 'function');
