import React, {useState, useEffect} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import exercisesData from '../data/exercises.json';
import answersData from '../data/answers.json';
import BlankInput from '../components/BlankInput';
import ProgressBar from '../components/ProgressBar';
import ScoreCard from '../components/ScoreCard';
import {useSpeech} from '../hooks/useSpeech';
import {supabase} from '../lib/supabase';
import {useStudyProgress} from '../hooks/useStudyProgress';

interface Blank {id:string; answers:string[]; sentence?:string;}
interface ExItem {id:string; open_ended?:boolean; blanks:Blank[];}
interface ExSet {id:string; page?:number; label?:string; type?:string; lesson_text?:string; items:ExItem[];}


interface Chapter {id:string; title:string; bilan_refs?:string[]; exercise_sets:ExSet[];}
const answers = answersData as Record<string, {items:ExItem[]}>;
const chapters = ((exercisesData as any).chapters as Chapter[]).map(ch => ({
  ...ch,
  exercise_sets: ch.exercise_sets.map(s => ({...s, items: answers[s.id]?.items || []}))
}));

export default function ExerciseSet() {
  const {setId} = useParams<{setId?: string}>();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [selChapter, setSelChapter] = useState<typeof chapters[0]|null>(null);
  const [selSet, setSelSet] = useState<typeof chapters[0]['exercise_sets'][0]|null>(null);
  const [results, setResults] = useState<Record<string,boolean>>({});
  const [score, setScore] = useState(0);
  const [submitted, setSubmitted] = useState(0);
  const [showBilanCta, setShowBilanCta] = useState(false);
  const {speak} = useSpeech();
  const {markExerciseComplete, chapterProgress} = useStudyProgress(userId);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  // Auto-select chapter + set from URL param (e.g. /exercise/ch01_1 or /exercise/ch01_p009)
  useEffect(() => {
    if (!setId) return;
    const match = setId.match(/^(ch\d+)_(.+)$/);
    if (!match) return;
    const chapterId = match[1];
    const setIdent = match[2];
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    setSelChapter(chapter);
    const available = chapter.exercise_sets.filter(s => s.items.length > 0);
    // First, try to find the set by its full ID (e.g. ch01_p009)
    const directSet = available.find(s => s.id === setId);
    if (directSet) {
      setSelSet(directSet);
      return;
    }
    // Fall back to numeric index (e.g. ch01_1 -> first available set)
    const setIndex = parseInt(setIdent, 10) - 1;
    if (!isNaN(setIndex) && available[setIndex]) {
      setSelSet(available[setIndex]);
    }
  }, [setId]);

  const items = selSet?.items || [];
  const totalBlanks = items.reduce((s,i) => s+(i.blanks?.length||0), 0);
  const handleCheck = (id:string, correct:boolean) => {
    setResults(p => ({...p,[id]:correct}));
    if (correct) setScore(s=>s+1);
    if (!results[id]) setSubmitted(s=>s+1);
  };

  // Track exercise completion and check bilan eligibility
  useEffect(() => {
    if (submitted < totalBlanks || totalBlanks === 0 || !userId || !selSet || !selChapter) return;
    
    // Mark this exercise set as complete
    const pct = Math.round((score / totalBlanks) * 100);
    markExerciseComplete(selSet.id, pct).catch(() => {});

    // Check if all exercises in this chapter are complete — show Bilan CTA
    const chData = chapterProgress.get(selChapter.id);
    const totalSets = selChapter.exercise_sets.filter(s => s.type === 'exercise' && s.items.length > 0).length;
    const doneCount = (chData?.exercisesDone ?? 0) + 1; // +1 for this set
    if (doneCount >= totalSets && selChapter.bilan_refs?.length) {
      setShowBilanCta(true);
    }
  }, [submitted, totalBlanks, userId, selSet, selChapter, score]);

  const reset = () => { setSelChapter(null); setSelSet(null); setResults({}); setScore(0); setSubmitted(0); setShowBilanCta(false); };

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
                // Trim to first clause only — take text up to and including the first blank
                const firstOnly = blank.sentence.split('___').slice(0, 2).join('___').split('___');
                const before = firstOnly[0] || '';
                const after = firstOnly[1] || '';
                return (
                  <p key={blank.id} className="text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2 flex-wrap">
                    <span className="flex-1 flex items-center gap-1 flex-wrap">
                      {before && <span>{before}</span>}
                      <BlankInput id={blank.id} answers={blank.answers} onCheck={handleCheck} disabled={!!results[blank.id]}/>
                      {after && <span>{after}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => speak(blank.sentence!.replace(/___/g, '…'))}
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
          {showBilanCta && selChapter?.bilan_refs?.length && (
            <button
              onClick={() => navigate(`/bilan/${selChapter.bilan_refs![0]}`)}
              className='mt-3 w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium'
            >
              📝 Take Bilan — Review Chapter
            </button>
          )}
          <button onClick={reset} className='mt-3 w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm'>Back to Lessons</button>
        </div>
      )}
    </div>
  );
}
