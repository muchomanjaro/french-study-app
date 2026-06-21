import {useState,useEffect} from 'react';import exercisesData from '../data/exercises.json';import BlankInput from '../components/BlankInput';import ProgressBar from '../components/ProgressBar';import ScoreCard from '../components/ScoreCard';
interface Blank{id:string;answers:string[];}
interface ExerciseItem{id:string;open_ended?:boolean;blanks:Blank[];}
interface ExerciseGroup{items:ExerciseItem[];}
interface Exercises{exercises:{[key:string]:{[key:string]:ExerciseGroup}};}
const data=exercisesData as unknown as Exercises;
export default function ExerciseSet(){const[selectedLesson,setSelectedLesson]=useState<string|null>(null);const[selectedEx,setSelectedEx]=useState<string|null>(null);const[results,setResults]=useState<Record<string,boolean>>({});const[score,setScore]=useState(0);const[submitted,setSubmitted]=useState(0);
const lessons=Object.keys(data.exercises||{});
const exercises=selectedLesson?Object.keys(data.exercises[selectedLesson]||{}):[];
const currentEx=selectedEx&&selectedLesson?data.exercises[selectedLesson]?.[selectedEx]:null;
const items:ExerciseItem[]=currentEx?.items||[];
const totalBlanks=items.reduce((s,i)=>s+(i.blanks?.length||0),0);
const handleCheck=(id:string,correct:boolean)=>{setResults(prev=>({...prev,[id]:correct}));if(correct){setScore(s=>s+1);setSubmitted(s=>s+1);}};
const resetAll=()=>{setSelectedLesson(null);setSelectedEx(null);setResults({});setScore(0);setSubmitted(0);};
if(!selectedLesson){return(<div className='p-4 max-w-lg mx-auto'><h1 className='text-xl font-bold text-gray-900 dark:text-white mb-4'>Exercises</h1><div className='grid gap-2'>{lessons.map(l=><button key={l} onClick={()=>setSelectedLesson(l)} className='bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-left hover:shadow-md transition-shadow'><p className='text-sm font-medium text-gray-900 dark:text-white'>{l.replace(/_/g,' ').toUpperCase()}</p></button>)}</div></div>);}
if(!selectedEx){return(<div className='p-4 max-w-lg mx-auto'><button onClick={()=>setSelectedLesson(null)} className='text-sm text-blue-600 hover:underline mb-4 dark:text-blue-400'>&larr; Back to lessons</button><h1 className='text-xl font-bold text-gray-900 dark:text-white mb-4'>{selectedLesson.replace(/_/g,' ').toUpperCase()}</h1><div className='grid gap-2'>{exercises.map(e=><button key={e} onClick={()=>setSelectedEx(e)} className='bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-left hover:shadow-md transition-shadow'><p className='text-sm font-medium text-gray-900 dark:text-white'>Exercise {e}</p></button>)}</div></div>);}
return(<div className='p-4 max-w-lg mx-auto pb-20'><button onClick={()=>setSelectedEx(null)} className='text-sm text-blue-600 hover:underline mb-4 dark:text-blue-400'>&larr; Back to exercises</button><ProgressBar value={submitted} max={totalBlanks} label='Progress' className='mb-4'/>
{items.map(item=>(<div key={item.id} className='mb-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4'><p className='text-xs text-gray-400 mb-2'>Item {item.id}</p><div className='space-y-2'>{item.blanks?.map(blank=><div key={blank.id}><label className='block text-xs text-gray-500 mb-1 dark:text-gray-400'>Blank {blank.id}</label><BlankInput id={blank.id} answers={blank.answers} onCheck={handleCheck} disabled={submitted>=totalBlanks}/></div>)}</div></div>))}
{submitted>=totalBlanks&&totalBlanks>0&&(<div className='mt-6'><ScoreCard score={score} total={totalBlanks} label='Exercise Complete!'/><button onClick={resetAll} className='mt-3 w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm'>Back to Lessons</button></div>)}
</div>);
}
