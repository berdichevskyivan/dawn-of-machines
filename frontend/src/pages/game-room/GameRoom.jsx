import { Link } from 'react-router';
import './GameRoom.css';

function GameRoom({socket}){
    return (
        <div className="game-room-container">
            <h1>Game Room</h1>
            <Link to="/"><button className="title-screen-button">Title Screen</button></Link>
        </div>
    );
}

export default GameRoom