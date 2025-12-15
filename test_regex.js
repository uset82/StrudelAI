
const input = `stack(stack(stack(, note(m("c3")).s("square").hpf(400).decay(0.06).struct("x x x x")).gain(0.8)), note(m("b3 a3 d4 db4"))`;

console.log("Original:", input);

let output = input;

// Apply the same logic as route.ts
output = output.replace(/\(\s*,/g, '(');

console.log("Fixed:   ", output);

if (output.includes('stack(,')) {
    console.log("FAIL: Still contains stack(,");
} else {
    console.log("PASS: Fixed stack(,");
}
