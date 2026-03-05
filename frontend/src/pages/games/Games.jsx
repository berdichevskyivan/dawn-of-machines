import { Link, useNavigate } from 'react-router';
import './Games.css'
import { useEffect } from 'react';
import { useState } from 'react';

function Games({socket}) {
  const navigate = useNavigate();

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // we retrieve the games when we render this component (Games)
    socket.emit('games-fetch');

    // we update state on update signal
    socket.on('games-update', (data) => {
      console.log('games-update called. data: ', data);
      setGames(data);
    })

    socket.on('starting-game-data', (data) => {
      localStorage.setItem('dom-player-socket', socket.id);
      localStorage.setItem('dom-game-room', data.room);

      setLoading(false);
      navigate('/game-room', { state: { startingGameData: data } });
    })

    return () => {
      socket.off('games-update');
      socket.off('starting-game-data');
    }
  }, [])

  const joinGame = (room) => {
    // TODO: Add frontend and backend validation before player joins room
    socket.emit('game-join', {room});
    setLoading(true);
  }

  return (
    <>
      <div className="title-screen-container">
        <h1>Games page</h1>
        <div className="games-container">
        { games.length > 0 && games.map((game, index)=>{ return (
          <div className="games-card" key={`game-${index}`}>
            <h1>{game.title}</h1>
            <button onClick={()=>{joinGame(game.room)}}>Join Game</button>
          </div>
        )})}
        </div>
        <Link to="/"><button className="title-screen-button">Title Screen</button></Link>
      </div>
    </>
  )
}

export default Games
