import { useState, useEffect } from 'react'
import { socket } from './socket';
import { BrowserRouter, Routes, Route } from 'react-router';
import Games from './pages/games/Games';
import TitleScreen from './pages/title-screen/TitleScreen';
import './App.css'

function App() {
  useEffect(()=>{
    socket.connect();

    socket.on('back-signal', (data)=>{
      console.log('we received a signal back from server');
      console.log('data we received from server: ', data);
      console.log('Client Time: ', new Date(Date.now()));
    })

    return () => {
      socket.disconnect();
    }
  }, [])

  return (
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<TitleScreen socket={socket} />} />
            <Route path="/games" element={<Games socket={socket} />} />
        </Routes>
    </BrowserRouter>
  )
}

export default App
