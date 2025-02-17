import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CirclePacker = () => {
  const [inputs, setInputs] = useState({
    diameter: 33,
    clearance: 1,
    width: 600,
    height: 120
  });
  
  const [packingResult, setPackingResult] = useState(null);
  
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [lastPackerUsed, setLastPackerUsed] = useState(null);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputs(prev => ({
      ...prev,
      [name]: parseFloat(value)
    }));
    
    if (autoUpdate && lastPackerUsed) {
      const packers = {
        'rect-tight': () => calculateRectangularPacking(false),
        'rect-full': () => calculateRectangularPacking(true),
        'tri-tight': () => calculateTriangularPacking(60, false),
        'tri-full': () => calculateTriangularPacking(60, true),
        'tri-optimal': () => findOptimalAngle()
      };
      setPackingResult(packers[lastPackerUsed]());
    }
  };

  const calculateTriangularPacking = (angle, spread = false, forceRows = null) => {
    // Constrain angle to valid range
    const constrainedAngle = Math.min(60, Math.max(30, angle));
    const rad = constrainedAngle * Math.PI / 180;
    const sinTheta = Math.sin(rad);
    const cosTheta = Math.cos(rad);
    const D = inputs.diameter + inputs.clearance;
    
    const rowHeight = sinTheta * D;
    const horizSpacing = 2 * cosTheta * D;
    
    const numRows = forceRows !== null ? forceRows :
                   Math.floor((inputs.height - inputs.diameter)/rowHeight + 1);
    
    const circlesPerEvenRow = Math.floor((inputs.width - inputs.diameter) / horizSpacing) + 1;
    
    // Fix: Calculate odd row circles based on even row count, can only be equal or one less
    const maxOddRowCircles = Math.floor((inputs.width - horizSpacing/2 - inputs.diameter) / horizSpacing) + 1;
    const finalCirclesPerOddRow = Math.min(maxOddRowCircles, circlesPerEvenRow);
    
    let actualHorizSpacing = horizSpacing;
    let actualRowHeight = rowHeight;
    
    if (spread) {
      actualRowHeight = numRows > 1 ? 
        (inputs.height - inputs.diameter) / (numRows - 1) : 
        inputs.diameter/2;
      
      const maxWidth = Math.max(
        (circlesPerEvenRow - 1) * horizSpacing,
        (finalCirclesPerOddRow - 1) * horizSpacing + horizSpacing/2
      );
      
      // For single row, ensure it spreads to full width
      const targetWidth = numRows === 1 ? 
        (circlesPerEvenRow - 1) * horizSpacing :
        maxWidth;
      
      const scaleFactor = (inputs.width - inputs.diameter) / targetWidth;
      actualHorizSpacing = horizSpacing * scaleFactor;
    }
    
    const positions = [];
    for (let row = 0; row < numRows; row++) {
      const isOddRow = row % 2 === 1;
      const circlesThisRow = isOddRow ? finalCirclesPerOddRow : circlesPerEvenRow;
      const xOffset = isOddRow ? actualHorizSpacing / 2 : 0;
      
      for (let col = 0; col < circlesThisRow; col++) {
        positions.push({
          x: col * actualHorizSpacing + xOffset + inputs.diameter/2,
          y: row * actualRowHeight + inputs.diameter/2
        });
      }
    }
    
    const maxX = Math.max(...positions.map(p => p.x + inputs.diameter/2));
    const minX = Math.min(...positions.map(p => p.x - inputs.diameter/2));
    const maxY = Math.max(...positions.map(p => p.y + inputs.diameter/2));
    const minY = Math.min(...positions.map(p => p.y - inputs.diameter/2));
    
    // Calculate actual angle from the spacing we're using
    const finalAngle = Math.atan2(actualRowHeight, actualHorizSpacing/2) * 180/Math.PI;
    
    return {
      circles: positions,
      actualWidth: spread ? inputs.width : (maxX - minX),
      actualHeight: spread ? inputs.height : (maxY - minY),
      horizontalClearance: actualHorizSpacing - inputs.diameter,
      diagonalClearance: Math.sqrt(Math.pow(actualHorizSpacing/2, 2) + Math.pow(actualRowHeight, 2)) - inputs.diameter,
      count: positions.length,
      pattern: 'triangular',
      angle: spread ? finalAngle : constrainedAngle,
      numRows,
      circlesPerRow: circlesPerEvenRow,
      evenRowCount: circlesPerEvenRow,
      oddRowCount: finalCirclesPerOddRow
    };
  };

  const findOptimalAngle = () => {
    const D = inputs.diameter + inputs.clearance;
    // Start with an estimate of rows at 60°
    const initialRows = Math.floor((inputs.height - inputs.diameter) / (D * Math.sin(60 * Math.PI/180))) + 1;
    
    let bestResult = calculateTriangularPacking(60, true);
    
    // Try both increasing and decreasing rows from our initial estimate
    for (let targetRows = Math.max(2, initialRows - 2); targetRows <= initialRows + 2; targetRows++) {
      const sinTheta = (inputs.height - inputs.diameter) / (D * (targetRows - 1));
      
      // Skip if we can't fit these rows
      if (sinTheta > 1) continue;
      
      const angle = Math.asin(sinTheta) * 180/Math.PI;
      
      // Skip if angle would cause vertical overlap (angle < 30°)
      // or horizontal overlap (angle > 60°)
      if (angle < 30 || angle > 60) continue;
      
      const result = calculateTriangularPacking(angle, true, targetRows);
      if (result.count > bestResult.count) {
        bestResult = result;
      }
    }
    
    return bestResult;
  };
  
  const calculateRectangularPacking = (spread = false) => {
    const horizontalCenterDist = inputs.diameter + inputs.clearance;
    const verticalCenterDist = inputs.diameter + inputs.clearance;
    
    const circlesX = Math.floor((inputs.width - inputs.diameter) / horizontalCenterDist) + 1;
    const circlesY = Math.floor((inputs.height - inputs.diameter) / verticalCenterDist) + 1;
    
    const actualWidth = (circlesX - 1) * horizontalCenterDist + inputs.diameter;
    const actualHeight = (circlesY - 1) * verticalCenterDist + inputs.diameter;
    
    const horizCenterDist = spread ? 
      (inputs.width - inputs.diameter) / (circlesX - 1) :
      horizontalCenterDist;
    const vertCenterDist = spread ?
      (circlesY > 1 ? 
        (inputs.height - inputs.diameter) / (circlesY - 1) : 
        inputs.diameter/2) :
      verticalCenterDist;
    
    const finalHorizClearance = horizCenterDist - inputs.diameter;
    const finalVertClearance = vertCenterDist - inputs.diameter;
    
    const positions = [];
    for (let y = 0; y < circlesY; y++) {
      for (let x = 0; x < circlesX; x++) {
        positions.push({
          x: x * horizCenterDist + inputs.diameter/2,
          y: y * vertCenterDist + inputs.diameter/2
        });
      }
    }
    
    return {
      circles: positions,
      actualWidth: spread ? inputs.width : actualWidth,
      actualHeight: spread ? inputs.height : actualHeight,
      horizontalClearance: finalHorizClearance,
      verticalClearance: finalVertClearance,
      count: positions.length,
      pattern: 'rectangular',
      numRows: circlesY,
      circlesPerRow: circlesX
    };
  };
  
  const getViewBoxParams = (width, height, packingResult) => {
    const scaleFactor = Math.max(width, height) / 400;
    
    const leftPadding = 40 * scaleFactor;
    const rightPadding = 40 * scaleFactor;
    const topPadding = 30 * scaleFactor;
    const bottomPadding = 30 * scaleFactor;
    
    const fontSize = 12 * scaleFactor;
    const strokeWidth = 0.5 * scaleFactor;
    const arrowSize = 12;
    
    const dimensionOffset = 15 * scaleFactor;
    const textOffset = dimensionOffset + 15 * scaleFactor;
    
    return {
      viewBox: `${-leftPadding} ${-topPadding} ${width + leftPadding + rightPadding} ${height + topPadding + bottomPadding}`,
      fontSize,
      arrowSize,
      strokeWidth,
      dimensionOffset,
      textOffset
    };
  };

  return (
    <Card className="w-full max-w-4xl p-4">
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="diameter">Circle Diameter (mm)</Label>
            <Input
              id="diameter"
              name="diameter"
              type="number"
              value={inputs.diameter}
              onChange={handleInputChange}
              className="w-full"
            />
          </div>
          <div>
            <Label htmlFor="clearance">Minimum Clearance (mm)</Label>
            <Input
              id="clearance"
              name="clearance"
              type="number"
              value={inputs.clearance}
              onChange={handleInputChange}
              className="w-full"
            />
          </div>
          <div>
            <Label htmlFor="width">Rectangle Width (mm)</Label>
            <Input
              id="width"
              name="width"
              type="number"
              value={inputs.width}
              onChange={handleInputChange}
              className="w-full"
            />
          </div>
          <div>
            <Label htmlFor="height">Rectangle Height (mm)</Label>
            <Input
              id="height"
              name="height"
              type="number"
              value={inputs.height}
              onChange={handleInputChange}
              className="w-full"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Button onClick={() => {
            setLastPackerUsed('rect-tight');
            setPackingResult(calculateRectangularPacking(false));
          }}>
            Pack Rectangular (Tight)
          </Button>
          <Button onClick={() => {
            setLastPackerUsed('rect-full');
            setPackingResult(calculateRectangularPacking(true));
          }}>
            Pack Rectangular (Full)
          </Button>
          <div className="col-span-1"></div>
          <Button onClick={() => {
            setLastPackerUsed('tri-tight');
            setPackingResult(calculateTriangularPacking(60, false));
          }}>
            Pack Triangular 60° (Tight)
          </Button>
          <Button onClick={() => {
            setLastPackerUsed('tri-full');
            setPackingResult(calculateTriangularPacking(60, true));
          }}>
            Pack Triangular 60° (Full)
          </Button>
          <Button onClick={() => {
            setLastPackerUsed('tri-optimal');
            setPackingResult(findOptimalAngle());
          }}>
            Pack Triangular (Optimal)
          </Button>
        </div>

        <div className="mb-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="autoUpdate"
              checked={autoUpdate}
              onChange={(e) => setAutoUpdate(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="autoUpdate">Auto-update on input changes</Label>
          </div>
        </div>
        
        {packingResult && (
          <>
            <div className="w-full aspect-video mb-4">
              <svg
                className="w-full h-full"
                viewBox={getViewBoxParams(inputs.width, inputs.height, packingResult).viewBox}
                preserveAspectRatio="xMidYMid meet"
              >
                {(() => {
                  const params = getViewBoxParams(inputs.width, inputs.height, packingResult);
                  return (
                    <defs>
                      <pattern 
                        id="grid" 
                        width={10 * params.strokeWidth} 
                        height={10 * params.strokeWidth} 
                        patternUnits="userSpaceOnUse"
                      >
                        <path 
                          d={`M ${10 * params.strokeWidth} 0 L 0 0 0 ${10 * params.strokeWidth}`} 
                          fill="none" 
                          stroke="#f0f0f0" 
                          strokeWidth={params.strokeWidth / 2}
                        />
                      </pattern>
                      <radialGradient id="circleGradient">
                        <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.1"/>
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05"/>
                      </radialGradient>
                      <marker
                        id="arrow-end"
                        viewBox="0 0 16 10"
                        refX="15"
                        refY="5"
                        markerWidth={params.arrowSize}
                        markerHeight={params.arrowSize}
                        orient="auto"
                      >
                        <path d="M 0 0 L 16 5 L 0 10 z" fill="#94a3b8"/>
                      </marker>
                      <marker
                        id="arrow-start"
                        viewBox="0 0 16 10"
                        refX="1"
                        refY="5"
                        markerWidth={params.arrowSize}
                        markerHeight={params.arrowSize}
                        orient="auto"
                      >
                        <path d="M 16 0 L 0 5 L 16 10 z" fill="#94a3b8"/>
                      </marker>
                      <marker
                        id="arrow-end-blue"
                        viewBox="0 0 16 10"
                        refX="15"
                        refY="5"
                        markerWidth={params.arrowSize}
                        markerHeight={params.arrowSize}
                        orient="auto"
                      >
                        <path d="M 0 0 L 16 5 L 0 10 z" fill="#3b82f6"/>
                      </marker>
                      <marker
                        id="arrow-start-blue"
                        viewBox="0 0 16 10"
                        refX="1"
                        refY="5"
                        markerWidth={params.arrowSize}
                        markerHeight={params.arrowSize}
                        orient="auto"
                      >
                        <path d="M 16 0 L 0 5 L 16 10 z" fill="#3b82f6"/>
                      </marker>
                    </defs>
                  );
                })()}
                
                <rect
                  x="0"
                  y="0"
                  width={inputs.width}
                  height={inputs.height}
                  fill="url(#grid)"
                  stroke="#e5e7eb"
                  strokeWidth={getViewBoxParams(inputs.width, inputs.height, packingResult).strokeWidth}
                />
                
                <rect
                  x="0"
                  y="0"
                  width={packingResult.actualWidth}
                  height={packingResult.actualHeight}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={getViewBoxParams(inputs.width, inputs.height, packingResult).strokeWidth}
                  strokeDasharray="5,5"
                />
                
                {packingResult.circles.map((circle, i) => (
                  <g key={i}>
                    <circle
                      cx={circle.x}
                      cy={circle.y}
                      r={inputs.diameter / 2}
                      fill="url(#circleGradient)"
                      stroke="#3b82f6"
                      strokeWidth={getViewBoxParams(inputs.width, inputs.height, packingResult).strokeWidth}
                    />
                    <circle
                      cx={circle.x}
                      cy={circle.y}
                      r="1"
                      fill="#3b82f6"
                    />
                  </g>
                ))}
                
                {(() => {
                  const params = getViewBoxParams(inputs.width, inputs.height, packingResult);
                  return (
                    <>
                      {/* Rectangle dimensions */}
                      <line
                        x1="0"
                        y1={inputs.height + params.dimensionOffset}
                        x2={inputs.width}
                        y2={inputs.height + params.dimensionOffset}
                        stroke="#94a3b8"
                        strokeWidth={params.strokeWidth}
                        markerStart="url(#arrow-start)"
                        markerEnd="url(#arrow-end)"
                      />
                      <text
                        x={inputs.width / 2}
                        y={inputs.height + params.textOffset}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize={params.fontSize}
                      >
                        {inputs.width} mm
                      </text>
                      
                      <line
                        x1={inputs.width + params.dimensionOffset}
                        y1={inputs.height}
                        x2={inputs.width + params.dimensionOffset}
                        y2="0"
                        stroke="#94a3b8"
                        strokeWidth={params.strokeWidth}
                        markerStart="url(#arrow-start)"
                        markerEnd="url(#arrow-end)"
                      />
                      <text
                        x={inputs.width + params.textOffset}
                        y={inputs.height / 2}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize={params.fontSize}
                        transform={`rotate(-90 ${inputs.width + params.textOffset} ${inputs.height / 2})`}
                      >
                        {inputs.height} mm
                      </text>

                      {/* Bounding box dimensions - only show for tight packing */}
                      {(!packingResult.spread && packingResult.actualWidth !== inputs.width) && (
                        <>
                          <line
                            x1="0"
                            y1={-params.dimensionOffset}
                            x2={packingResult.actualWidth}
                            y2={-params.dimensionOffset}
                            stroke="#3b82f6"
                            strokeWidth={params.strokeWidth}
                            strokeDasharray={`${5 * params.strokeWidth},${5 * params.strokeWidth}`}
                            markerStart="url(#arrow-start-blue)"
                            markerEnd="url(#arrow-end-blue)"
                          />
                          <text
                            x={packingResult.actualWidth / 2}
                            y={-params.textOffset}
                            textAnchor="middle"
                            fill="#3b82f6"
                            fontSize={params.fontSize}
                          >
                            {packingResult.actualWidth.toFixed(1)} mm
                          </text>
                          
                          <line
                            x1={-params.dimensionOffset}
                            y1={packingResult.actualHeight}
                            x2={-params.dimensionOffset}
                            y2="0"
                            stroke="#3b82f6"
                            strokeWidth={params.strokeWidth}
                            strokeDasharray={`${5 * params.strokeWidth},${5 * params.strokeWidth}`}
                            markerStart="url(#arrow-start)"
                            markerEnd="url(#arrow-end)"
                          />
                          <text
                            x={-params.textOffset}
                            y={packingResult.actualHeight / 2}
                            textAnchor="middle"
                            fill="#3b82f6"
                            fontSize={params.fontSize}
                            transform={`rotate(-90 ${-params.textOffset} ${packingResult.actualHeight / 2})`}
                          >
                            {packingResult.actualHeight.toFixed(1)} mm
                          </text>
                        </>
                      )}
                    </>
                  );
                })()}
              </svg>
            </div>
            
            <div className="border rounded p-4">
              <p className="font-bold">Results:</p>
              <p>Number of circles: {packingResult.count}</p>
              {packingResult.pattern === 'triangular' && (
                <>
                  <p>Number of rows: {packingResult.numRows}</p>
                  <p>Circles per row: {packingResult.evenRowCount} (even rows) / {packingResult.oddRowCount} (odd rows)</p>
                  <p>Horizontal clearance: {packingResult.horizontalClearance.toFixed(2)} mm</p>
                  <p>Diagonal clearance: {packingResult.diagonalClearance.toFixed(2)} mm</p>
                </>
              )}
              {packingResult.pattern === 'rectangular' && (
                <>
                  <p>Number of rows: {packingResult.numRows}</p>
                  <p>Circles per row: {packingResult.circlesPerRow}</p>
                  <p>Horizontal clearance: {packingResult.horizontalClearance.toFixed(2)} mm</p>
                  <p>Vertical clearance: {packingResult.verticalClearance.toFixed(2)} mm</p>
                </>
              )}
              <p>Pattern: {packingResult.pattern} 
                {packingResult.angle && ` (${packingResult.angle.toFixed(1)}°)`}
              </p>
              <p>Bounding box width: {packingResult.actualWidth.toFixed(2)} mm</p>
              <p>Bounding box height: {packingResult.actualHeight.toFixed(2)} mm</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CirclePacker;