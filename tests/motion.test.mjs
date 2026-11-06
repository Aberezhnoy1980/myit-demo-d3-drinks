import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
function page(initialReduced = false) {
  class Element {
    constructor() { this.events = {}; this.attrs = {}; this.styles = {}; this.classes = new Set(); this.hidden = false; this.children = {}; this.dataset = {}; this.classList = {add:(...names)=>names.forEach(n=>this.classes.add(n)),remove:(...names)=>names.forEach(n=>this.classes.delete(n)),toggle:(n,on)=>on?this.classes.add(n):this.classes.delete(n)}; this.style={setProperty:(n,v)=>this.styles[n]=v}; }
    addEventListener(n,fn) { (this.events[n] ||= []).push(fn); }
    emit(n) { for(const fn of this.events[n] || []) fn({}); }
    querySelector(s) { return this.children[s] ||= new Element(); }
    setAttribute(n,v) { this.attrs[n]=v; }
    getAttribute(n) { return this.attrs[n]; }
    removeAttribute(n) { delete this.attrs[n]; }
    getBoundingClientRect() { return {width:960,height:600,left:0,top:0}; }
  }
  const elements = {};
  const doc = new Element(); doc.querySelector = s=>elements[s] ||= new Element(); doc.querySelectorAll=()=>[];
  doc.querySelector('#product-data').textContent=JSON.stringify({citrus:{image:'./assets/citrus.svg',name:'Мандарин и розмарин',alt:'Банка',number:'01',color:'#edb153'}});
  doc.querySelector('#product-image').attrs.src='./assets/citrus.svg';
  const media = new Element(); media.matches=initialReduced;
  const win = new Element(); let frames=0, intervals=0;
  vm.runInNewContext(source,{document:doc,window:win,location:{hash:''},matchMedia:()=>media,ResizeObserver:class{observe(){}},setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:()=>++frames,cancelAnimationFrame(){},setInterval:()=>++intervals});
  return {doc,media,elements,ribbon:doc.querySelector('.ribbon'),control:doc.querySelector('.ribbon-control'),counts:()=>({frames,intervals})};
}
test('ribbon: initial reduced motion is static, controls hidden, no JS frame loop',()=>{
  const p=page(true); assert.equal(p.ribbon.classes.has('is-running'),false); assert.equal(p.control.hidden,true); assert.deepEqual(p.counts(),{frames:0,intervals:0});
});
test('ribbon: pause survives preference changes; hidden document pauses, visible resumes',()=>{
  const p=page(); assert.equal(p.ribbon.classes.has('is-running'),true);
  assert.equal(p.ribbon.styles['--ribbon-duration'],`${960/28}s`);
  p.control.emit('click'); assert.equal(p.control.attrs['aria-pressed'],'true'); assert.equal(p.ribbon.classes.has('is-paused'),true);
  p.media.matches=true; p.media.emit('change'); assert.equal(p.ribbon.classes.has('is-running'),false); assert.equal(p.control.hidden,true);
  p.media.matches=false; p.media.emit('change'); assert.equal(p.ribbon.classes.has('is-running'),true); assert.equal(p.ribbon.classes.has('is-paused'),true);
  p.control.emit('click'); p.doc.hidden=true; p.doc.emit('visibilitychange'); assert.equal(p.ribbon.classes.has('is-paused'),true);
  p.doc.hidden=false; p.doc.emit('visibilitychange'); assert.equal(p.ribbon.classes.has('is-paused'),false); assert.deepEqual(p.counts(),{frames:0,intervals:0});
});
