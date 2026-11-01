import type { JSONContent } from '@tiptap/react';
import { mergeRanges, type TextRange } from './formatting';
export type FormattedText = { body: string; highlights: TextRange[]; bold?: TextRange[]; italic?: TextRange[]; underline?: TextRange[] };
const markNames = { highlights:'highlight', bold:'bold', italic:'italic', underline:'underline' } as const;
type Key = keyof typeof markNames;
const keys = Object.keys(markNames) as Key[];
export function toDocument(value: FormattedText): JSONContent {
  let offset=0;
  const content=value.body.split('\n').map(line=>{
    const end=offset+line.length;
    const points=[...new Set([offset,end,...keys.flatMap(k=>(value[k]??[]).flatMap(r=>[r.start,r.end]).filter(p=>p>offset&&p<end))])].sort((a,b)=>a-b);
    const text=points.slice(0,-1).map((start,i)=>({type:'text',text:value.body.slice(start,points[i+1]),marks:keys.filter(k=>(value[k]??[]).some(r=>r.start<=start&&r.end>=points[i+1])).map(k=>({type:markNames[k]}))}));
    offset=end+1;
    return {type:'paragraph',content:text};
  });
  return {type:'doc',content};
}
export function fromDocument(doc: JSONContent): FormattedText {
  const result: Required<FormattedText>={body:'',highlights:[],bold:[],italic:[],underline:[]};
  function visit(node:JSONContent){
    if(node.type==='text'&&node.text){
      const start=result.body.length;result.body+=node.text;
      for(const key of keys)if(node.marks?.some(m=>m.type===markNames[key]))result[key].push({start,end:result.body.length});
    }else if(node.type==='hardBreak')result.body+='\n';
    else node.content?.forEach(visit);
  }
  (doc.content??[]).forEach((block,i)=>{if(i)result.body+='\n';visit(block);});
  for(const key of keys)result[key]=mergeRanges(result[key]);
  return result;
}
export function textSignature(value:FormattedText){return JSON.stringify([value.body,...keys.map(k=>value[k]??[])]);}
