import { useLocation, useNavigate } from 'react-router';

/** Go back in history, or to `fallback` if this screen was opened directly. */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(fallback, { replace: true });
  };
}
