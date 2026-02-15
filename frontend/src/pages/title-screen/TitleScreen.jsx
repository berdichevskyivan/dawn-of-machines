import { Link } from 'react-router';
import './TitleScreen.css'

function TitleScreen({socket}) {
  return (
    <>
      <div className="title-screen-container">
        <h1>Dawn of Machines</h1>
        <button className="title-screen-button" onClick={()=>{ socket.emit('signal', { niceArrayHere: [1,2,3,4,5,'helloworld'] }) }}>Start Game</button> 
        <Link to="/games"><button className="title-screen-button">Join Game</button></Link>
      </div>
    </>
  )
}

export default TitleScreen
