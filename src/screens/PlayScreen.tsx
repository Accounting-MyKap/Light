import { useParams } from 'react-router-dom';

export function PlayScreen() {
  const { gameId } = useParams();
  return <h1>{gameId}</h1>;
}
