import React from 'react';
import Layout from './ui/Layout';
import Scene from './ui/Scene';
import Toolbar from './ui/Toolbar';
import Terminal from './ui/Terminal';
import StatusDisplay from './ui/StatusDisplay';

function App() {
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-200">
      <Layout
        toolbar={<Toolbar />}
        content={<Scene />}
        statusBar={<StatusDisplay />}
      />
      <Terminal />
    </div>
  );
}

export default App;