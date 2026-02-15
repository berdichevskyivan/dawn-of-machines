import { Link } from 'react-router';
import './Games.css'

function Games({socket}) {
  return (
    <>
      <div className="title-screen-container">
        <h1>Games page</h1>
        <Link to="/"><button className="title-screen-button">Title Screen</button></Link>
      </div>
    </>
  )
}

export default Games
