/** Keep keyboard keys and individual touch pointers independent. */
export class InputState {
  constructor(){this.held=new Set();this.sources=new Map();}
  press(key,source){
    this.release(source);this.sources.set(source,key);this.held.add(key);
  }
  release(source){
    const key=this.sources.get(source);this.sources.delete(source);
    if(key && ![...this.sources.values()].includes(key))this.held.delete(key);
  }
  clear(){this.sources.clear();this.held.clear();}
}
