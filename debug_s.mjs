import * as core from '@strudel/core';
import * as mini from '@strudel/mini';

const pattern = mini.mini("bd hh");
const sPattern = core.s(pattern);

const events = sPattern.query({ start: 0, end: 1 });
console.log("Events:", JSON.stringify(events, null, 2));

const firstEvent = events[0];
console.log("First event value:", firstEvent.value);
