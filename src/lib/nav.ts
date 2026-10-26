import { useLocation, useNavigate } from 'react-router';

export type Section = 'gym' | 'settings';

/** Which bottom-bar section a path belongs to. */
export function sectionOf(pathname: string): Section {
  if (pathname.startsWith('/settings')) return 'settings';
  return 'gym';
}

/** Go back in history, or to `fallback` if this screen was opened directly. */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(fallback, { replace: true });
  };
}
