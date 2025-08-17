import { useEffect } from 'react';

export function useClickOutside(refs, callback) {
  useEffect(() => {
    const handleClickOutside = (event) => {
      const activeRefs = Array.isArray(refs) ? refs.filter(ref => ref.current) : [refs];

      const isOutside = activeRefs.every(ref => !ref.current.contains(event.target));

      if (isOutside) callback();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [refs, callback]);
}
