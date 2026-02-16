import { Link } from 'react-router';
import './Games.css'
import { useEffect } from 'react';
import { useState } from 'react';

function Games({socket}) {

  const [games, setGames] = useState([]);

  useEffect(() => {
    // we retrieve the games when we render this component (Games)
    socket.emit('games-fetch');

    // we update state on update signal
    socket.on('games-update', (data) => {
      console.log('games-update called. data: ', data);
      setGames(data);
    })

    // always remember to remove the 'on' WHEN the component is destroyed
    return () => {
      socket.off('games-update');
    }
  }, [])

  return (
    <>
      <div className="title-screen-container">
        <h1>Games page</h1>
        <div className="games-container">
        { games.length > 0 && games.map((game, index)=>{ return (
          <div className="games-card" key={`game-${index}`}>
            <h1>{game.title}</h1>
            <button>Join Game</button>
          </div>
        )})}
        </div>
        <Link to="/"><button className="title-screen-button">Title Screen</button></Link>
      </div>
    </>
  )
}

export default Games
