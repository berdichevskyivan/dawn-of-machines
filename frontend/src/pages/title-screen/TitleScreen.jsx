import { Link, useNavigate } from 'react-router';
import './TitleScreen.css'
import { useState, useEffect } from 'react';

function TitleScreenIcon() {
  const [color, setColor] = useState('rgb(0, 255, 0)');

  // Use to change colors or animate the icon
  // to animate: change property, add transition on css
  // useEffect(() => {
  //   const colors = ['rgb(0, 255, 0)', 'rgb(0, 255, 255)', 'rgb(255, 215, 0)', 'rgb(128, 128, 175)'];
  //   let index = 0;

  //   const interval = setInterval(() => {
  //     index = (index + 1) % colors.length;
  //     setColor(colors[index]);
  //   }, 500);

  //   return () => clearInterval(interval);
  // }, []);

  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      {/* Triangle with outline */}
      <polygon 
        className="title-screen-icon-triangle"
        points="50,0 0,86.6 100,86.6" 
        fill="black" 
        stroke={color}
        strokeWidth="2" 
      />

      {/* Clip path for upper half of circle */}
      <defs>
        <clipPath id="upperHalf">
          <rect x="0" y="58.86" width="100" height="27.74" />
        </clipPath>
      </defs>

      {/* Circle with dynamic color */}
      <circle 
        className="title-screen-icon-circle"
        cx="50" 
        cy="86.6" 
        r="27.74" 
        fill={color} 
        clipPath="url(#upperHalf)" 
      />
    </svg>
  );
}

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
        <TitleScreenIcon />
        <h1 className="title-text">Dawn of Machines</h1>
        <button className="title-screen-button" onClick={startGame}>Start Game</button> 
        <Link to="/games"><button className="title-screen-button">Join Game</button></Link>
      </div>
    </>
  )
}

export default TitleScreen
