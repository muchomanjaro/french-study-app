import React, {useState} from 'react';
import exercisesData from '../data/exercises.json';
import answersData from '../data/answers.json';
import BlankInput from '../components/BlankInput';
import ProgressBar from '../components/ProgressBar';
import ScoreCard from '../components/ScoreCard';
import {useSpeech} from '../hooks/useSpeech';

interface Blank {id:string; answers:string[]; sentence?:string;}
interface ExItem {id:string; open_ended?:boolean; blanks:Blank[];}
interface ExSet {id:string; page?:number; label?:string; type?:string; lesson_text?:string; items:ExItem[];}
interface Chapter {id:string; title:string; exercise_sets:ExSet[];}
const answers = answersData as Record<string, {items:ExItem[]}>;
const chapters = ((exercisesData as any).chapters as Chapter[]).map(ch => ({
  ...ch,
  exercise_sets: ch.exercise_sets.map(s => ({...s, items: answers[s.id]?.items || []}))
}));

export default function ExerciseSet() {
  const [selChapter, setSelChapter] = useState<typeof chapters[0]|null>(null);
  const [selSet, setSelSet] = useState<typeof chapters[0]['exercise_sets'][0]|null>(null);
  const [results, setResults] = useState<Record<string,boolean>>({});
  const [score, setScore] = useState(0);
  const [submitted, setSubmitted] = useState(0);
  const {speak} = useSpeech();
  const items = selSet?.items || [];
  const totalBlanks = items.reduce((s,i) => s+(i.blanks?.length||0), 0);
  const handleCheck = (id:string, correct:boolean) => {
    setResults(p => ({...p,[id]:correct}));
    if (correct) { setScore(s=>s+1); setSubmitted(s=>s+1); }
  };
  const reset = () => { setSelChapter(null); setSelSet(null); setResults({}); setScore(0); setSubmitted(0); };

  if (!selChapter) return (
    <div className='p-4 max-w-lg mx-auto'>
      <h1 className='text-xl font-bold text-gray-900 dark:text-white mb-4'>Exercises</h1>
      <div className='grid gap-2'>
        {chapters.map(ch => (
          <button key={ch.id} onClick={() => setSelChapter(ch)} className='bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-left hover:shadow-md transition-shadow'>
            <p className='text-xs text-gray-400 uppercase mb-1'>{ch.id}</p>
            <p className='text-sm font-medium text-gray-900 dark:text-white'>{ch.title}</p>
            <p className='text-xs text-gray-500'>{ch.exercise_sets.filter(s=>s.items.length>0).length} sets</p>
          </button>
        ))}
      </div>
    </div>
  );

  if (!selSet) {
    const available = selChapter.exercise_sets.filter(s=>s.items.length>0);
    return (
      <div className='p-4 max-w-lg mx-auto'>
        <button onClick={() => setSelChapter(null)} className='text-sm text-blue-600 hover:underline mb-4 dark:text-blue-400'>← Back</button>
        <h1 className='text-xl font-bold text-gray-900 dark:text-white mb-4'>{selChapter.title}</h1>
        {available.length === 0 && <p className='text-gray-500 text-sm'>No exercises available yet.</p>}
        <div className='grid gap-2'>
          {available.map(set => (
            <button key={set.id} onClick={() => setSelSet(set)} className='bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-left hover:shadow-md transition-shadow'>
              <p className='text-xs text-gray-400 uppercase mb-1'>{set.id}</p>
              <p className='text-sm font-medium text-gray-900 dark:text-white'>{set.label || `p. ${set.page}`}</p>
              <p className='text-xs text-gray-500'>{set.items.length} items</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className='p-4 max-w-lg mx-auto pb-20'>
      <button onClick={() => setSelSet(null)} className='text-sm text-blue-600 hover:underline mb-4 dark:text-blue-400'>← Back</button>
      <ProgressBar value={submitted} max={Math.max(totalBlanks,1)} label='Progress' className='mb-4'/>
      {items.map(item => (
        <div key={item.id} className='mb-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4'>
          <p className='text-xs text-gray-400 mb-2'>Item {item.id}</p>
          <div className='space-y-2'>
            {item.blanks?.map(blank => (
              blank.sentence ? (() => {
                const parts = blank.sentence.split('___');
                const elements: React.ReactNode[] = [];
                parts.forEach((part, i) => {
                  if (i > 0 && i < parts.length) {
                    elements.push(
                      <BlankInput key={'b'+i} id={blank.id} answers={blank.answers} onCheck={handleCheck} disabled={!!results[blank.id]}/>
                    );
                  }
                  if (part) elements.push(<span key={'t'+i}>{part}</span>);
                });
                return (
                  <p key={blank.id} className="text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <span className="flex-1">{elements}</span>
                    <button
                      type="button"
                      onClick={() => speak(blank.sentence!.replace('___', '…'))}
                      className="text-lg hover:scale-110 transition-transform flex-shrink-0"
                      title="Listen"
                      aria-label="Listen to sentence"
                    >🔊</button>
                  </p>
                );
              })() : (
                <div key={blank.id}>
                  <label className='block text-xs text-gray-500 mb-1 dark:text-gray-400'>Blank {blank.id}</label>
                  <BlankInput id={blank.id} answers={blank.answers} onCheck={handleCheck} disabled={!!results[blank.id]}/>
                </div>
              )
            ))}
          </div>
        </div>
      ))}
      {submitted >= totalBlanks && totalBlanks > 0 && (
        <div className='mt-6'>
          <ScoreCard score={score} total={totalBlanks} label='Exercise Complete!'/>
          <button onClick={reset} className='mt-3 w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm'>Back to Lessons</button>
        </div>
      )}
    </div>
  );
}
