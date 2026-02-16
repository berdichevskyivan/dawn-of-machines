import { Link } from 'react-router';
import './TitleScreen.css'

function TitleScreen({socket}) {

  const startGame = () => {
    socket.emit('start-game')
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
