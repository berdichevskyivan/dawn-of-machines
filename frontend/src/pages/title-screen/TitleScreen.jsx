import { Link, useNavigate } from 'react-router';
import './TitleScreen.css'
import { useState, useEffect } from 'react';

function TitleScreen({socket}) {
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    socket.on('starting-game-data', (data) => {

      // Update localStorage with current socket ID
      localStorage.setItem('dom-player-socket', socket.id);
      localStorage.setItem('dom-game-room', data.room);

      setLoading(false);
      navigate('/game-room', { state: { startingGameData: data } });
    })

    return () => {
      socket.off('starting-game-data');
    }
  }, [])

  const startGame = () => {
    // TODO: before we start the game, we need to check if this socket has already started a game.
    socket.emit('game-start');
    setLoading(true);
  }

  return (
    <>
      <div className="title-screen-container">
        <h1>Dawn of Machines</h1>
        <button className="title-screen-button" onClick={startGame}>Start Game</button> 
        <Link to="/games"><button className="title-screen-button">Join Game</button></Link>
      </div>
    </>
  )
}

export default TitleScreen
