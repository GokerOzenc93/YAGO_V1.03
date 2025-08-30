diff --git a/src/components/Terminal.tsx b/src/components/Terminal.tsx
index b9b5056e6254e66956e048c9e673240205293751..a461073f7cb05d1b7e3b7999b4c1d6951b0d7856 100644
--- a/src/components/Terminal.tsx
+++ b/src/components/Terminal.tsx
@@ -1,59 +1,67 @@
 import React, { useState, useRef, useEffect } from 'react';
 import { Terminal as TerminalIcon, ChevronUp, ChevronDown, Activity, Cpu, HardDrive, Camera, Ruler, MapPin, Send } from 'lucide-react';
 import { useAppStore, CameraType, Tool, ViewMode } from '../store/appStore';
 
 interface TerminalEntry {
   id: string;
   type: 'info' | 'success' | 'warning' | 'error' | 'input' | 'output' | 'command';
   message: string;
   details?: string;
   timestamp: Date;
 }
 
 const Terminal: React.FC = () => {
   const [isExpanded, setIsExpanded] = useState(false);
   const [entries, setEntries] = useState<TerminalEntry[]>([]);
   const [commandInput, setCommandInput] = useState('');
   const [commandHistory, setCommandHistory] = useState<string[]>([]);
   const [historyIndex, setHistoryIndex] = useState(-1);
   const terminalRef = useRef<HTMLDivElement>(null);
   const inputRef = useRef<HTMLInputElement>(null);
   const { 
-    activeTool, 
-    selectedShapeId, 
-    shapes, 
-    cameraType, 
-    measurementUnit, 
-    cameraPosition, 
-    convertToDisplayUnit, 
+    activeTool,
+    selectedShapeId,
+    shapes,
+    cameraType,
+    measurementUnit,
+    cameraPosition,
+    convertToDisplayUnit,
     convertToBaseUnit,
     viewMode, // 🎯 NEW: Get current view mode
     setViewMode, // 🎯 NEW: Set view mode
     cycleViewMode // 🎯 NEW: Cycle view mode
   } = useAppStore();
 
+  // Expose terminal input ref globally for external focus control
+  useEffect(() => {
+    (window as any).terminalInputRef = inputRef;
+    return () => {
+      delete (window as any).terminalInputRef;
+    };
+  }, []);
+
   const addEntry = (type: TerminalEntry['type'], message: string, details?: string) => {
     const newEntry: TerminalEntry = {
       id: Math.random().toString(36).substr(2, 9),
       type,
       message,
       details,
       timestamp: new Date()
     };
     
     setEntries(prev => [...prev.slice(-49), newEntry]); // Keep last 50 entries
   };
 
   // Handle command execution
   const executeCommand = (command: string) => {
     const trimmedCommand = command.trim();
     if (!trimmedCommand) return;
 
     // Add command to history
     setCommandHistory(prev => [...prev.slice(-19), trimmedCommand]); // Keep last 20 commands
     setHistoryIndex(-1);
 
     // Log the command
     addEntry('command', `> ${trimmedCommand}`, 'User command executed');
 
     // Handle other commands
