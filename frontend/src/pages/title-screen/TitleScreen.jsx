import { Link, useNavigate } from 'react-router';
import './TitleScreen.css'
import { useState } from 'react';

function TitleScreen({socket}) {
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const startGame = () => {
    socket.emit('start-game');
    // wait here or in a useEffect for the bounce back of 'start-game', this means everything has been generated and processed,
    // in the meantime, here is where you place the logic to show the user a loading screen
    // setLoading(true)

    // for now, we navigate straight into the game room
    navigate('/game-room');
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
