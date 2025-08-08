<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Three.js Yüzey Vurgulama</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <style>
        body { margin: 0; overflow: hidden; font-family: 'Inter', sans-serif; }
        canvas { display: block; }
        #info {
            position: absolute;
            top: 10px;
            left: 10px;
            color: white;
            background: rgba(0, 0, 0, 0.5);
            padding: 10px;
            border-radius: 8px;
            font-size: 14px;
            pointer-events: none; /* Allows clicks to pass through */
        }
        .controls {
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            padding: 15px;
            border-radius: 12px;
            display: flex;
            gap: 10px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        .controls button {
            background-color: #4CAF50; /* Green */
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            transition: background-color 0.3s ease, transform 0.2s ease;
            box-shadow: 0 4px #388E3C; /* Darker green shadow */
        }
        .controls button:hover {
            background-color: #45a049;
            transform: translateY(-2px);
            box-shadow: 0 6px #388E3C;
        }
        .controls button:active {
            background-color: #3e8e41;
            transform: translateY(2px);
            box-shadow: 0 2px #388E3C;
        }
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
</head>
<body>
    <div id="info">
        Tıklanan Yüzey: Yok<br>
        Tıklanan Nokta (Dünya): Yok
    </div>
    <div class="controls">
        <button id="addBox">Kutu Ekle</button>
        <button id="addCylinder">Silindir Ekle</button>
        <button id="addPolygon">Poligon Ekle</button>
    </div>

    <script>
        // --- Shape Interface and Face Utility Functions (Copied from face-geometry-utils.ts) ---

        // Placeholder for Shape type if not available
        interface Shape {
          type: 'box' | 'rectangle2d' | 'cylinder' | 'circle2d' | 'polyline2d' | 'polygon2d' | 'polyline3d' | 'polygon3d';
          parameters: {
            width?: number;
            height?: number;
            depth?: number;
            radius?: number;
            [key: string]: any; // Allows for other parameters
          };
          scale: [number, number, number];
          position: [number, number, number];
          rotation: [number, number, number]; // Euler angles
          quaternion?: THREE.Quaternion; // Preferred for rotations, dynamically updated
          originalPoints?: THREE.Vector3[]; // For extruded shapes
          geometry: THREE.BufferGeometry; // Reference to the actual THREE.js geometry
          mesh?: THREE.Mesh; // Reference to the THREE.Mesh object in the scene
        }

        interface FaceInfo {
          index: number;
          name: string;
          center: THREE.Vector3;
          normal: THREE.Vector3;
          area: number;
          vertices: THREE.Vector3[];
        }

        const getFaceInfo = (shape: Shape): FaceInfo[] => {
          const faces: FaceInfo[] = [];
          
          switch (shape.type) {
            case 'box':
            case 'rectangle2d':
              return getBoxFaces(shape);
            
            case 'cylinder':
            case 'circle2d':
              return getCylinderFaces(shape);
            
            case 'polyline2d':
            case 'polygon2d':
            case 'polyline3d':
            case 'polygon3d':
              return getExtrudedShapeFaces(shape);
            
            default:
              console.warn(`Face selection not implemented for shape type: ${shape.type}`);
              return [];
          }
        };

        const getBoxFaces = (shape: Shape): FaceInfo[] => {
          const { width = 500, height = 500, depth = 500 } = shape.parameters;
          const hw = (width * shape.scale[0]) / 2;
          const hh = (height * shape.scale[1]) / 2;
          const hd = (depth * shape.scale[2]) / 2;
          
          return [
            {
              index: 0,
              name: 'Front',
              center: new THREE.Vector3(0, 0, hd),
              normal: new THREE.Vector3(0, 0, 1),
              area: width * height,
              vertices: [
                new THREE.Vector3(-hw, -hh, hd),
                new THREE.Vector3(hw, -hh, hd),
                new THREE.Vector3(hw, hh, hd),
                new THREE.Vector3(-hw, hh, hd)
              ]
            },
            {
              index: 1,
              name: 'Back',
              center: new THREE.Vector3(0, 0, -hd),
              normal: new THREE.Vector3(0, 0, -1),
              area: width * height,
              vertices: [
                new THREE.Vector3(hw, -hh, -hd),
                new THREE.Vector3(-hw, -hh, -hd),
                new THREE.Vector3(-hw, hh, -hd),
                new THREE.Vector3(hw, hh, -hd)
              ]
            },
            {
              index: 2,
              name: 'Top',
              center: new THREE.Vector3(0, hh, 0),
              normal: new THREE.Vector3(0, 1, 0),
              area: width * depth,
              vertices: [
                new THREE.Vector3(-hw, hh, -hd),
                new THREE.Vector3(hw, hh, -hd),
                new THREE.Vector3(hw, hh, hd),
                new THREE.Vector3(-hw, hh, hd)
              ]
            },
            {
              index: 3,
              name: 'Bottom',
              center: new THREE.Vector3(0, -hh, 0),
              normal: new THREE.Vector3(0, -1, 0),
              area: width * depth,
              vertices: [
                new THREE.Vector3(-hw, -hh, hd),
                new THREE.Vector3(hw, -hh, hd),
                new THREE.Vector3(hw, -hh, -hd),
                new THREE.Vector3(-hw, -hh, -hd)
              ]
            },
            {
              index: 4,
              name: 'Right',
              center: new THREE.Vector3(hw, 0, 0),
              normal: new THREE.Vector3(1, 0, 0),
              area: height * depth,
              vertices: [
                new THREE.Vector3(hw, -hh, hd),
                new THREE.Vector3(hw, -hh, -hd),
                new THREE.Vector3(hw, hh, -hd),
                new THREE.Vector3(hw, hh, hd)
              ]
            },
            {
              index: 5,
              name: 'Left',
              center: new THREE.Vector3(-hw, 0, 0),
              normal: new THREE.Vector3(-1, 0, 0),
              area: height * depth,
              vertices: [
                new THREE.Vector3(-hw, -hh, -hd),
                new THREE.Vector3(-hw, -hh, hd),
                new THREE.Vector3(-hw, hh, hd),
                new THREE.Vector3(-hw, hh, -hd)
              ]
            }
          ];
        };

        const getCylinderFaces = (shape: Shape): FaceInfo[] => {
          const { radius = 250, height = 500 } = shape.parameters;
          const r = radius * Math.max(shape.scale[0], shape.scale[2]);
          const h = height * shape.scale[1];
          const hh = h / 2;
          
          const faces: FaceInfo[] = [
            {
              index: 0,
              name: 'Top',
              center: new THREE.Vector3(0, hh, 0),
              normal: new THREE.Vector3(0, 1, 0),
              area: Math.PI * r * r,
              vertices: []
            },
            {
              index: 1,
              name: 'Bottom',
              center: new THREE.Vector3(0, -hh, 0),
              normal: new THREE.Vector3(0, -1, 0),
              area: Math.PI * r * r,
              vertices: []
            }
          ];
          
          const segments = 8;
          for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const nextAngle = ((i + 1) / segments) * Math.PI * 2;
            
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;
            const nextX = Math.cos(nextAngle) * r;
            const nextZ = Math.sin(nextAngle) * r;
            
            faces.push({
              index: i + 2,
              name: `Side ${i + 1}`,
              center: new THREE.Vector3(
                (x + nextX) / 2, 
                0, 
                (z + nextZ) / 2
              ), // More accurate center for the segment
              // Normal points outwards from the center of the cylinder at this segment
              normal: new THREE.Vector3(Math.cos(angle + segmentAngle / 2), 0, Math.sin(angle + segmentAngle / 2)).normalize(),
              area: (2 * Math.PI * r * h) / segments, // Approximate segment area
              vertices: [
                new THREE.Vector3(x, -hh, z),
                new THREE.Vector3(nextX, -hh, nextZ),
                new THREE.Vector3(nextX, hh, nextZ),
                new THREE.Vector3(x, hh, z)
              ]
            });
          }
          
          return faces;
        };

        const getExtrudedShapeFaces = (shape: Shape): FaceInfo[] => {
          const faces: FaceInfo[] = [];
          
          if (!shape.originalPoints || shape.originalPoints.length < 3) {
            console.warn('No original points found for extruded shape, using fallback geometry analysis');
            return getGeometryBasedFaces(shape);
          }
          
          const points = shape.originalPoints;
          const height = shape.parameters.height || 500;
          const hh = (height * shape.scale[1]) / 2;
          
          // Top face
          const topCenter = calculatePolygonCenter(points);
          topCenter.y = hh;
          
          faces.push({
            index: 0,
            name: 'Top',
            center: topCenter,
            normal: new THREE.Vector3(0, 1, 0),
            area: calculatePolygonArea(points),
            vertices: points.map(p => new THREE.Vector3(p.x, hh, p.z))
          });
          
          // Bottom face
          const bottomCenter = topCenter.clone();
          bottomCenter.y = -hh;
          
          faces.push({
            index: 1,
            name: 'Bottom',
            center: bottomCenter,
            normal: new THREE.Vector3(0, -1, 0),
            area: calculatePolygonArea(points),
            vertices: points.map(p => new THREE.Vector3(p.x, -hh, p.z)).reverse()
          });
          
          // Side faces
          const uniquePoints = points.length > 2 && points[points.length - 1].equals(points[0])  
            ? points.slice(0, -1)  
            : points;
          
          for (let i = 0; i < uniquePoints.length; i++) {
            const current = uniquePoints[i];
            const next = uniquePoints[(i + 1) % uniquePoints.length];
            
            const edgeCenter = new THREE.Vector3(
              (current.x + next.x) / 2,
              0,
              (current.z + next.z) / 2
            );
            
            const edgeVector = new THREE.Vector3().subVectors(next, current);
            const normal = new THREE.Vector3(-edgeVector.z, 0, edgeVector.x).normalize();
            
            const edgeLength = edgeVector.length();
            
            faces.push({
              index: i + 2,
              name: `Side ${i + 1}`,
              center: edgeCenter,
              normal: normal,
              area: edgeLength * height,
              vertices: [
                new THREE.Vector3(current.x, -hh, current.z),
                new THREE.Vector3(next.x, -hh, next.z),
                new THREE.Vector3(next.x, hh, next.z),
                new THREE.Vector3(current.x, hh, current.z)
              ]
            });
          }
          
          return faces;
        };

        const findFaceAtIntersection = (
          intersectionPoint: THREE.Vector3, 
          intersectionNormal: THREE.Vector3,
          shape: Shape,
          raycastIntersection?: THREE.Intersection 
        ): number | null => {
          const faces = getFaceInfo(shape);
          if (faces.length === 0) return null;
          
          const shapePosition = new THREE.Vector3(...shape.position);
          const worldPoint = intersectionPoint.clone();
          
          const shapeQuaternion = shape.quaternion || new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation));

          const localIntersectionNormal = intersectionNormal.clone().applyQuaternion(shapeQuaternion.clone().invert()).normalize();
          const localPoint = worldPoint.clone().sub(shapePosition).applyQuaternion(shapeQuaternion.clone().invert());
          
          console.log(`🎯 Finding face at intersection for ${shape.type}:`);
          console.log(`🎯 Intersection point (world): [${intersectionPoint.x.toFixed(1)}, ${intersectionPoint.y.toFixed(1)}, ${intersectionPoint.z.toFixed(1)}]`);
          console.log(`🎯 Intersection normal (world): [${intersectionNormal.x.toFixed(2)}, ${intersectionNormal.y.toFixed(2)}, ${intersectionNormal.z.toFixed(2)}]`);
          console.log(`🎯 Local intersection point: [${localPoint.x.toFixed(1)}, ${localPoint.y.toFixed(1)}, ${localPoint.z.toFixed(1)}]`);
          console.log(`🎯 Local intersection normal: [${localIntersectionNormal.x.toFixed(2)}, ${localIntersectionNormal.y.toFixed(2)}, ${localIntersectionNormal.z.toFixed(2)}]`);
          console.log(`🎯 Shape position: [${shapePosition.x.toFixed(1)}, ${shapePosition.y.toFixed(1)}, ${shapePosition.z.toFixed(1)}]`);
          console.log(`🎯 Available faces: ${faces.length} faces for ${shape.type}`);
          console.log(`🎯 Face names: ${faces.map(f => f.name).join(', ')}`);

          if (raycastIntersection && raycastIntersection.face) {
            const raycastFaceNormal = raycastIntersection.face.normal; 
            
            const directFaceMatches = faces.map(face => {
              const similarity = Math.abs(raycastFaceNormal.dot(face.normal));
              return { index: face.index, name: face.name, similarity: similarity };
            }).sort((a, b) => b.similarity - a.similarity);

            const bestDirectMatch = directFaceMatches[0];
            if (bestDirectMatch && bestDirectMatch.similarity > 0.95) { 
              console.log(`🎯 Direct raycast face match: ${bestDirectMatch.name} (${bestDirectMatch.index}) with similarity ${bestDirectMatch.similarity.toFixed(3)}`);
              return bestDirectMatch.index;
            } else if (bestDirectMatch && bestDirectMatch.similarity > 0.5) { 
                console.log(`🎯 Direct raycast face suggested (medium confidence): ${bestDirectMatch.name} (${bestDirectMatch.index}) with similarity ${bestDirectMatch.similarity.toFixed(3)}`);
            }
          }

          const faceMatches = faces.map(face => {
            const normalSimilarity = Math.abs(localIntersectionNormal.dot(face.normal));
            const distanceToCenter = localPoint.distanceTo(face.center);
            const pointToFaceVector = localPoint.clone().sub(face.center);
            const projectionDistance = Math.abs(pointToFaceVector.dot(face.normal));
            const isNearFacePlane = projectionDistance < 50; 
            
            const normalWeight = 100; 
            const planeProximityWeight = 50; 
            const distanceWeight = 1 / (distanceToCenter + 1); 
            
            let score = 0;
            if (isNearFacePlane) {
                score = (normalSimilarity * normalWeight) + (planeProximityWeight * (1 - Math.min(projectionDistance / 50, 1))) + distanceWeight;
            } else {
                score = normalSimilarity * normalWeight * 0.1; 
            }

            return {
              index: face.index,
              name: face.name,
              normalSimilarity: normalSimilarity,
              distanceToCenter: distanceToCenter,
              projectionDistance: projectionDistance,
              isNearFacePlane: isNearFacePlane,
              score: score
            };
          }).sort((a, b) => b.score - a.score); 

          console.log(`🎯 Face matches (sorted by score):`, faceMatches.slice(0, 3).map(f => 
            `${f.name}(${f.index}): score=${f.score.toFixed(2)}, sim=${f.normalSimilarity.toFixed(3)}, dist=${f.distanceToCenter.toFixed(1)}mm, proj=${f.projectionDistance.toFixed(1)}mm ${f.isNearFacePlane ? '✓' : '✗'}`
          ).join(', '));
          
          const bestMatch = faceMatches[0];
          if (bestMatch && bestMatch.normalSimilarity > 0.05 && bestMatch.isNearFacePlane) { 
            console.log(`🎯 Best face match: ${bestMatch.name} (${bestMatch.index}) with similarity ${bestMatch.normalSimilarity.toFixed(3)}`);
            return bestMatch.index;
          }
          
          console.log(`🎯 No sufficiently good face match found via heuristics. Returning null.`);
          return bestMatch?.index || null; 
        };

        export const getFaceGeometry = (shape: Shape, faceIndex: number): {
          geometry: THREE.BufferGeometry;
          position: THREE.Vector3;
          rotation: THREE.Euler;
        } | null => {
          const faces = getFaceInfo(shape);
          const face = faces.find(f => f.index === faceIndex);
          
          if (!face) return null;

          let geometry: THREE.BufferGeometry;
          
          console.log(`🎯 Creating face geometry for ${shape.type}, face ${faceIndex} (${face.name})`);
          console.log(`🎯 Face center (local): [${face.center.x.toFixed(1)}, ${face.center.y.toFixed(1)}, ${face.center.z.toFixed(1)}]`);
          console.log(`🎯 Face normal (local): [${face.normal.x.toFixed(2)}, ${face.normal.y.toFixed(2)}, ${face.normal.z.toFixed(2)}]`);
          console.log(`🎯 Face area: ${face.area.toFixed(1)}mm²`);
          
          switch (shape.type) {
            case 'box':
            case 'rectangle2d': {
              const { width: w = 500, height: h = 500, depth: d = 500 } = shape.parameters;
              const scaledW = w * shape.scale[0];
              const scaledH = h * shape.scale[1];
              const scaledD = d * shape.scale[2];
              
              if (faceIndex === 0 || faceIndex === 1) { // Front/Back
                geometry = new THREE.PlaneGeometry(scaledW, scaledH);
              } else if (faceIndex === 2 || faceIndex === 3) { // Top/Bottom
                geometry = new THREE.PlaneGeometry(scaledW, scaledD);
              } else { // Left/Right
                geometry = new THREE.PlaneGeometry(scaledD, scaledH);
              }
              console.log(`🎯 Box face geometry: ${scaledW.toFixed(1)}x${scaledH.toFixed(1)}x${scaledD.toFixed(1)}mm`);
              break;
            }
            
            case 'cylinder':
            case 'circle2d': {
              const { radius = 250, height: h = 500 } = shape.parameters;
              const scaledR = radius * Math.max(shape.scale[0], shape.scale[2]);
              const scaledH = h * shape.scale[1];
              
              if (faceIndex === 0 || faceIndex === 1) { // Top/Bottom
                geometry = new THREE.CircleGeometry(scaledR, 32);
                console.log(`🎯 Cylinder top/bottom: radius ${scaledR.toFixed(1)}mm`);
              } else { // Side segments
                const segmentAngle = (Math.PI * 2) / 8;
                const segmentWidth = 2 * scaledR * Math.sin(segmentAngle / 2);
                geometry = new THREE.PlaneGeometry(segmentWidth, scaledH);
                console.log(`🎯 Cylinder side segment: ${segmentWidth.toFixed(1)}x${scaledH.toFixed(1)}mm`);
              }
              break;
            }
            
            case 'polyline2d':
            case 'polygon2d':
            case 'polyline3d':
            case 'polygon3d': {
              const h = (shape.parameters.height || 500) * shape.scale[1];
              
              if (faceIndex === 0 || faceIndex === 1) { // Top/Bottom
                if (shape.originalPoints && shape.originalPoints.length >= 3) {
                  const uniquePoints = shape.originalPoints.length > 2 &&  
                    shape.originalPoints[shape.originalPoints.length - 1].equals(shape.originalPoints[0])  
                    ? shape.originalPoints.slice(0, -1)  
                    : shape.originalPoints;
                  
                  const points2D = uniquePoints.map(p => new THREE.Vector2(p.x, p.z));
                  const shapeGeom = new THREE.Shape(points2D);
                  geometry = new THREE.ShapeGeometry(shapeGeom);
                  console.log(`🎯 Polyline top/bottom: ${uniquePoints.length} points, area ${face.area.toFixed(1)}mm²`);
                } else {
                  shape.geometry.computeBoundingBox();
                  const bbox = shape.geometry.boundingBox;
                  if (bbox) {
                    const w = (bbox.max.x - bbox.min.x) * shape.scale[0];
                    const d = (bbox.max.z - bbox.min.z) * shape.scale[2];
                    geometry = new THREE.PlaneGeometry(w, d);
                    console.log(`🎯 Polyline fallback top/bottom: ${w.toFixed(1)}x${d.toFixed(1)}mm`);
                  } else {
                    geometry = new THREE.PlaneGeometry(100, 100);
                    console.log(`🎯 Polyline default top/bottom: 100x100mm`);
                  }
                }
              } else { // Side faces
                if (shape.originalPoints && faceIndex - 2 < shape.originalPoints.length) {
                  const i = faceIndex - 2;
                  const uniquePoints = shape.originalPoints.length > 2 &&  
                    shape.originalPoints[shape.originalPoints.length - 1].equals(shape.originalPoints[0])  
                    ? shape.originalPoints.slice(0, -1)  
                    : shape.originalPoints;
                  
                  const current = uniquePoints[i];
                  const next = uniquePoints[(i + 1) % uniquePoints.length];
                  const edgeLength = current.distanceTo(next);
                  
                  geometry = new THREE.PlaneGeometry(edgeLength, h);
                  console.log(`🎯 Polyline side ${i + 1}: ${edgeLength.toFixed(1)}x${h.toFixed(1)}mm`);
                } else {
                  shape.geometry.computeBoundingBox();
                  const bbox = shape.geometry.boundingBox;
                  if (bbox) {
                    const w = (bbox.max.x - bbox.min.x) * shape.scale[0];
                    const d = (bbox.max.z - bbox.min.z) * shape.scale[2];
                    const avgEdgeLength = Math.max(w, d) / 4; 
                    geometry = new THREE.PlaneGeometry(avgEdgeLength, h);
                    console.log(`🎯 Polyline fallback side: ${avgEdgeLength.toFixed(1)}x${h.toFixed(1)}mm`);
                  } else {
                    geometry = new THREE.PlaneGeometry(100, h);
                    console.log(`🎯 Polyline default side: 100x${h.toFixed(1)}mm`);
                  }
                }
              }
              break;
            }
            default:
              console.warn(`Geometry creation not implemented for shape type: ${shape.type}`);
              return null;
          }
          
          const shapeQuaternion = shape.quaternion || new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation));

          const shapeMatrix = new THREE.Matrix4();
          shapeMatrix.compose(
            new THREE.Vector3(...shape.position),
            shapeQuaternion,
            new THREE.Vector3(...shape.scale)
          );

          const worldFaceCenter = face.center.clone().applyMatrix4(shapeMatrix);
          const worldFaceNormal = face.normal.clone().applyQuaternion(shapeQuaternion).normalize();

          const sourceNormal = new THREE.Vector3(0, 0, 1);
          
          const rotationQuaternion = new THREE.Quaternion().setFromUnitVectors(sourceNormal, worldFaceNormal);
          
          const finalRotation = new THREE.Euler().setFromQuaternion(rotationQuaternion);

          console.log(`🎯 Face overlay position (world): [${worldFaceCenter.x.toFixed(1)}, ${worldFaceCenter.y.toFixed(1)}, ${worldFaceCenter.z.toFixed(1)}]`);
          console.log(`🎯 Face overlay rotation (Euler, degrees): [${(finalRotation.x * 180 / Math.PI).toFixed(1)}°, ${(finalRotation.y * 180 / Math.PI).toFixed(1)}°, ${(finalRotation.z * 180 / Math.PI).toFixed(1)}°]`);
          
          return { 
            geometry, 
            position: worldFaceCenter, 
            rotation: finalRotation 
          };
        };

        const calculatePolygonCenter = (points: THREE.Vector3[]): THREE.Vector3 => {
          const center = new THREE.Vector3();
          const uniquePoints = points.length > 2 && points[points.length - 1].equals(points[0])  
            ? points.slice(0, -1)  
            : points;
          
          for (const point of uniquePoints) {
            center.add(point);
          }
          
          center.divideScalar(uniquePoints.length);
          return center;
        };

        const calculatePolygonArea = (points: THREE.Vector3[]): number => {
          if (points.length < 3) return 0;
          
          const uniquePoints = points.length > 2 && points[points.length - 1].equals(points[0])  
            ? points.slice(0, -1)  
            : points;
          
          let area = 0;
          for (let i = 0; i < uniquePoints.length; i++) {
            const j = (i + 1) % uniquePoints.length;
            area += uniquePoints[i].x * uniquePoints[j].z;
            area -= uniquePoints[j].x * uniquePoints[i].z;
          }
          
          return Math.abs(area) / 2;
        };

        const getGeometryBasedFaces = (shape: Shape): FaceInfo[] => {
          const faces: FaceInfo[] = [];
          
          shape.geometry.computeBoundingBox();
          const bbox = shape.geometry.boundingBox;
          
          if (!bbox) {
            console.warn('No bounding box available for geometry-based face detection');
            return [];
          }
          
          const width = (bbox.max.x - bbox.min.x) * shape.scale[0];
          const height = (bbox.max.y - bbox.min.y) * shape.scale[1];
          const depth = (bbox.max.z - bbox.min.z) * shape.scale[2];
          
          const hw = width / 2;
          const hh = height / 2;
          const hd = depth / 2;
          
          faces.push(
            {
              index: 0,
              name: 'Top',
              center: new THREE.Vector3(0, hh, 0), 
              normal: new THREE.Vector3(0, 1, 0),
              area: width * depth,
              vertices: [] 
            },
            {
              index: 1,
              name: 'Bottom',
              center: new THREE.Vector3(0, -hh, 0),
              normal: new THREE.Vector3(0, -1, 0),
              area: width * depth,
              vertices: []
            },
            {
              index: 2,
              name: 'Front',
              center: new THREE.Vector3(0, 0, hd),
              normal: new THREE.Vector3(0, 0, 1),
              area: width * height,
              vertices: []
            },
            {
              index: 3,
              name: 'Back',
              center: new THREE.Vector3(0, 0, -hd),
              normal: new THREE.Vector3(0, 0, -1),
              area: width * height,
              vertices: []
            },
            {
              index: 4,
              name: 'Right',
              center: new THREE.Vector3(hw, 0, 0),
              normal: new THREE.Vector3(1, 0, 0),
              area: height * depth,
              vertices: []
            },
            {
              index: 5,
              name: 'Left',
              center: new THREE.Vector3(-hw, 0, 0),
              normal: new THREE.Vector3(-1, 0, 0),
              area: height * depth,
              vertices: []
            }
          );
          
          console.log(`🎯 Generated ${faces.length} geometry-based faces for ${shape.type}`);
          return faces;
        };

        // --- Three.js Scene Setup ---
        let scene, camera, renderer, raycaster, mouse;
        let shapes: Shape[] = []; // Array to store our custom Shape objects
        let highlightMesh: THREE.Mesh | null = null;
        let controlsDiv, infoDiv;

        function init() {
            // Sahneyi oluştur
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x333333); // Koyu gri arka plan

            // Kamerayı oluştur
            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
            camera.position.set(0, 500, 1000);
            camera.lookAt(0, 0, 0);

            // Renderer'ı oluştur
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            document.body.appendChild(renderer.domElement);

            // Işık ekle
            const ambientLight = new THREE.AmbientLight(0x404040, 2); // Yumuşak beyaz ışık
            scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // Güçlü yönlü ışık
            directionalLight.position.set(200, 500, 300);
            scene.add(directionalLight);

            // Raycaster ve Mouse vektörünü oluştur
            raycaster = new THREE.Raycaster();
            mouse = new THREE.Vector2();

            // Bilgi ve kontrol div'lerini al
            infoDiv = document.getElementById('info');
            controlsDiv = document.querySelector('.controls');

            // İlk şekilleri ekle
            addBox();
            addCylinder();
            addPolygon();

            // Pencere boyutu değiştiğinde
            window.addEventListener('resize', onWindowResize, false);
            // Fare tıklama olayını dinle
            window.addEventListener('click', onDocumentMouseDown, false);

            // Buton olay dinleyicileri
            document.getElementById('addBox').addEventListener('click', addBox);
            document.getElementById('addCylinder').addEventListener('click', addCylinder);
            document.getElementById('addPolygon').addEventListener('click', addPolygon);
        }

        // --- Shape Creation Functions ---

        function addBox() {
            const width = 200, height = 200, depth = 200;
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const material = new THREE.MeshPhongMaterial({ color: Math.random() * 0xffffff });
            const mesh = new THREE.Mesh(geometry, material);
            
            // Rastgele bir konum ver
            mesh.position.set(
                Math.random() * 800 - 400,
                Math.random() * 200, // Y koordinatı yer düzleminden biraz yukarıda olsun
                Math.random() * 800 - 400
            );
            // Rastgele rotasyon
            mesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            scene.add(mesh);

            // Shape verisini oluştur ve sakla
            const shape: Shape = {
                type: 'box',
                parameters: { width, height, depth },
                scale: [1, 1, 1],
                position: [mesh.position.x, mesh.position.y, mesh.position.z],
                rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
                quaternion: mesh.quaternion.clone(), // Mesh'in güncel quaternion'ını al
                geometry: mesh.geometry,
                mesh: mesh // Mesh referansını Shape objesinde sakla
            };
            shapes.push(shape);
            console.log("Kutu eklendi:", shape);
        }

        function addCylinder() {
            const radius = 100, height = 300;
            const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
            const material = new THREE.MeshPhongMaterial({ color: Math.random() * 0xffffff });
            const mesh = new THREE.Mesh(geometry, material);

            mesh.position.set(
                Math.random() * 800 - 400,
                Math.random() * 200,
                Math.random() * 800 - 400
            );
            mesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            scene.add(mesh);

            const shape: Shape = {
                type: 'cylinder',
                parameters: { radius, height },
                scale: [1, 1, 1],
                position: [mesh.position.x, mesh.position.y, mesh.position.z],
                rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
                quaternion: mesh.quaternion.clone(),
                geometry: mesh.geometry,
                mesh: mesh
            };
            shapes.push(shape);
            console.log("Silindir eklendi:", shape);
        }

        function addPolygon() {
            // Basit bir 5 kenarlı poligon (yıldız veya düzgün beşgen olabilir)
            const outerRadius = 150;
            const innerRadius = 75;
            const numPoints = 5;
            const points: THREE.Vector3[] = [];

            for (let i = 0; i < numPoints * 2; i++) {
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = (i / (numPoints * 2)) * Math.PI * 2;
                points.push(new THREE.Vector3(
                    Math.cos(angle) * radius,
                    0, // Y ekseni 0'da
                    Math.sin(angle) * radius
                ));
            }
            // Polygonu kapatmak için ilk noktayı tekrar ekle (isteğe bağlı, ama Three.js Shape için iyi)
            if (!points[points.length - 1].equals(points[0])) {
                points.push(points[0].clone());
            }

            const shape2D = new THREE.Shape(points.map(p => new THREE.Vector2(p.x, p.z)));
            const extrudeSettings = {
                steps: 1,
                depth: 100, // Extrude yüksekliği
                bevelEnabled: false
            };
            const geometry = new THREE.ExtrudeGeometry(shape2D, extrudeSettings);
            const material = new THREE.MeshPhongMaterial({ color: Math.random() * 0xffffff });
            const mesh = new THREE.Mesh(geometry, material);

            mesh.position.set(
                Math.random() * 800 - 400,
                Math.random() * 200,
                Math.random() * 800 - 400
            );
            mesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            scene.add(mesh);

            const shape: Shape = {
                type: 'polygon3d', // veya 'polygon2d' extruded
                parameters: { height: extrudeSettings.depth },
                scale: [1, 1, 1],
                position: [mesh.position.x, mesh.position.y, mesh.position.z],
                rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
                quaternion: mesh.quaternion.clone(),
                originalPoints: points, // Orijinal 3D noktaları sakla
                geometry: mesh.geometry,
                mesh: mesh
            };
            shapes.push(shape);
            console.log("Poligon eklendi:", shape);
        }

        // --- Event Handlers ---

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        function onDocumentMouseDown(event: MouseEvent) {
            // Normalleştirilmiş cihaz koordinatlarını hesapla (-1 ile +1 arası)
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            // Raycaster'ı güncelle
            raycaster.setFromCamera(mouse, camera);

            // Tüm sahnedeki nesnelerle kesişimi bul (sadece Mesh objelerini kontrol et)
            const intersects = raycaster.intersectObjects(scene.children.filter(obj => obj instanceof THREE.Mesh));

            if (intersects.length > 0) {
                const firstIntersection = intersects[0];
                const intersectedMesh = firstIntersection.object as THREE.Mesh; // Çarpan mesh
                
                // Hangi Shape objesine ait olduğunu bul
                const targetShape = shapes.find(s => s.mesh === intersectedMesh);

                if (targetShape) {
                    // Mesh'in quaternion'ını güncel tut
                    targetShape.quaternion = intersectedMesh.quaternion.clone();

                    // Tıklanan yüzeyi bulmak için getFaceInfo yardımcı fonksiyonunu kullan
                    const faceIndex = findFaceAtIntersection(
                        firstIntersection.point,
                        firstIntersection.face!.normal.clone(), // Raycast'ten gelen face normali
                        targetShape,
                        firstIntersection // Tüm intersection objesini gönder
                    );

                    if (faceIndex !== null) {
                        // Vurgulama geometrisini ve dönüşümünü al
                        const highlightData = getFaceGeometry(targetShape, faceIndex);

                        if (highlightData) {
                            if (!highlightMesh) {
                                // Vurgulama mesh'i yoksa oluştur
                                const material = new THREE.MeshBasicMaterial({
                                    color: 0xFFA500, // Turuncu
                                    transparent: true,
                                    opacity: 0.5,
                                    side: THREE.DoubleSide
                                });
                                highlightMesh = new THREE.Mesh(highlightData.geometry, material);
                                scene.add(highlightMesh);
                            } else {
                                // Vurgulama mesh'i varsa geometrisini ve materyalini güncelle
                                highlightMesh.geometry.dispose(); // Eski geometriyi bellekten temizle
                                highlightMesh.geometry = highlightData.geometry;
                                // Material'ı da yeniden ayarlayalım (örneğin opaklık için)
                                (highlightMesh.material as THREE.MeshBasicMaterial).opacity = 0.5;
                            }

                            // Vurgulama mesh'ini doğru konuma ve rotasyona ayarla
                            highlightMesh.position.copy(highlightData.position);
                            highlightMesh.rotation.copy(highlightData.rotation);

                            console.log(`✅ Yüzey vurgulandı: ${targetShape.type}, Yüzey Index: ${faceIndex}`);
                            updateInfoDiv(faceIndex, firstIntersection.point, targetShape.type);
                        } else {
                            console.warn('Vurgulama geometrisi oluşturulamadı.');
                            removeHighlight();
                        }
                    } else {
                        console.log('Yüzey bulunamadı, vurgulama kaldırılıyor.');
                        removeHighlight();
                    }
                } else {
                    console.warn('Tıklanan mesh, bilinen bir Shape objesine ait değil.');
                    removeHighlight();
                }
            } else {
                console.log('Hiçbir nesneye tıklanmadı, vurgulama kaldırılıyor.');
                removeHighlight();
            }
        }

        function removeHighlight() {
            if (highlightMesh) {
                scene.remove(highlightMesh);
                highlightMesh.geometry.dispose();
                (highlightMesh.material as THREE.Material).dispose();
                highlightMesh = null;
            }
            updateInfoDiv(null, null, null);
        }

        function updateInfoDiv(faceIndex: number | null, point: THREE.Vector3 | null, shapeType: string | null) {
            if (infoDiv) {
                if (faceIndex !== null && point !== null && shapeType !== null) {
                    infoDiv.innerHTML = `
                        Tıklanan Şekil Tipi: <b>${shapeType}</b><br>
                        Tıklanan Yüzey Index: <b>${faceIndex}</b><br>
                        Tıklanan Nokta (Dünya): <b>(${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)})</b>
                    `;
                } else {
                    infoDiv.innerHTML = `
                        Tıklanan Yüzey: Yok<br>
                        Tıklanan Nokta (Dünya): Yok
                    `;
                }
            }
        }

        // --- Animation Loop ---
        function animate() {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        }

        // --- Start the application ---
        window.onload = function() {
            init();
            animate();
        };
    </script>
</body>
</html>
