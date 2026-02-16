import { useState, useEffect } from 'react'
import { socket } from './socket';
import { BrowserRouter, Routes, Route } from 'react-router';
import TitleScreen from './pages/title-screen/TitleScreen';
import Games from './pages/games/Games';
import GameRoom from './pages/game-room/GameRoom';
import './App.css'

function App() {
  const [connected, setConnected] = useState(false);

  useEffect(()=>{
    socket.connect();
    setConnected(true);

    return () => {
      socket.disconnect();
      setConnected(false);
    }
  }, [])

  return (
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<TitleScreen socket={socket} />} />
            <Route path="/games" element={<Games socket={socket} />} />
            <Route path="/game-room" element={<GameRoom socket={socket} />} />
        </Routes>
    </BrowserRouter>
  )
}

export default App
