import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import { Button, Tooltip } from '@arco-design/web-react';
import { Highlighter, RotateCcw } from 'lucide-react';
import { fromDocument, toDocument, textSignature, type FormattedText } from './richText';

export function RichTextEditor({value,onChange}:{value:FormattedText;onChange:(value:FormattedText)=>void}) {
  const changeRef=useRef(onChange);changeRef.current=onChange;
  const lastValue=useRef(textSignature(value));
  const [,refresh]=useState(0);
  const editor=useEditor({
    extensions:[StarterKit.configure({heading:false,blockquote:false,bulletList:false,orderedList:false,listItem:false,codeBlock:false,code:false,horizontalRule:false,strike:false}),Highlight,Underline],
    content:toDocument(value),
    editorProps:{attributes:{class:'rich-text-input',role:'textbox','aria-label':'详细内容','aria-multiline':'true','data-placeholder':'描述你的经历，试着用数据表达成果…'}},
    onUpdate:({editor})=>{const next=fromDocument(editor.getJSON());lastValue.current=textSignature(next);changeRef.current(next);},
    onTransaction:()=>refresh(n=>n+1),
  });
  useEffect(()=>{
    const signature=textSignature(value);
    if(editor&&signature!==lastValue.current){editor.commands.setContent(toDocument(value),false);lastValue.current=signature;}
  },[editor,value]);
  if(!editor)return null;
  const options=[
    {mark:'highlight',label:'高亮',icon:<Highlighter size={14}/>,run:()=>editor.chain().focus().toggleHighlight().run()},
    {mark:'bold',label:'加粗',icon:<b>B</b>,run:()=>editor.chain().focus().toggleBold().run()},
    {mark:'italic',label:'斜体',icon:<i>I</i>,run:()=>editor.chain().focus().toggleItalic().run()},
    {mark:'underline',label:'下划线',icon:<u>U</u>,run:()=>editor.chain().focus().toggleUnderline().run()},
  ];
  function clear(){
    const {from,to,empty}=editor!.state.selection;
    if(empty)editor!.chain().focus().selectAll().unsetAllMarks().setTextSelection({from,to}).run();
    else editor!.chain().focus().unsetAllMarks().run();
  }
  return <div className="rich-editor"><div className="rich-label"><label>详细内容</label><div className="format-toolbar" role="group" aria-label="正文格式">{options.map(o=><Tooltip key={o.mark} content={o.label}><Button size="mini" type={editor.isActive(o.mark)?'primary':'secondary'} aria-label={o.label} aria-pressed={editor.isActive(o.mark)} onMouseDown={event=>event.preventDefault()} onClick={o.run}>{o.icon}{o.mark==='highlight'?'高亮':null}</Button></Tooltip>)}<Tooltip content="清除选中文字的格式；未选中文字时清除本条全部格式"><Button size="mini" aria-label="清除格式" icon={<RotateCcw size={13}/>} onMouseDown={event=>event.preventDefault()} onClick={clear}/></Tooltip></div></div><EditorContent editor={editor}/></div>;
}
