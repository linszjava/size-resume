export type TextRange = { start: number; end: number };
export function mergeRanges(ranges: TextRange[]): TextRange[] {
  const result: TextRange[] = [];
  for (const range of [...ranges].sort((a,b)=>a.start-b.start)) {
    const last=result[result.length-1];
    if(last && range.start<=last.end) last.end=Math.max(last.end,range.end);
    else if(range.end>range.start) result.push({...range});
  }
  return result;
}
export function removeRange(ranges: TextRange[], selection: TextRange): TextRange[] {
  return ranges.flatMap(r=>r.end<=selection.start||r.start>=selection.end?[r]:[
    ...(r.start<selection.start?[{start:r.start,end:selection.start}]:[]),
    ...(r.end>selection.end?[{start:selection.end,end:r.end}]:[])
  ]);
}
export function toggleRange(ranges: TextRange[], selection: TextRange): TextRange[] {
  const merged=mergeRanges(ranges);
  return merged.some(r=>r.start<=selection.start&&r.end>=selection.end)
    ? removeRange(merged,selection) : mergeRanges([...merged,selection]);
}
export function shiftRanges(ranges: TextRange[], oldText:string, newText:string):TextRange[] {
  let start=0;
  while(start<oldText.length&&start<newText.length&&oldText[start]===newText[start])start++;
  let oldEnd=oldText.length,newEnd=newText.length;
  while(oldEnd>start&&newEnd>start&&oldText[oldEnd-1]===newText[newEnd-1]){oldEnd--;newEnd--;}
  const delta=newEnd-oldEnd;
  return mergeRanges(ranges.flatMap(r=>{
    if(r.end<=start)return [r];
    if(r.start>=oldEnd)return [{start:r.start+delta,end:r.end+delta}];
    return [...(r.start<start?[{start:r.start,end:start}]:[]),...(r.end>oldEnd?[{start:newEnd,end:r.end+delta}]:[])];
  }));
}
