import React from 'react';
import { render } from 'solid-js/web';
import Layout from './components/Layout';
import SolidThreeScene from './components/SolidThreeScene';
import Toolbar from './components/Toolbar';
import StatusBar from './components/StatusBar';
import Terminal from './components/Terminal';

function App() {
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-200">
      <Layout
        toolbar={<Toolbar />}
        content={<SolidThreeScene />}
        statusBar={<StatusBar />}
      />
      <Terminal />
    </div>
  );
}

export default App;