import { useState, useCallback, useRef } from 'react';
import * as THREE from 'three';

export interface EdgeLine {
  id: string;
  value: number;
  label: string;
  shapeId: string;
  edgeIndex: number;
  startVertex: [number, number, number];
  endVertex: [number, number, number];
  formula?: string;
}

export interface EdgeInteractionState {
  hoveredEdgeId: string | null;
  selectedEdges: EdgeLine[];
  isSelectionMode: boolean;
}

export interface EdgeInteractionActions {
  setHoveredEdge: (edgeId: string | null) => void;
  addEdge: (edge: EdgeLine) => void;
  removeEdge: (edgeId: string) => void;
  updateEdgeValue: (edgeId: string, value: number) => void;
  updateEdgeFormula: (edgeId: string, formula: string) => void;
  updateEdgeLabel: (edgeId: string, label: string) => void;
  updateEdgeVertices: (edgeId: string, endVertex: [number, number, number]) => void;
  clearAllEdges: () => void;
  toggleSelectionMode: () => void;
  findEdgeById: (edgeId: string) => EdgeLine | undefined;
  hasEdgeWithLabel: (label: string) => boolean;
}

export function useEdgeInteraction(
  initialEdges: EdgeLine[] = []
): [EdgeInteractionState, EdgeInteractionActions] {
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [selectedEdges, setSelectedEdges] = useState<EdgeLine[]>(initialEdges);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const edgeMapRef = useRef(new Map<string, EdgeLine>());

  const updateEdgeMap = useCallback((edges: EdgeLine[]) => {
    edgeMapRef.current.clear();
    edges.forEach(edge => {
      edgeMapRef.current.set(edge.id, edge);
    });
  }, []);

  const setHoveredEdge = useCallback((edgeId: string | null) => {
    setHoveredEdgeId(edgeId);
  }, []);

  const addEdge = useCallback((edge: EdgeLine) => {
    setSelectedEdges(prev => {
      const exists = prev.some(e => e.id === edge.id);
      if (exists) {
        console.warn(`⚠️ Edge with id ${edge.id} already exists`);
        return prev;
      }
      const newEdges = [...prev, edge];
      updateEdgeMap(newEdges);
      console.log(`✅ Edge added: ${edge.label || edge.id}`);
      return newEdges;
    });
  }, [updateEdgeMap]);

  const removeEdge = useCallback((edgeId: string) => {
    setSelectedEdges(prev => {
      const newEdges = prev.filter(e => e.id !== edgeId);
      updateEdgeMap(newEdges);
      console.log(`🗑️ Edge removed: ${edgeId}`);
      return newEdges;
    });
  }, [updateEdgeMap]);

  const updateEdgeValue = useCallback((edgeId: string, value: number) => {
    setSelectedEdges(prev => {
      const newEdges = prev.map(e =>
        e.id === edgeId ? { ...e, value } : e
      );
      updateEdgeMap(newEdges);
      return newEdges;
    });
  }, [updateEdgeMap]);

  const updateEdgeFormula = useCallback((edgeId: string, formula: string) => {
    setSelectedEdges(prev => {
      const newEdges = prev.map(e =>
        e.id === edgeId ? { ...e, formula } : e
      );
      updateEdgeMap(newEdges);
      return newEdges;
    });
  }, [updateEdgeMap]);

  const updateEdgeLabel = useCallback((edgeId: string, label: string) => {
    setSelectedEdges(prev => {
      const newEdges = prev.map(e =>
        e.id === edgeId ? { ...e, label } : e
      );
      updateEdgeMap(newEdges);
      return newEdges;
    });
  }, [updateEdgeMap]);

  const updateEdgeVertices = useCallback((edgeId: string, endVertex: [number, number, number]) => {
    setSelectedEdges(prev => {
      const newEdges = prev.map(e =>
        e.id === edgeId ? { ...e, endVertex } : e
      );
      updateEdgeMap(newEdges);
      return newEdges;
    });
  }, [updateEdgeMap]);

  const clearAllEdges = useCallback(() => {
    setSelectedEdges([]);
    edgeMapRef.current.clear();
    console.log('🗑️ All edges cleared');
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => !prev);
  }, []);

  const findEdgeById = useCallback((edgeId: string): EdgeLine | undefined => {
    return edgeMapRef.current.get(edgeId);
  }, []);

  const hasEdgeWithLabel = useCallback((label: string): boolean => {
    return Array.from(edgeMapRef.current.values()).some(
      edge => edge.label === label
    );
  }, []);

  const state: EdgeInteractionState = {
    hoveredEdgeId,
    selectedEdges,
    isSelectionMode,
  };

  const actions: EdgeInteractionActions = {
    setHoveredEdge,
    addEdge,
    removeEdge,
    updateEdgeValue,
    updateEdgeFormula,
    updateEdgeLabel,
    updateEdgeVertices,
    clearAllEdges,
    toggleSelectionMode,
    findEdgeById,
    hasEdgeWithLabel,
  };

  return [state, actions];
}
