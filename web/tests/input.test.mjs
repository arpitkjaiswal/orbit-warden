import test from 'node:test';
import assert from 'node:assert/strict';
import {InputState} from '../input.js';
test('releasing touch fire preserves a held keyboard space key',()=>{
 const input=new InputState();input.press('Space','key:Space');input.press('Space','pointer:1');input.release('pointer:1');assert.ok(input.held.has('Space'));input.release('key:Space');assert.equal(input.held.size,0);
});
test('two fingers on the same control are released independently',()=>{
 const input=new InputState();input.press('ArrowLeft','pointer:1');input.press('ArrowLeft','pointer:2');input.release('pointer:1');assert.ok(input.held.has('ArrowLeft'));input.release('pointer:2');assert.equal(input.held.size,0);
});
test('source reassignment and pause clearing cannot leave stuck controls',()=>{
 const input=new InputState();input.press('ArrowLeft','pointer:1');input.press('ArrowRight','pointer:1');assert.equal(input.held.has('ArrowLeft'),false);assert.ok(input.held.has('ArrowRight'));input.clear();input.release('pointer:1');assert.equal(input.held.size,0);assert.equal(input.sources.size,0);
});
