import React, { useRef, useEffect, useMemo, useState } from 'react'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { useAppStore, ViewMode } from '../store/appStore'
import { Shape, SHAPE_COLORS } from '../types/shapes'
import {
  createBox as createOcBox,
  createCylinder as createOcCylinder,
  ocShapeToThreeGeometry,
} from '../lib/opencascadeUtils'

interface Props {
  shape: Shape
  onContextMenuRequest?: (event: any, shape: Shape) => void
  isEditMode?: boolean
  isBeingEdited?: boolean
  isFaceEditMode?: boolean
  selectedFaceIndex?: number | null
  onFaceSelect?: (faceIndex: number) => void
  isVolumeEditMode?: boolean
}

const OCC_POLL_MS = 250

const OpenCascadeShape: React.FC<Props> = ({
  shape,
  onContextMenuRequest,
  isEditMode = false,
  isBeingEdited = false,
  isFaceEditMode = false,
  isVolumeEditMode = false,
}) => {
  // 1) Erken dönüş: shape yoksa render etme
  if (!shape) return null

  const objectGroupRef = useRef<THREE.Group>(null)
  const transformRef = useRef<any>(null)
  const meshRef = useRef<THREE.Mesh>(null)

  const { activeTool, selectedShapeId, setSelectedObjectPosition, viewMode } = useAppStore()
  const isSelected = selectedShapeId === shape.id

  // Geometri state
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)

  // --- OCC ile geometri oluşturma + hazır değilse polling ---
  useEffect(() => {
    let isMounted = true
    let poll: any

    const build = async () => {
      const ocInstance = (window as any)?.oc
      if (!ocInstance) return

      try {
        let ocShape: any
        if (shape.type === 'box') {
          const { width, height, depth } = shape.parameters as any
          ocShape = createOcBox(ocInstance, width, height, depth)
        } else if (shape.type === 'cylinder') {
          const { radius, height } = shape.parameters as any
          ocShape = createOcCylinder(ocInstance, radius, height)
        } else {
          // Desteklenmeyen tip: geometriyi temizle
          if (isMounted) setGeometry(null)
          return
        }

        const threeGeom = ocShapeToThreeGeometry(ocInstance, ocShape)
        if (threeGeom) {
          // Normaller yoksa bazı materyallerde kararma olur
          if (!threeGeom.getAttribute('normal')) threeGeom.computeVertexNormals()
          if (isMounted) setGeometry(threeGeom)
        }
      } catch (err) {
        console.error(`Geometri oluşturulurken hata (shape: ${shape.id})`, err)
      }
    }

    // İlk dene, yoksa poll ile bekle
    if ((window as any)?.oc) {
      build()
    } else {
      poll = setInterval(() => {
        if ((window as any)?.oc) {
          clearInterval(poll)
          build()
        }
      }, OCC_POLL_MS)
    }

    return () => {
      isMounted = false
      if (poll) clearInterval(poll)
      // Leak önleme
      setGeometry((g) => {
        if (g) g.dispose()
        return null
      })
    }
  }, [shape.id, shape.type, shape.parameters])

  // Kenar geometrisi (EdgesGeometry) — BufferGeometry’dan doğrudan üret
  const edgesGeometry = useMemo(() => {
    if (!geometry) return null
    const eg = new THREE.EdgesGeometry(geometry)
    return eg
  }, [geometry])

  // Kenar geometri temizliği
  useEffect(() => {
    return () => {
      if (edgesGeometry) edgesGeometry.dispose()
    }
  }, [edgesGeometry])

  // TransformControls değişiminde store’u güncelle
  useEffect(() => {
    const controls = transformRef.current
    const target = objectGroupRef.current
    if (!controls || !target) return

    const handleObjectChange = () => {
      const { position, rotation, scale } = target
      useAppStore.getState().updateShape(shape.id, {
        position: position.toArray() as [number, number, number],
        rotation: new THREE.Euler().copy(rotation).toArray().slice(0, 3) as [number, number, number],
        scale: scale.toArray() as [number, number, number],
      })
      if (isSelected) setSelectedObjectPosition(position.toArray() as [number, number, number])
    }

    const handleDraggingChanged = (e: any) => {
      // İsterseniz burada OrbitControls devre dışı/etkin yapılabilir
      // window.dispatchEvent(new CustomEvent('r3f-dragging', { detail: e.value }))
    }

    controls.addEventListener('objectChange', handleObjectChange)
    controls.addEventListener('dragging-changed', handleDraggingChanged)
    return () => {
      controls.removeEventListener('objectChange', handleObjectChange)
      controls.removeEventListener('dragging-changed', handleDraggingChanged)
    }
  }, [shape.id, isSelected, setSelectedObjectPosition])

  // Geometri hazır değilse hiç render etme
  if (!geometry || !edgesGeometry) return null

  const getShapeColor = () => {
    if (isBeingEdited) return '#ff6b35'
    if (isSelected) return '#60a5fa'
    if (isEditMode && !isBeingEdited) return '#6b7280'
    return SHAPE_COLORS[shape.type as keyof typeof SHAPE_COLORS] || '#94a3b8'
  }

  const handlePointerDown = (e: any) => {
    // Sadece sol tık
    if (e.button !== 0) return
    e.stopPropagation()
    useAppStore.getState().selectShape(shape.id)
  }

  const handleContextMenu = (e: any) => {
    if (!isSelected || !onContextMenuRequest) return
    e.stopPropagation()
    e.nativeEvent.preventDefault()
    onContextMenuRequest(e, shape)
  }

  const color = getShapeColor()

  // Mesh + edges aynı grup altında; TransformControls gruba uygulanır
  return (
    <group key={shape.id}>
      <group
        ref={objectGroupRef}
        position={shape.position}
        rotation={new THREE.Euler(...(shape.rotation as any))}
        scale={shape.scale}
        onPointerDown={handlePointerDown}
        onContextMenu={handleContextMenu}
        // raycast sadece mesh’e delege edilsin isterseniz: raycast={THREE.Mesh.prototype.raycast}
      >
        <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow visible={viewMode === ViewMode.SOLID}>
          <meshPhysicalMaterial color={color} transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>

        <lineSegments geometry={edgesGeometry} visible>
          <lineBasicMaterial color={viewMode === ViewMode.SOLID ? '#000000' : color} />
        </lineSegments>
      </group>

      {isSelected && !isEditMode && !isFaceEditMode && (
        <TransformControls
          ref={transformRef}
          object={objectGroupRef.current as unknown as THREE.Object3D | undefined}
          mode={
            activeTool === 'Move' ? 'translate' : activeTool === 'Rotate' ? 'rotate' : 'scale'
          }
          // scale ile uniform/xyz ayrı ayrı istiyorsanız snapping/axis props ekleyin
        />
      )}
    </group>
  )
}

export default OpenCascadeShape
