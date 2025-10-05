import React from 'react';
import Editor from '@monaco-editor/react';
import { useAppStore } from '../core/appStore';

const ScriptEditor: React.FC = () => {
  const { scriptContent, setScriptContent } = useAppStore();

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setScriptContent(value);
    }
  };

  return (
    <div className="h-full bg-gray-900">
      <Editor
        height="100%"
        defaultLanguage="javascript"
        theme="vs-dark"
        value={scriptContent}
        onChange={handleEditorChange}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
};

export default ScriptEditor;