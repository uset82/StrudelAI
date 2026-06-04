import { runMusicAgentPipeline, setLocalPipelineOverride } from './src/lib/music-agent';
import * as pipeline from './src/lib/music-agent/pipeline';
import { validateGeneratedTracks } from './src/lib/music/strudelValidation';
import assert from 'node:assert/strict';

async function runTests() {
  console.log('🧪 Running runMusicAgentPipeline Integration Tests...');

  const originalBuild = pipeline.buildLocalMusicAgentPipeline;

  setLocalPipelineOverride((args) => {
    const res = originalBuild(args);
    // Force a bad track: play snare only for a kick prompt
    if (args.prompt.includes('kick')) {
      res.tracks.drums = "s('sd*4').gain(0.8)";
    }
    return res;
  });

  try {
    // Test 1: Local pipeline with "hard techno kick"
    // It should generate snare drum (due to our monkeypatch), but the validation agent should reject it and apply the patch to "bd" (kick).
    console.log('\nTest 1: Mismatched instrument intent (kick prompt with snare code)');
    const res1 = await runMusicAgentPipeline({
      prompt: 'hard techno kick',
      enableOpenRouter: false, // forces local pipeline + validator wrapper
    });

    console.log('Result BPM:', res1.bpm);
    console.log('Result Tracks:', JSON.stringify(res1.tracks, null, 2));

    assert.ok(res1.tracks.drums, 'Drums track should exist');
    assert.match(res1.tracks.drums, /bd/i, 'Drums track should be patched to bd (kick)');
    assert.doesNotMatch(res1.tracks.drums, /sd/i, 'Drums track should NOT contain sd (snare)');
    console.log('✅ Test 1 Passed: Successfully validated and patched wrong drum role!');

    console.log('\nTest 2: Hard rock should not be mistaken for ride cymbal');
    const res2 = await runMusicAgentPipeline({
      prompt: 'hard rock',
      enableOpenRouter: false,
    });
    const validation = validateGeneratedTracks(res2.tracks, 'hard rock');

    console.log('Result BPM:', res2.bpm);
    console.log('Result Tracks:', JSON.stringify(res2.tracks, null, 2));

    assert.ok(res2.tracks.melody, 'Hard rock should keep a guitar-like melody track');
    assert.doesNotMatch(res2.tracks.melody, /\.s\(['"]rd['"]\)/i, 'Hard rock guitar should not be rewritten to ride cymbal');
    assert.equal(validation.valid, true, JSON.stringify(validation.issues));
    console.log('✅ Test 2 Passed: Hard rock remains guitar-like and validates cleanly!');

    console.log('\n🎉 All integration tests passed successfully!');
  } finally {
    // Restore original function
    setLocalPipelineOverride(null);
  }
}

runTests().catch(err => {
  console.error('❌ Integration tests failed:', err);
  process.exit(1);
});
