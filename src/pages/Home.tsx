import {useNavigate} from 'react-router-dom';
import {useDrill} from '../hooks/useDrill';
import ProgressBar from '../components/ProgressBar';
import ScoreCard from '../components/ScoreCard';
import ReadinessMeter from '../components/ReadinessMeter';
import SyncIndicator from '../components/SyncIndicator';
import {useState, useEffect} from 'react';
import Dexie, {type Table} from 'dexie';

interface ExAttempt { id?: number; exerciseSetId: string; score: number; completedAt: string; synced: boolean; }
class ProgressDB extends Dexie {
  attempts!: Table<ExAttempt, number>;
  constructor() { super('FrenchStudyProgress'); this.version(1).stores({ attempts: '++id, exerciseSetId, completedAt, synced' }); }
}
let _pdb: ProgressDB;
function getPdb() { if (!_pdb) _pdb = new ProgressDB(); return _pdb; }

export default function Home() {
  const navigate = useNavigate();
  const {dueCards} = useDrill();
  const [stats, setStats] = useState({avgScore: 0, completed: 0, total: 0});

  useEffect(() => {
    async function load() {
      try {
        const db = getPdb();
        const all = await db.attempts.toArray();
        const completed = all.length;
        const avgScore = completed > 0 ? Math.round(all.reduce((s, a) => s + a.score, 0) / completed) : 0;
        setStats({avgScore, completed, total: Math.max(completed, 20)});
      } catch { /* IndexedDB unavailable */ }
    }
    load();
  }, []);

  const chapterScores = dueCards.length > 0
    ? [{chapterId: 'drill', chapterName: 'Drills', averageScore: Math.round(dueCards.reduce((s, c) => s + c.srsBox * 20, 0) / dueCards.length), attempts: dueCards.length}]
    : [];

  const quickActions = [
    {label:'Daily Drill', desc:'SRS flashcards', path:'/drill', icon:'📝', color:'bg-blue-500'},
    {label:'Exercises', desc:'Fill-in-the-blank', path:'/exercise/ch01_1', icon:'📖', color:'bg-green-500'},
    {label:'Verb Lookup', desc:'Search conjugations', path:'/verbs', icon:'🔍', color:'bg-purple-500'},
    {label:'Verb Quiz', desc:'Adaptive conjugation', path:'/verbs/quiz', icon:'🎯', color:'bg-amber-500'},
  ];

  return (
    <div className='p-4 max-w-lg mx-auto pb-20'>
      <header className='flex justify-between items-center mb-6'>
        <div>
          <h1 className='text-xl font-bold text-gray-900 dark:text-white'>Bienvenue! 👋</h1>
          <p className='text-sm text-gray-500 dark:text-gray-400'>Keep practicing</p>
        </div>
        <SyncIndicator/>
      </header>
      <ScoreCard score={stats.avgScore} total={100} label='Overall Score' className='mb-4'/>
      <ReadinessMeter items={chapterScores}/>
      <ProgressBar value={stats.completed} max={Math.max(stats.total, 1)} label='Exercises Completed' className='mt-4 mb-6'/>
      {dueCards.length > 0 && (
        <div className='bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4'>
          <div className='flex justify-between items-center'>
            <div>
              <p className='text-sm font-semibold text-amber-800 dark:text-amber-300'>Drills Due</p>
              <p className='text-xs text-amber-600 dark:text-amber-400'>{dueCards.length} item{dueCards.length > 1 ? 's' : ''} need review</p>
            </div>
            <button onClick={() => navigate('/drill')} className='px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600'>Review</button>
          </div>
        </div>
      )}
      <div className='grid grid-cols-2 gap-3'>
        {quickActions.map(a => (
          <button key={a.path} onClick={() => navigate(a.path)} className='bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 text-left hover:shadow-md transition-shadow'>
            <div className={'w-10 h-10 rounded-lg flex items-center justify-center text-lg mb-2 ' + a.color}>{a.icon}</div>
            <p className='text-sm font-medium text-gray-900 dark:text-white'>{a.label}</p>
            <p className='text-xs text-gray-500 dark:text-gray-400'>{a.desc}</p>
          </button>
        ))}
      </div>
      <div className='mt-6 text-center'>
        <button onClick={() => navigate('/auth')} className='text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'>Sign In</button>
      </div>
    </div>
  );
}
