interface ErrorPattern{pattern:string;count:number;tip:string;}
interface ErrorPatternsProps{errors:ErrorPattern[];}
export default function ErrorPatterns({errors}:ErrorPatternsProps){if(!errors||errors.length===0)return null;return(<div className='bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4'><h4 className='text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2'>Common Mistakes</h4><ul className='space-y-2'>{errors.map((e,i)=><li key={i} className='text-xs'><span className='font-medium text-amber-700 dark:text-amber-400'>{e.pattern}</span><span className='text-amber-600 dark:text-amber-500 ml-1'>({e.count}x)</span><p className='text-gray-600 dark:text-gray-400 mt-0.5'>{e.tip}</p></li>)}</ul></div>);
}
