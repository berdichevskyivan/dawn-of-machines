import { Link, useNavigate } from 'react-router';
import './TitleScreen.css'
import { useState, useEffect } from 'react';

function TitleScreen({socket}) {
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const startGame = () => {
    // TODO: before we start the game, we need to check if this socket has already started a game.

    socket.emit('game-start');
    // wait here or in a useEffect for the bounce back of 'game-start', this means everything has been generated and processed,
    // in the meantime, here is where you place the logic to show the user a loading screen
    setLoading(true)

    socket.on('starting-game-data', (data) => {
      setLoading(false);
      navigate('/game-room', { state: { startingGameData: data } });
    })
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
