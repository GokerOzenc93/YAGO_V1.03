import React from 'react';
import Layout from './Layout';
import Scene from './Scene';
import Toolbar from './Toolbar';
import Terminal from './Terminal';
import StatusDisplay from './StatusDisplay';

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