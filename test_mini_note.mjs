import { mini } from '@strudel/mini';
import { note } from '@strudel/core';

const n1 = note("c3 e3");
console.log("note('c3 e3') events:", n1.query({start:0, end:1}).length);

// If note is dumb, it will have 1 event with value "c3 e3".
// If note is smart, it might have 2 events.

const m1 = mini("c3 e3");
console.log("mini('c3 e3') events:", m1.query({start:0, end:1}).length);
